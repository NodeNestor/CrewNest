import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from '@hono/node-server/serve-static';
import path from 'path';
import fs from 'fs';

import projectRoutes from './routes/projects.js';
import engineerRoutes from './routes/engineers.js';
import chatRoutes from './routes/chat.js';
import settingsRoutes from './routes/settings.js';
import hivemindRoutes from './routes/hivemind.js';
import { checkDockerConnection, listRunningContainers } from './docker.js';
import { initDatabase, getSetting, setSetting } from './db.js';
import { setupTerminalWebSocket } from './terminal.js';

const app = new Hono();

// CORS for dev
app.use('/api/*', cors());

// API routes
app.route('/api/projects', projectRoutes);
app.route('/api/engineers', engineerRoutes);
app.route('/api/chat', chatRoutes);
app.route('/api/settings', settingsRoutes);
app.route('/api/hivemind', hivemindRoutes);

// Health / status endpoint
app.get('/api/status', async (c) => {
  const dockerOk = await checkDockerConnection();
  const containers = dockerOk ? await listRunningContainers() : [];

  const hivemindUrl = getSetting('hivemind_url') || process.env.HIVEMINDDB_URL || 'http://localhost:8100';
  const codegateUrl = getSetting('codegate_url') || process.env.CODEGATE_URL || 'http://localhost:9212';

  let hivemindOk = false;
  try {
    const resp = await fetch(`${hivemindUrl}/api/v1/health`);
    hivemindOk = resp.ok;
  } catch { /* ignore */ }

  let codegateOk = false;
  try {
    const resp = await fetch(`${codegateUrl}/health`);
    codegateOk = resp.ok;
  } catch { /* ignore */ }

  return c.json({
    docker: dockerOk,
    hivemind: hivemindOk,
    codegate: codegateOk,
    running_engineers: containers.filter(c => c.status === 'running').length,
    containers,
  });
});

// Serve static files in production
const clientDist = path.join(process.cwd(), 'dist', 'client');
if (fs.existsSync(clientDist)) {
  app.use('/*', serveStatic({ root: './dist/client' }));
  // SPA fallback
  app.get('*', (c) => {
    const indexPath = path.join(clientDist, 'index.html');
    const html = fs.readFileSync(indexPath, 'utf-8');
    return c.html(html);
  });
}

const port = parseInt(process.env.PORT || '3000');

async function main() {
  await initDatabase();

  // Seed settings from env vars on first run
  if (!getSetting('codegate_url') && process.env.CODEGATE_URL) {
    setSetting('codegate_url', process.env.CODEGATE_URL);
  }
  if (!getSetting('codegate_api_key') && process.env.CODEGATE_API_KEY) {
    setSetting('codegate_api_key', process.env.CODEGATE_API_KEY);
  }
  if (!getSetting('hivemind_url') && process.env.HIVEMINDDB_URL) {
    setSetting('hivemind_url', process.env.HIVEMINDDB_URL);
  }
  if (!getSetting('default_model') && process.env.DEFAULT_MODEL) {
    setSetting('default_model', process.env.DEFAULT_MODEL);
  }

  console.log(`CrewNest dashboard starting on http://localhost:${port}`);
  const server = serve({ fetch: app.fetch, port });
  setupTerminalWebSocket(server as any);
  console.log('WebSocket terminal proxy ready');
}

main().catch(console.error);
