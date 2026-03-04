import Dockerode from 'dockerode';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Engineer, Project } from './db.js';
import { getSetting, getGithubToken } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const docker = new Dockerode({ socketPath: '/var/run/docker.sock' });

const NETWORK_NAME = process.env.DOCKER_NETWORK || 'crewnest-network';

function formatRepos(reposJson: string): string {
  try {
    const repos = JSON.parse(reposJson) as Array<{ url: string; path?: string; branch?: string; mode?: string }>;
    return repos
      .map(r => `${r.url}|${r.path || '/workspace/' + r.url.split('/').pop()?.replace('.git', '')}|${r.branch || 'main'}|${r.mode || 'push'}`)
      .join('\n');
  } catch {
    return '';
  }
}

function mergeEnvVars(engineerOverrides: string, projectEnvVars: string): string[] {
  const result: string[] = [];
  try {
    const projVars = JSON.parse(projectEnvVars) as Record<string, string>;
    for (const [k, v] of Object.entries(projVars)) {
      result.push(`${k}=${v}`);
    }
  } catch { /* ignore */ }
  try {
    const engVars = JSON.parse(engineerOverrides) as Record<string, string>;
    for (const [k, v] of Object.entries(engVars)) {
      result.push(`${k}=${v}`);
    }
  } catch { /* ignore */ }
  return result;
}

export async function startEngineer(engineer: Engineer, project: Project | null): Promise<string> {
  const containerName = `crewnest-${engineer.name}`;

  // Check if container already exists
  try {
    const existing = docker.getContainer(containerName);
    const info = await existing.inspect();
    if (info.State.Running) {
      return info.Id;
    }
    // Exists but stopped — start it
    await existing.start();
    return info.Id;
  } catch {
    // Container doesn't exist, create it
  }

  // Verify image exists before trying to create
  try {
    const image = docker.getImage(engineer.image);
    await image.inspect();
  } catch {
    throw new Error(`Docker image "${engineer.image}" not found. Build it first or change the engineer's image.`);
  }

  const env = [
    `AGENT_TYPE=${engineer.agent_type}`,
    `AGENT_ID=${engineer.name}`,
    `AGENT_NAME=${engineer.name}`,
    `AGENT_ROLE=${engineer.role || 'engineer'}`,
    `HIVEMINDDB_URL=${getSetting('hivemind_url') || process.env.HIVEMINDDB_URL || 'http://hivemind:8100'}`,
    `CODEGATE_URL=${getSetting('codegate_url') || process.env.CODEGATE_URL || 'http://codegate:9212'}`,
  ];

  if (project) {
    const repos = formatRepos(project.repos);
    if (repos) env.push(`REPOS=${repos}`);
    env.push(...mergeEnvVars(engineer.env_overrides, project.env_vars));
  }

  // Pass CodeGate API key to engineer
  // AgentCore's 60-llm-config.sh uses PROXY_API_KEY for the apiKeyHelper
  const codegateApiKey = getSetting('codegate_api_key');
  if (codegateApiKey) {
    env.push(`CODEGATE_API_KEY=${codegateApiKey}`);
    env.push(`PROXY_API_KEY=${codegateApiKey}`);
  }

  const ghToken = getGithubToken(engineer.project_id ?? undefined);
  if (ghToken) {
    env.push(`GITHUB_TOKEN=${ghToken}`);
  }

  const portBindings: Record<string, Dockerode.PortBinding[]> = {};
  const exposedPorts: Record<string, object> = {};

  if (engineer.ssh_port) {
    portBindings['22/tcp'] = [{ HostPort: String(engineer.ssh_port) }];
    exposedPorts['22/tcp'] = {};
  }
  if (engineer.api_port) {
    portBindings['8080/tcp'] = [{ HostPort: String(engineer.api_port) }];
    exposedPorts['8080/tcp'] = {};
  }
  if (engineer.vnc_port) {
    portBindings['6080/tcp'] = [{ HostPort: String(engineer.vnc_port) }];
    exposedPorts['6080/tcp'] = {};
    // Also expose the raw VNC port for direct connections
    portBindings['5900/tcp'] = [{ HostPort: String(engineer.vnc_port + 100) }];
    exposedPorts['5900/tcp'] = {};
    // Enable the desktop module in AgentCore
    env.push('ENABLE_DESKTOP=true');
  }

  const container = await docker.createContainer({
    Image: engineer.image,
    name: containerName,
    Hostname: engineer.name,
    Env: env,
    ExposedPorts: exposedPorts,
    HostConfig: {
      NetworkMode: NETWORK_NAME,
      PortBindings: portBindings,
      RestartPolicy: { Name: 'unless-stopped' },
    },
  });

  await container.start();

  // For orchestrator: inject CrewNest MCP server
  if (engineer.role === 'orchestrator') {
    injectCrewNestMcp(container).catch(() => {});
  }

  // Auto-accept Claude Code's "trust this folder" prompt after startup
  // The entrypoint takes ~10-15s to reach Claude, so we schedule the auto-accept
  autoAcceptPrompts(container).catch(() => {});

  return container.id;
}

async function execInContainer(container: Dockerode.Container, cmd: string[], user = 'root'): Promise<string> {
  const exec = await container.exec({
    Cmd: cmd,
    AttachStdout: true,
    AttachStderr: true,
    User: user,
  });
  const stream = await exec.start({});
  return new Promise<string>((resolve) => {
    let data = '';
    stream.on('data', (chunk: Buffer) => { data += chunk.toString(); });
    stream.on('end', () => resolve(data));
    setTimeout(() => resolve(data), 5000);
  });
}

async function injectCrewNestMcp(container: Dockerode.Container): Promise<void> {
  // Wait for container filesystem to be ready
  await new Promise(resolve => setTimeout(resolve, 3000));

  try {
    // Read the MCP server script from the dashboard container filesystem
    let mcpScript = '';
    const tryPaths = [
      path.join(process.cwd(), 'src', 'server', 'crewnest-mcp.cjs'),
      path.join(__dirname, 'crewnest-mcp.cjs'),
    ];
    for (const p of tryPaths) {
      try {
        mcpScript = fs.readFileSync(p, 'utf-8');
        console.log(`Found MCP script at: ${p}`);
        break;
      } catch { /* try next */ }
    }
    if (!mcpScript) {
      console.error('Could not find crewnest-mcp.cjs in:', tryPaths);
      return;
    }

    // Write MCP server script into the container using tar archive
    // (heredoc can break with special characters, tar is more reliable)
    const scriptB64 = Buffer.from(mcpScript).toString('base64');
    await execInContainer(container, ['mkdir', '-p', '/opt/crewnest']);
    // Write in chunks if too long, or use base64 decode
    await execInContainer(container, [
      'sh', '-c',
      `echo '${scriptB64}' | base64 -d > /opt/crewnest/mcp-server.cjs`,
    ]);
    await execInContainer(container, ['chmod', '+x', '/opt/crewnest/mcp-server.cjs']);

    // Configure Claude Code to use the MCP server
    // MCP servers must go in ~/.claude.json (the main config), not settings.json
    // Read existing .claude.json, merge in the crewnest server, write back
    const mergeScript = `
      node -e "
        const fs = require('fs');
        const configPath = '/home/agent/.claude.json';
        let config = {};
        try { config = JSON.parse(fs.readFileSync(configPath, 'utf-8')); } catch {}
        if (!config.mcpServers) config.mcpServers = {};
        config.mcpServers.crewnest = {
          command: 'node',
          args: ['/opt/crewnest/mcp-server.cjs'],
          env: { CREWNEST_API: 'http://crewnest:3000' }
        };
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        fs.chownSync(configPath, 1000, 1000);
      "
    `.trim();
    await execInContainer(container, ['sh', '-c', mergeScript]);

    console.log('CrewNest MCP server injected into orchestrator');
  } catch (err) {
    console.error('Failed to inject MCP:', err);
  }
}

async function autoAcceptPrompts(container: Dockerode.Container): Promise<void> {
  // Poll tmux pane for interactive prompts and auto-accept them
  for (let i = 0; i < 20; i++) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    try {
      const output = await execInContainer(container, [
        'su', '-', 'agent', '-c', 'tmux capture-pane -t agent -p',
      ]);

      // 1) Trust this folder prompt — option 1 is selected by default, just press Enter
      if (output.includes('trust this folder')) {
        console.log('Auto-accepting trust prompt');
        await execInContainer(container, [
          'su', '-', 'agent', '-c', 'tmux send-keys -t agent Enter',
        ]);
        continue; // Keep checking for more prompts
      }

      // 2) Bypass permissions prompt — option 2 "Yes, I accept" needs to be selected
      if (output.includes('Yes, I accept') && output.includes('Bypass Permissions')) {
        console.log('Auto-accepting bypass permissions prompt');
        // Navigate down to option 2, then wait, then press Enter
        await execInContainer(container, [
          'su', '-', 'agent', '-c', 'tmux send-keys -t agent Down',
        ]);
        await new Promise(resolve => setTimeout(resolve, 500));
        await execInContainer(container, [
          'su', '-', 'agent', '-c', 'tmux send-keys -t agent Enter',
        ]);
        continue;
      }

      // 3) If Claude is running and past all prompts, we're done
      if (output.includes('Claude Code v') || output.includes('Try "') || output.includes('bypass permissions on')) {
        console.log('Claude Code is ready');
        return;
      }
    } catch {
      // Container may have stopped or tmux not ready yet
    }
  }
}

export async function stopEngineer(engineer: Engineer): Promise<void> {
  const containerName = `crewnest-${engineer.name}`;
  try {
    const container = docker.getContainer(containerName);
    await container.stop({ t: 10 });
    await container.remove();
  } catch (err: any) {
    if (err.statusCode !== 404) throw err;
  }
}

export async function getEngineerStatus(engineer: Engineer): Promise<{
  running: boolean;
  containerId?: string;
  uptime?: string;
  health?: string;
}> {
  const containerName = `crewnest-${engineer.name}`;
  try {
    const container = docker.getContainer(containerName);
    const info = await container.inspect();
    return {
      running: info.State.Running,
      containerId: info.Id.slice(0, 12),
      uptime: info.State.Running ? info.State.StartedAt : undefined,
      health: info.State.Health?.Status,
    };
  } catch {
    return { running: false };
  }
}

export async function getEngineerLogs(engineer: Engineer, tail = 100): Promise<string> {
  const containerName = `crewnest-${engineer.name}`;
  try {
    const container = docker.getContainer(containerName);
    const logs = await container.logs({
      stdout: true,
      stderr: true,
      tail,
      timestamps: true,
    });
    return logs.toString();
  } catch {
    return '';
  }
}

export async function listRunningContainers(): Promise<Array<{ name: string; id: string; status: string; image: string }>> {
  const containers = await docker.listContainers({
    all: true,
    filters: { name: ['crewnest-'] },
  });
  return containers.map(c => ({
    name: c.Names[0]?.replace(/^\//, '').replace('crewnest-', '') || '',
    id: c.Id.slice(0, 12),
    status: c.State,
    image: c.Image,
  }));
}

export async function checkDockerConnection(): Promise<boolean> {
  try {
    await docker.ping();
    return true;
  } catch {
    return false;
  }
}
