#!/usr/bin/env node
// CrewNest MCP Server — gives Claude Code control over the CrewNest platform
// Injected into the orchestrator container and loaded as a Claude Code MCP server

const http = require('http');
const readline = require('readline');

const API_BASE = process.env.CREWNEST_API || 'http://crewnest:3000';

// --- HTTP helper ---
function apiRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${API_BASE}/api${path}`);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(data); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// --- Tool definitions ---
const TOOLS = [
  {
    name: 'crewnest_list_engineers',
    description: 'List all engineers in CrewNest with their status (running/stopped), ports, roles, and project assignments.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'crewnest_start_engineer',
    description: 'Start an engineer container by name. The engineer must already be created.',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string', description: 'Engineer name' } },
      required: ['name'],
    },
  },
  {
    name: 'crewnest_stop_engineer',
    description: 'Stop a running engineer container by name.',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string', description: 'Engineer name' } },
      required: ['name'],
    },
  },
  {
    name: 'crewnest_create_engineer',
    description: 'Create a new engineer. Ports are auto-allocated. Available images: agentcore:minimal (Claude Code only), agentcore:ubuntu (full desktop + Chrome + VNC), agentcore:kali (security tools + desktop).',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Unique engineer name (e.g. poly-analyst)' },
        role: { type: 'string', description: 'Role description (e.g. backend, research, frontend)' },
        image: { type: 'string', description: 'Docker image: agentcore:minimal (default, terminal only), agentcore:ubuntu (desktop + VNC), agentcore:kali (security + desktop)', default: 'agentcore:minimal' },
        project_id: { type: 'string', description: 'Project ID to assign to' },
      },
      required: ['name'],
    },
  },
  {
    name: 'crewnest_list_projects',
    description: 'List all projects in CrewNest with their repos and engineer count.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'crewnest_create_project',
    description: 'Create a new project with optional repos and CLAUDE.md.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Project name' },
        repos: { type: 'array', items: { type: 'object', properties: { url: { type: 'string' }, branch: { type: 'string' }, mode: { type: 'string' } } }, description: 'Git repos to clone' },
        claude_md: { type: 'string', description: 'CLAUDE.md content for this project' },
      },
      required: ['name'],
    },
  },
  {
    name: 'crewnest_create_task',
    description: 'Create a task in HiveMindDB that can be assigned to engineers.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Task title' },
        description: { type: 'string', description: 'Detailed task description' },
        priority: { type: 'string', description: 'Priority: low, medium, high, critical' },
        assigned_to: { type: 'string', description: 'Agent ID to assign to' },
      },
      required: ['title'],
    },
  },
  {
    name: 'crewnest_list_tasks',
    description: 'List tasks from HiveMindDB, optionally filtered by status or assignee.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Filter by status (pending, in_progress, completed, failed)' },
        assigned_to: { type: 'string', description: 'Filter by assigned agent ID' },
      },
      required: [],
    },
  },
  {
    name: 'crewnest_search_memory',
    description: 'Search agent memories in HiveMindDB using semantic + keyword search.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        agent_id: { type: 'string', description: 'Filter by agent ID' },
        limit: { type: 'number', description: 'Max results (default 20)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'crewnest_platform_status',
    description: 'Get CrewNest platform status: Docker, HiveMindDB, CodeGate connectivity, and running engineer count.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'crewnest_get_engineer_logs',
    description: 'Get recent logs from an engineer container.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Engineer name' },
        tail: { type: 'number', description: 'Number of log lines (default 50)' },
      },
      required: ['name'],
    },
  },
];

// --- Tool execution ---
async function executeTool(name, args) {
  try {
    switch (name) {
      case 'crewnest_list_engineers': {
        const engineers = await apiRequest('GET', '/engineers');
        return JSON.stringify(engineers, null, 2);
      }
      case 'crewnest_start_engineer': {
        const engineers = await apiRequest('GET', '/engineers');
        const eng = engineers.find(e => e.name === args.name);
        if (!eng) return `Engineer "${args.name}" not found. Available: ${engineers.map(e => e.name).join(', ')}`;
        const result = await apiRequest('POST', `/engineers/${eng.id}/start`);
        return JSON.stringify(result);
      }
      case 'crewnest_stop_engineer': {
        const engineers = await apiRequest('GET', '/engineers');
        const eng = engineers.find(e => e.name === args.name);
        if (!eng) return `Engineer "${args.name}" not found. Available: ${engineers.map(e => e.name).join(', ')}`;
        const result = await apiRequest('POST', `/engineers/${eng.id}/stop`);
        return JSON.stringify(result);
      }
      case 'crewnest_create_engineer': {
        const result = await apiRequest('POST', '/engineers', args);
        return JSON.stringify(result, null, 2);
      }
      case 'crewnest_list_projects': {
        const projects = await apiRequest('GET', '/projects');
        return JSON.stringify(projects, null, 2);
      }
      case 'crewnest_create_project': {
        const result = await apiRequest('POST', '/projects', args);
        return JSON.stringify(result, null, 2);
      }
      case 'crewnest_create_task': {
        const result = await apiRequest('POST', '/hivemind/tasks', args);
        return JSON.stringify(result, null, 2);
      }
      case 'crewnest_list_tasks': {
        const params = new URLSearchParams();
        if (args.status) params.set('status', args.status);
        if (args.assigned_to) params.set('assigned_to', args.assigned_to);
        const tasks = await apiRequest('GET', `/hivemind/tasks?${params}`);
        return JSON.stringify(tasks, null, 2);
      }
      case 'crewnest_search_memory': {
        const result = await apiRequest('POST', '/hivemind/memory/search', {
          query: args.query,
          agent_id: args.agent_id,
          limit: args.limit || 20,
        });
        return JSON.stringify(result, null, 2);
      }
      case 'crewnest_platform_status': {
        const status = await apiRequest('GET', '/status');
        return JSON.stringify(status, null, 2);
      }
      case 'crewnest_get_engineer_logs': {
        const engineers = await apiRequest('GET', '/engineers');
        const eng = engineers.find(e => e.name === args.name);
        if (!eng) return `Engineer "${args.name}" not found.`;
        const tail = args.tail || 50;
        const result = await apiRequest('GET', `/engineers/${eng.id}/logs?tail=${tail}`);
        return typeof result === 'string' ? result : result.logs || JSON.stringify(result);
      }
      default:
        return `Unknown tool: ${name}`;
    }
  } catch (err) {
    return `Error: ${err.message}`;
  }
}

// --- MCP Protocol (JSON-RPC 2.0 over stdio) ---
const rl = readline.createInterface({ input: process.stdin, terminal: false });
let buffer = '';

function send(msg) {
  const json = JSON.stringify(msg);
  process.stdout.write(json + '\n');
}

rl.on('line', async (line) => {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }

  if (msg.method === 'initialize') {
    send({
      jsonrpc: '2.0',
      id: msg.id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'crewnest', version: '1.0.0' },
      },
    });
  } else if (msg.method === 'notifications/initialized') {
    // no response needed
  } else if (msg.method === 'tools/list') {
    send({
      jsonrpc: '2.0',
      id: msg.id,
      result: { tools: TOOLS },
    });
  } else if (msg.method === 'tools/call') {
    const { name, arguments: args } = msg.params;
    const text = await executeTool(name, args || {});
    send({
      jsonrpc: '2.0',
      id: msg.id,
      result: {
        content: [{ type: 'text', text }],
      },
    });
  } else if (msg.id !== undefined) {
    send({
      jsonrpc: '2.0',
      id: msg.id,
      error: { code: -32601, message: `Method not found: ${msg.method}` },
    });
  }
});

process.stderr.write('CrewNest MCP server started\n');
