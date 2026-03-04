import { nanoid } from 'nanoid';
import {
  listProjects, getProject, createProject,
  listEngineers, getEngineer, getEngineerByName, createEngineer, updateEngineer,
  addChatMessage, getChatHistory, getSetting,
  type Project, type Engineer,
} from './db.js';
import * as dockerOps from './docker.js';

function getCodegateUrl(): string {
  return getSetting('codegate_url') || process.env.CODEGATE_URL || 'http://localhost:9212';
}
function getCodegateApiKey(): string {
  return getSetting('codegate_api_key') || process.env.CODEGATE_API_KEY || '';
}
function getHivemindUrl(): string {
  return getSetting('hivemind_url') || process.env.HIVEMINDDB_URL || 'http://localhost:8100';
}
function getOrchestratorModel(): string {
  return getSetting('default_model') || 'claude-sonnet-4-20250514';
}

const SYSTEM_PROMPT = `You are CrewNest, an AI platform manager. You manage a team of persistent AI engineers.

Each engineer is a Claude Code instance running in a Docker container with:
- Persistent memory via HiveMindDB
- LLM access via CodeGate
- Git repo access via AgentCore's repo sync

You can start/stop engineers, create tasks, search memories, and manage projects.

When the user asks you to do something, use the available tools. Be concise and direct.
When starting engineers, make sure they have a project assigned first.
Report results clearly — show names, statuses, and relevant details.`;

// Tool definitions for Claude API
const TOOLS = [
  {
    name: 'list_projects',
    description: 'List all projects with their repos and engineer counts',
    input_schema: { type: 'object' as const, properties: {}, required: [] as string[] },
  },
  {
    name: 'create_project',
    description: 'Create a new project',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Project name' },
        repos: { type: 'array', items: { type: 'object', properties: { url: { type: 'string' }, branch: { type: 'string' }, mode: { type: 'string', enum: ['push', 'pull'] } } }, description: 'Git repositories' },
        claude_md: { type: 'string', description: 'CLAUDE.md content for engineers on this project' },
      },
      required: ['name'],
    },
  },
  {
    name: 'list_engineers',
    description: 'List all engineers with their status (running/stopped)',
    input_schema: { type: 'object' as const, properties: {}, required: [] as string[] },
  },
  {
    name: 'create_engineer',
    description: 'Create a new engineer definition',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Unique engineer name (e.g. "poly-analyst")' },
        project_id: { type: 'string', description: 'Project ID to assign to' },
        role: { type: 'string', description: 'Role description (e.g. "backend", "research")' },
        image: { type: 'string', description: 'Docker image (default: agentcore:minimal)' },
        ssh_port: { type: 'number', description: 'SSH port to expose' },
        api_port: { type: 'number', description: 'API port to expose' },
      },
      required: ['name'],
    },
  },
  {
    name: 'start_engineer',
    description: 'Start an engineer (launch their Docker container)',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Engineer name' },
      },
      required: ['name'],
    },
  },
  {
    name: 'stop_engineer',
    description: 'Stop a running engineer',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Engineer name' },
      },
      required: ['name'],
    },
  },
  {
    name: 'create_task',
    description: 'Create a task in HiveMindDB for engineers to work on',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Task title' },
        description: { type: 'string', description: 'Task description' },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], description: 'Priority level' },
        assigned_to: { type: 'string', description: 'Engineer name to assign to' },
        required_capabilities: { type: 'array', items: { type: 'string' }, description: 'Capabilities needed' },
      },
      required: ['title'],
    },
  },
  {
    name: 'list_tasks',
    description: 'List tasks from HiveMindDB',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string', enum: ['pending', 'claimed', 'in_progress', 'completed', 'failed'] },
        assigned_to: { type: 'string', description: 'Filter by engineer name' },
      },
    },
  },
  {
    name: 'search_memory',
    description: 'Search agent memories in HiveMindDB',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search query' },
        agent_id: { type: 'string', description: 'Filter by agent/engineer name' },
        limit: { type: 'number', description: 'Max results (default 10)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'list_agents',
    description: 'List agents registered in HiveMindDB',
    input_schema: { type: 'object' as const, properties: {}, required: [] as string[] },
  },
  {
    name: 'send_command',
    description: 'Execute a command inside a running engineer container',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Engineer name' },
        command: { type: 'string', description: 'Command to execute' },
      },
      required: ['name', 'command'],
    },
  },
  {
    name: 'get_logs',
    description: 'Get recent logs from an engineer container',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Engineer name' },
        tail: { type: 'number', description: 'Number of lines (default 100)' },
      },
      required: ['name'],
    },
  },
];

// Tool execution
async function executeTool(name: string, input: Record<string, any>): Promise<string> {
  switch (name) {
    case 'list_projects': {
      const projects = listProjects();
      const engineers = listEngineers();
      const result = projects.map(p => ({
        ...p,
        repos: JSON.parse(p.repos),
        engineer_count: engineers.filter(e => e.project_id === p.id).length,
      }));
      return JSON.stringify(result, null, 2);
    }

    case 'create_project': {
      const project = createProject({
        id: nanoid(10),
        name: input.name,
        repos: input.repos ? JSON.stringify(input.repos) : '[]',
        claude_md: input.claude_md,
      });
      return JSON.stringify({ ...project, repos: JSON.parse(project.repos) }, null, 2);
    }

    case 'list_engineers': {
      const engineers = listEngineers();
      const results = await Promise.all(
        engineers.map(async (e) => {
          const status = await dockerOps.getEngineerStatus(e);
          return {
            id: e.id,
            name: e.name,
            project_id: e.project_id,
            role: e.role,
            image: e.image,
            running: status.running,
            container_id: status.containerId,
            uptime: status.uptime,
            ssh_port: e.ssh_port,
            api_port: e.api_port,
          };
        })
      );
      return JSON.stringify(results, null, 2);
    }

    case 'create_engineer': {
      const engineer = createEngineer({
        id: nanoid(10),
        name: input.name,
        project_id: input.project_id,
        role: input.role,
        image: input.image,
        ssh_port: input.ssh_port,
        api_port: input.api_port,
      });
      return JSON.stringify(engineer, null, 2);
    }

    case 'start_engineer': {
      const engineer = getEngineerByName(input.name);
      if (!engineer) return JSON.stringify({ error: `Engineer "${input.name}" not found` });
      const project = engineer.project_id ? getProject(engineer.project_id) ?? null : null;
      const containerId = await dockerOps.startEngineer(engineer, project);
      updateEngineer(engineer.id, { container_id: containerId, status: 'running' });
      return JSON.stringify({ success: true, name: engineer.name, container_id: containerId.slice(0, 12) });
    }

    case 'stop_engineer': {
      const engineer = getEngineerByName(input.name);
      if (!engineer) return JSON.stringify({ error: `Engineer "${input.name}" not found` });
      await dockerOps.stopEngineer(engineer);
      updateEngineer(engineer.id, { container_id: null, status: 'stopped' });
      return JSON.stringify({ success: true, name: engineer.name, status: 'stopped' });
    }

    case 'create_task': {
      const body: any = {
        title: input.title,
        description: input.description || '',
        priority: input.priority || 'medium',
      };
      if (input.assigned_to) body.assigned_to = input.assigned_to;
      if (input.required_capabilities) body.required_capabilities = input.required_capabilities;

      const resp = await fetch(`${getHivemindUrl()}/api/v1/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!resp.ok) return JSON.stringify({ error: `HiveMindDB error: ${resp.status} ${await resp.text()}` });
      return await resp.text();
    }

    case 'list_tasks': {
      const params = new URLSearchParams();
      if (input.status) params.set('status', input.status);
      if (input.assigned_to) params.set('assigned_to', input.assigned_to);
      const resp = await fetch(`${getHivemindUrl()}/api/v1/tasks?${params}`);
      if (!resp.ok) return JSON.stringify({ error: `HiveMindDB error: ${resp.status}` });
      return await resp.text();
    }

    case 'search_memory': {
      const body: any = { query: input.query, limit: input.limit || 10 };
      if (input.agent_id) body.agent_id = input.agent_id;
      const resp = await fetch(`${getHivemindUrl()}/api/v1/memory/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!resp.ok) return JSON.stringify({ error: `HiveMindDB error: ${resp.status}` });
      return await resp.text();
    }

    case 'list_agents': {
      const resp = await fetch(`${getHivemindUrl()}/api/v1/agents`);
      if (!resp.ok) return JSON.stringify({ error: `HiveMindDB error: ${resp.status}` });
      return await resp.text();
    }

    case 'send_command': {
      const engineer = getEngineerByName(input.name);
      if (!engineer) return JSON.stringify({ error: `Engineer "${input.name}" not found` });
      // Use container hostname on the Docker network (works from inside Docker)
      // Falls back to localhost:api_port for host-based runs
      const containerName = `crewnest-${engineer.name}`;
      const apiUrl = process.env.DOCKER_NETWORK
        ? `http://${containerName}:8080`
        : `http://localhost:${engineer.api_port || 8080}`;
      const resp = await fetch(`${apiUrl}/exec`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: input.command }),
      });
      if (!resp.ok) return JSON.stringify({ error: `AgentCore error: ${resp.status}` });
      return await resp.text();
    }

    case 'get_logs': {
      const engineer = getEngineerByName(input.name);
      if (!engineer) return JSON.stringify({ error: `Engineer "${input.name}" not found` });
      const logs = await dockerOps.getEngineerLogs(engineer, input.tail || 100);
      return logs || '(no logs)';
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

// Main chat function — Claude API tool-use loop
export async function chat(userMessage: string): Promise<string> {
  // Save user message
  addChatMessage({ role: 'user', content: userMessage });

  // Build conversation from recent history
  const history = getChatHistory(50).reverse();
  const messages = history
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  // Ensure we have at least the current message
  if (messages.length === 0 || messages[messages.length - 1].content !== userMessage) {
    messages.push({ role: 'user', content: userMessage });
  }

  // Tool-use loop
  let response = await callClaude(messages);
  let maxIterations = 10;

  while (maxIterations-- > 0) {
    // Check if response has tool_use blocks
    const toolUseBlocks = response.content.filter((b: any) => b.type === 'tool_use');
    if (toolUseBlocks.length === 0) break;

    // Execute all tool calls
    const toolResults = await Promise.all(
      toolUseBlocks.map(async (block: any) => ({
        type: 'tool_result' as const,
        tool_use_id: block.id,
        content: await executeTool(block.name, block.input),
      }))
    );

    // Add assistant message + tool results
    messages.push({ role: 'assistant', content: response.content });
    messages.push({ role: 'user', content: toolResults as any });

    // Call Claude again with results
    response = await callClaude(messages);
  }

  // Extract text response
  const textBlocks = response.content.filter((b: any) => b.type === 'text');
  const assistantText = textBlocks.map((b: any) => b.text).join('\n');

  // Save assistant response
  addChatMessage({ role: 'assistant', content: assistantText });

  return assistantText;
}

async function callClaude(messages: any[]): Promise<any> {
  const codegateUrl = getCodegateUrl();
  const apiKey = getCodegateApiKey();
  const model = getOrchestratorModel();

  const resp = await fetch(`${codegateUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Claude API error: ${resp.status} ${errText}`);
  }

  return resp.json();
}
