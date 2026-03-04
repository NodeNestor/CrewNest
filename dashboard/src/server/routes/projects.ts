import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import { listProjects, getProject, createProject, updateProject, deleteProject, listEngineers } from '../db.js';

const app = new Hono();

// List all projects
app.get('/', (c) => {
  const projects = listProjects();
  const engineers = listEngineers();
  const result = projects.map(p => ({
    ...p,
    repos: JSON.parse(p.repos),
    env_vars: JSON.parse(p.env_vars),
    engineer_count: engineers.filter(e => e.project_id === p.id).length,
  }));
  return c.json(result);
});

// Get single project
app.get('/:id', (c) => {
  const project = getProject(c.req.param('id'));
  if (!project) return c.json({ error: 'Not found' }, 404);
  return c.json({
    ...project,
    repos: JSON.parse(project.repos),
    env_vars: JSON.parse(project.env_vars),
  });
});

// Create project
app.post('/', async (c) => {
  const body = await c.req.json();
  if (!body.name) return c.json({ error: 'name is required' }, 400);

  const project = createProject({
    id: nanoid(10),
    name: body.name,
    repos: body.repos ? JSON.stringify(body.repos) : '[]',
    claude_md: body.claude_md,
    env_vars: body.env_vars ? JSON.stringify(body.env_vars) : '{}',
  });

  return c.json({
    ...project,
    repos: JSON.parse(project.repos),
    env_vars: JSON.parse(project.env_vars),
  }, 201);
});

// Update project
app.put('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();

  const updates: Record<string, string> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.repos !== undefined) updates.repos = JSON.stringify(body.repos);
  if (body.claude_md !== undefined) updates.claude_md = body.claude_md;
  if (body.env_vars !== undefined) updates.env_vars = JSON.stringify(body.env_vars);

  const project = updateProject(id, updates);
  if (!project) return c.json({ error: 'Not found' }, 404);

  return c.json({
    ...project,
    repos: JSON.parse(project.repos),
    env_vars: JSON.parse(project.env_vars),
  });
});

// Delete project
app.delete('/:id', (c) => {
  const deleted = deleteProject(c.req.param('id'));
  if (!deleted) return c.json({ error: 'Not found' }, 404);
  return c.json({ success: true });
});

export default app;
