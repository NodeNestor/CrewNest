import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import {
  listEngineers, getEngineer, getEngineerByName, createEngineer,
  updateEngineer, deleteEngineer, getProject,
} from '../db.js';
import * as dockerOps from '../docker.js';

const app = new Hono();

// List all engineers with live Docker status
app.get('/', async (c) => {
  const engineers = listEngineers();
  const results = await Promise.all(
    engineers.map(async (e) => {
      const status = await dockerOps.getEngineerStatus(e);
      return {
        ...e,
        capabilities: JSON.parse(e.capabilities),
        env_overrides: JSON.parse(e.env_overrides),
        live_status: status,
      };
    })
  );
  return c.json(results);
});

// Create engineer
app.post('/', async (c) => {
  const body = await c.req.json();
  if (!body.name) return c.json({ error: 'name is required' }, 400);

  // Check unique name
  if (getEngineerByName(body.name)) {
    return c.json({ error: `Engineer "${body.name}" already exists` }, 409);
  }

  const engineer = createEngineer({
    id: nanoid(10),
    name: body.name,
    project_id: body.project_id,
    role: body.role,
    image: body.image,
    ssh_port: body.ssh_port,
    api_port: body.api_port,
    vnc_port: body.vnc_port,
    capabilities: body.capabilities ? JSON.stringify(body.capabilities) : '[]',
    env_overrides: body.env_overrides ? JSON.stringify(body.env_overrides) : '{}',
  });

  return c.json({
    ...engineer,
    capabilities: JSON.parse(engineer.capabilities),
    env_overrides: JSON.parse(engineer.env_overrides),
  }, 201);
});

// Ensure orchestrator engineer exists (auto-create if missing)
// MUST be before /:id routes to avoid being caught by them
app.post('/orchestrator/ensure', async (c) => {
  let engineer = getEngineerByName('orchestrator');
  if (engineer) {
    const status = await dockerOps.getEngineerStatus(engineer);
    return c.json({
      ...engineer,
      capabilities: JSON.parse(engineer.capabilities),
      env_overrides: JSON.parse(engineer.env_overrides),
      live_status: status,
      created: false,
    });
  }

  // Auto-create orchestrator with available ports
  engineer = createEngineer({
    id: nanoid(10),
    name: 'orchestrator',
    role: 'orchestrator',
    image: 'agentcore:minimal',
    ssh_port: 2200,
    api_port: 8090,
    capabilities: '["orchestration","task-management","memory-search"]',
  });

  return c.json({
    ...engineer,
    capabilities: JSON.parse(engineer.capabilities),
    env_overrides: JSON.parse(engineer.env_overrides),
    live_status: { running: false },
    created: true,
  }, 201);
});

// Get single engineer
app.get('/:id', async (c) => {
  const engineer = getEngineer(c.req.param('id'));
  if (!engineer) return c.json({ error: 'Not found' }, 404);
  const status = await dockerOps.getEngineerStatus(engineer);
  return c.json({
    ...engineer,
    capabilities: JSON.parse(engineer.capabilities),
    env_overrides: JSON.parse(engineer.env_overrides),
    live_status: status,
  });
});

// Update engineer
app.put('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();

  const updates: Record<string, any> = {};
  for (const key of ['name', 'project_id', 'role', 'image', 'agent_type', 'ssh_port', 'api_port', 'vnc_port']) {
    if (body[key] !== undefined) updates[key] = body[key];
  }
  if (body.capabilities !== undefined) updates.capabilities = JSON.stringify(body.capabilities);
  if (body.env_overrides !== undefined) updates.env_overrides = JSON.stringify(body.env_overrides);

  const engineer = updateEngineer(id, updates);
  if (!engineer) return c.json({ error: 'Not found' }, 404);

  return c.json({
    ...engineer,
    capabilities: JSON.parse(engineer.capabilities),
    env_overrides: JSON.parse(engineer.env_overrides),
  });
});

// Delete engineer
app.delete('/:id', async (c) => {
  const engineer = getEngineer(c.req.param('id'));
  if (!engineer) return c.json({ error: 'Not found' }, 404);

  // Stop container if running
  const status = await dockerOps.getEngineerStatus(engineer);
  if (status.running) {
    await dockerOps.stopEngineer(engineer);
  }

  deleteEngineer(engineer.id);
  return c.json({ success: true });
});

// Start engineer
app.post('/:id/start', async (c) => {
  const engineer = getEngineer(c.req.param('id'));
  if (!engineer) return c.json({ error: 'Not found' }, 404);

  const project = engineer.project_id ? getProject(engineer.project_id) ?? null : null;
  const containerId = await dockerOps.startEngineer(engineer, project);
  updateEngineer(engineer.id, { container_id: containerId, status: 'running' });

  return c.json({ success: true, container_id: containerId.slice(0, 12) });
});

// Stop engineer
app.post('/:id/stop', async (c) => {
  const engineer = getEngineer(c.req.param('id'));
  if (!engineer) return c.json({ error: 'Not found' }, 404);

  await dockerOps.stopEngineer(engineer);
  updateEngineer(engineer.id, { container_id: null, status: 'stopped' });

  return c.json({ success: true });
});

// Restart engineer
app.post('/:id/restart', async (c) => {
  const engineer = getEngineer(c.req.param('id'));
  if (!engineer) return c.json({ error: 'Not found' }, 404);

  await dockerOps.stopEngineer(engineer);
  const project = engineer.project_id ? getProject(engineer.project_id) ?? null : null;
  const containerId = await dockerOps.startEngineer(engineer, project);
  updateEngineer(engineer.id, { container_id: containerId, status: 'running' });

  return c.json({ success: true, container_id: containerId.slice(0, 12) });
});

// Get engineer logs
app.get('/:id/logs', async (c) => {
  const engineer = getEngineer(c.req.param('id'));
  if (!engineer) return c.json({ error: 'Not found' }, 404);

  const tail = parseInt(c.req.query('tail') || '100');
  const logs = await dockerOps.getEngineerLogs(engineer, tail);
  return c.json({ logs });
});

export default app;
