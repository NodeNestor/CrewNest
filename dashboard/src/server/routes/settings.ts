import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import {
  getAllSettings, getSetting, setSetting, deleteSetting,
  listCredentials, getCredential, createCredential, updateCredential, deleteCredential,
} from '../db.js';

const app = new Hono();

// --- Settings (key-value) ---

app.get('/', (c) => {
  const settings = getAllSettings();
  // Return as object for easy consumption
  const obj: Record<string, string> = {};
  for (const s of settings) obj[s.key] = s.value;
  return c.json(obj);
});

app.put('/', async (c) => {
  const body = await c.req.json();
  // Accept { key: value, key: value, ... }
  for (const [key, value] of Object.entries(body)) {
    if (typeof value === 'string') {
      setSetting(key, value);
    } else if (value === null) {
      deleteSetting(key);
    }
  }
  const settings = getAllSettings();
  const obj: Record<string, string> = {};
  for (const s of settings) obj[s.key] = s.value;
  return c.json(obj);
});

app.get('/:key', (c) => {
  const value = getSetting(c.req.param('key'));
  if (value === null) return c.json({ error: 'Not found' }, 404);
  return c.json({ key: c.req.param('key'), value });
});

app.delete('/:key', (c) => {
  deleteSetting(c.req.param('key'));
  return c.json({ success: true });
});

// --- Credentials ---

app.get('/credentials/list', (c) => {
  const creds = listCredentials();
  // Mask values in response
  return c.json(creds.map(cr => ({
    ...cr,
    value: cr.value.slice(0, 8) + '...' + cr.value.slice(-4),
  })));
});

app.post('/credentials', async (c) => {
  const body = await c.req.json();
  if (!body.name || !body.type || !body.value) {
    return c.json({ error: 'name, type, and value are required' }, 400);
  }

  const cred = createCredential({
    id: nanoid(10),
    name: body.name,
    type: body.type,
    value: body.value,
    scope: body.scope,
    project_id: body.project_id,
  });

  return c.json({
    ...cred,
    value: cred.value.slice(0, 8) + '...' + cred.value.slice(-4),
  }, 201);
});

app.put('/credentials/:id', async (c) => {
  const body = await c.req.json();
  const cred = updateCredential(c.req.param('id'), body);
  if (!cred) return c.json({ error: 'Not found' }, 404);
  return c.json({
    ...cred,
    value: cred.value.slice(0, 8) + '...' + cred.value.slice(-4),
  });
});

app.delete('/credentials/:id', (c) => {
  const deleted = deleteCredential(c.req.param('id'));
  if (!deleted) return c.json({ error: 'Not found' }, 404);
  return c.json({ success: true });
});

export default app;
