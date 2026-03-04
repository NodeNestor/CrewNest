import { Hono } from 'hono';
import { getSetting } from '../db.js';

const app = new Hono();

function getHivemindUrl(): string {
  return getSetting('hivemind_url') || process.env.HIVEMINDDB_URL || 'http://localhost:8100';
}

// Proxy helper
async function hivemindFetch(path: string, options?: RequestInit): Promise<Response> {
  const url = `${getHivemindUrl()}/api/v1${path}`;
  return fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
}

// --- Memory ---

// Search memories
app.post('/memory/search', async (c) => {
  const body = await c.req.json();
  try {
    const resp = await hivemindFetch('/memory/search', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (!resp.ok) return c.json({ error: `HiveMindDB: ${resp.status}` }, resp.status as any);
    return c.json(await resp.json());
  } catch (err: any) {
    return c.json({ error: `Cannot reach HiveMindDB: ${err.message}` }, 503);
  }
});

// Get memory by ID
app.get('/memory/:id', async (c) => {
  try {
    const resp = await hivemindFetch(`/memory/${c.req.param('id')}`);
    if (!resp.ok) return c.json({ error: 'Not found' }, 404);
    return c.json(await resp.json());
  } catch (err: any) {
    return c.json({ error: `Cannot reach HiveMindDB: ${err.message}` }, 503);
  }
});

// Add memory
app.post('/memory', async (c) => {
  const body = await c.req.json();
  try {
    const resp = await hivemindFetch('/memory', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (!resp.ok) return c.json({ error: `HiveMindDB: ${resp.status}` }, resp.status as any);
    return c.json(await resp.json());
  } catch (err: any) {
    return c.json({ error: `Cannot reach HiveMindDB: ${err.message}` }, 503);
  }
});

// Delete memory
app.delete('/memory/:id', async (c) => {
  try {
    const resp = await hivemindFetch(`/memory/${c.req.param('id')}`, { method: 'DELETE' });
    if (!resp.ok) return c.json({ error: `HiveMindDB: ${resp.status}` }, resp.status as any);
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: `Cannot reach HiveMindDB: ${err.message}` }, 503);
  }
});

// --- Agents ---

app.get('/agents', async (c) => {
  try {
    const resp = await hivemindFetch('/agents');
    if (!resp.ok) return c.json({ error: `HiveMindDB: ${resp.status}` }, resp.status as any);
    return c.json(await resp.json());
  } catch (err: any) {
    return c.json({ error: `Cannot reach HiveMindDB: ${err.message}` }, 503);
  }
});

app.get('/agents/:id', async (c) => {
  try {
    const resp = await hivemindFetch(`/agents/${c.req.param('id')}`);
    if (!resp.ok) return c.json({ error: 'Not found' }, 404);
    return c.json(await resp.json());
  } catch (err: any) {
    return c.json({ error: `Cannot reach HiveMindDB: ${err.message}` }, 503);
  }
});

// --- Tasks ---

app.get('/tasks', async (c) => {
  const params = new URLSearchParams();
  const status = c.req.query('status');
  const assigned = c.req.query('assigned_to');
  if (status) params.set('status', status);
  if (assigned) params.set('assigned_to', assigned);
  try {
    const resp = await hivemindFetch(`/tasks?${params}`);
    if (!resp.ok) return c.json({ error: `HiveMindDB: ${resp.status}` }, resp.status as any);
    return c.json(await resp.json());
  } catch (err: any) {
    return c.json({ error: `Cannot reach HiveMindDB: ${err.message}` }, 503);
  }
});

app.post('/tasks', async (c) => {
  const body = await c.req.json();
  try {
    const resp = await hivemindFetch('/tasks', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (!resp.ok) return c.json({ error: `HiveMindDB: ${resp.status}` }, resp.status as any);
    return c.json(await resp.json());
  } catch (err: any) {
    return c.json({ error: `Cannot reach HiveMindDB: ${err.message}` }, 503);
  }
});

// --- Knowledge Graph ---

app.get('/entities', async (c) => {
  try {
    const resp = await hivemindFetch('/entities');
    if (!resp.ok) return c.json({ error: `HiveMindDB: ${resp.status}` }, resp.status as any);
    return c.json(await resp.json());
  } catch (err: any) {
    return c.json({ error: `Cannot reach HiveMindDB: ${err.message}` }, 503);
  }
});

// --- Health ---

app.get('/health', async (c) => {
  try {
    const resp = await fetch(`${getHivemindUrl()}/api/v1/health`);
    if (!resp.ok) return c.json({ ok: false, status: resp.status });
    return c.json({ ok: true, ...(await resp.json()) });
  } catch (err: any) {
    return c.json({ ok: false, error: err.message }, 503);
  }
});

export default app;
