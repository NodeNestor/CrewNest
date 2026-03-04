// @ts-ignore — sql.js has no type declarations
import initSqlJs from 'sql.js';
type Database = any;
import fs from 'fs';
import path from 'path';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'crewnest.db');

let _db: Database | null = null;

async function ensureDb(): Promise<Database> {
  if (_db) return _db;

  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    _db = new SQL.Database(buffer);
  } else {
    _db = new SQL.Database();
  }

  _db.run('PRAGMA foreign_keys = ON');

  _db.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      repos TEXT DEFAULT '[]',
      claude_md TEXT,
      env_vars TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  _db.run(`
    CREATE TABLE IF NOT EXISTS engineers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
      agent_type TEXT DEFAULT 'claude',
      image TEXT DEFAULT 'agentcore:minimal',
      role TEXT,
      capabilities TEXT DEFAULT '[]',
      container_id TEXT,
      status TEXT DEFAULT 'stopped',
      ssh_port INTEGER,
      api_port INTEGER,
      vnc_port INTEGER,
      env_overrides TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  _db.run(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      tool_calls TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  _db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  _db.run(`
    CREATE TABLE IF NOT EXISTS credentials (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      value TEXT NOT NULL,
      scope TEXT DEFAULT 'global',
      project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Migrate: add vnc_port if missing
  try {
    _db.run('SELECT vnc_port FROM engineers LIMIT 1');
  } catch {
    _db.run('ALTER TABLE engineers ADD COLUMN vnc_port INTEGER');
  }

  return _db;
}

function saveDb() {
  if (!_db) return;
  const data = _db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

// Helper: run a query and return all rows
function queryAll(sql: string, params: any[] = []): any[] {
  if (!_db) throw new Error('DB not initialized — call initDatabase() first');
  const stmt = _db.prepare(sql);
  if (params.length) stmt.bind(params);
  const rows: any[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function queryOne(sql: string, params: any[] = []): any | undefined {
  const rows = queryAll(sql, params);
  return rows[0];
}

function exec(sql: string, params: any[] = []): void {
  if (!_db) throw new Error('DB not initialized — call initDatabase() first');
  _db.run(sql, params);
  saveDb();
}

// Initialize on startup
export async function initDatabase(): Promise<void> {
  await ensureDb();
}

// --- Projects ---

export interface Project {
  id: string;
  name: string;
  repos: string;
  claude_md: string | null;
  env_vars: string;
  created_at: string;
}

export function listProjects(): Project[] {
  return queryAll('SELECT * FROM projects ORDER BY created_at DESC') as Project[];
}

export function getProject(id: string): Project | undefined {
  return queryOne('SELECT * FROM projects WHERE id = ?', [id]) as Project | undefined;
}

export function createProject(project: { id: string; name: string; repos?: string; claude_md?: string; env_vars?: string }): Project {
  exec(
    'INSERT INTO projects (id, name, repos, claude_md, env_vars) VALUES (?, ?, ?, ?, ?)',
    [project.id, project.name, project.repos || '[]', project.claude_md || null, project.env_vars || '{}']
  );
  return getProject(project.id)!;
}

export function updateProject(id: string, updates: Partial<Pick<Project, 'name' | 'repos' | 'claude_md' | 'env_vars'>>): Project | undefined {
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const [key, val] of Object.entries(updates)) {
    if (val !== undefined) {
      fields.push(`${key} = ?`);
      values.push(val);
    }
  }
  if (fields.length === 0) return getProject(id);
  values.push(id);
  exec(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`, values);
  return getProject(id);
}

export function deleteProject(id: string): boolean {
  const before = queryAll('SELECT id FROM projects WHERE id = ?', [id]);
  if (before.length === 0) return false;
  exec('DELETE FROM projects WHERE id = ?', [id]);
  return true;
}

// --- Engineers ---

export interface Engineer {
  id: string;
  name: string;
  project_id: string | null;
  agent_type: string;
  image: string;
  role: string | null;
  capabilities: string;
  container_id: string | null;
  status: string;
  ssh_port: number | null;
  api_port: number | null;
  vnc_port: number | null;
  env_overrides: string;
  created_at: string;
}

export function listEngineers(): Engineer[] {
  return queryAll('SELECT * FROM engineers ORDER BY created_at DESC') as Engineer[];
}

export function getEngineer(id: string): Engineer | undefined {
  return queryOne('SELECT * FROM engineers WHERE id = ?', [id]) as Engineer | undefined;
}

export function getEngineerByName(name: string): Engineer | undefined {
  return queryOne('SELECT * FROM engineers WHERE name = ?', [name]) as Engineer | undefined;
}

export function createEngineer(eng: {
  id: string;
  name: string;
  project_id?: string;
  agent_type?: string;
  image?: string;
  role?: string;
  capabilities?: string;
  ssh_port?: number;
  api_port?: number;
  vnc_port?: number;
  env_overrides?: string;
}): Engineer {
  exec(
    `INSERT INTO engineers (id, name, project_id, agent_type, image, role, capabilities, ssh_port, api_port, vnc_port, env_overrides)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      eng.id, eng.name, eng.project_id || null, eng.agent_type || 'claude',
      eng.image || 'agentcore:minimal', eng.role || null, eng.capabilities || '[]',
      eng.ssh_port || null, eng.api_port || null, eng.vnc_port || null, eng.env_overrides || '{}'
    ]
  );
  return getEngineer(eng.id)!;
}

export function updateEngineer(id: string, updates: Partial<Engineer>): Engineer | undefined {
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const [key, val] of Object.entries(updates)) {
    if (val !== undefined && key !== 'id' && key !== 'created_at') {
      fields.push(`${key} = ?`);
      values.push(val);
    }
  }
  if (fields.length === 0) return getEngineer(id);
  values.push(id);
  exec(`UPDATE engineers SET ${fields.join(', ')} WHERE id = ?`, values);
  return getEngineer(id);
}

export function deleteEngineer(id: string): boolean {
  const before = queryAll('SELECT id FROM engineers WHERE id = ?', [id]);
  if (before.length === 0) return false;
  exec('DELETE FROM engineers WHERE id = ?', [id]);
  return true;
}

// --- Chat Messages ---

export interface ChatMessage {
  id: number;
  role: string;
  content: string;
  tool_calls: string | null;
  created_at: string;
}

export function getChatHistory(limit = 100): ChatMessage[] {
  return queryAll('SELECT * FROM chat_messages ORDER BY id DESC LIMIT ?', [limit]) as ChatMessage[];
}

export function addChatMessage(msg: { role: string; content: string; tool_calls?: string }): ChatMessage {
  exec(
    'INSERT INTO chat_messages (role, content, tool_calls) VALUES (?, ?, ?)',
    [msg.role, msg.content, msg.tool_calls || null]
  );
  // Get the last inserted row
  const row = queryOne('SELECT * FROM chat_messages ORDER BY id DESC LIMIT 1');
  return row as ChatMessage;
}

export function clearChatHistory(): void {
  exec('DELETE FROM chat_messages');
}

// --- Settings ---

export interface Setting {
  key: string;
  value: string;
  updated_at: string;
}

export function getSetting(key: string): string | null {
  const row = queryOne('SELECT value FROM settings WHERE key = ?', [key]);
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  exec(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [key, value]
  );
}

export function getAllSettings(): Setting[] {
  return queryAll('SELECT * FROM settings ORDER BY key') as Setting[];
}

export function deleteSetting(key: string): void {
  exec('DELETE FROM settings WHERE key = ?', [key]);
}

// --- Credentials ---

export interface Credential {
  id: string;
  name: string;
  type: string;
  value: string;
  scope: string;
  project_id: string | null;
  created_at: string;
}

export function listCredentials(): Credential[] {
  return queryAll('SELECT * FROM credentials ORDER BY created_at DESC') as Credential[];
}

export function getCredential(id: string): Credential | undefined {
  return queryOne('SELECT * FROM credentials WHERE id = ?', [id]) as Credential | undefined;
}

export function createCredential(cred: {
  id: string;
  name: string;
  type: string;
  value: string;
  scope?: string;
  project_id?: string;
}): Credential {
  exec(
    'INSERT INTO credentials (id, name, type, value, scope, project_id) VALUES (?, ?, ?, ?, ?, ?)',
    [cred.id, cred.name, cred.type, cred.value, cred.scope || 'global', cred.project_id || null]
  );
  return getCredential(cred.id)!;
}

export function updateCredential(id: string, updates: Partial<Pick<Credential, 'name' | 'value' | 'scope' | 'project_id'>>): Credential | undefined {
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const [key, val] of Object.entries(updates)) {
    if (val !== undefined) {
      fields.push(`${key} = ?`);
      values.push(val);
    }
  }
  if (fields.length === 0) return getCredential(id);
  values.push(id);
  exec(`UPDATE credentials SET ${fields.join(', ')} WHERE id = ?`, values);
  return getCredential(id);
}

export function deleteCredential(id: string): boolean {
  const before = queryAll('SELECT id FROM credentials WHERE id = ?', [id]);
  if (before.length === 0) return false;
  exec('DELETE FROM credentials WHERE id = ?', [id]);
  return true;
}

export function getCredentialsByProject(projectId: string): Credential[] {
  return queryAll(
    "SELECT * FROM credentials WHERE project_id = ? OR scope = 'global' ORDER BY scope, created_at DESC",
    [projectId]
  ) as Credential[];
}

export function getGithubToken(projectId?: string): string | null {
  if (projectId) {
    const projCred = queryOne(
      "SELECT value FROM credentials WHERE type = 'github_token' AND project_id = ? LIMIT 1",
      [projectId]
    );
    if (projCred) return projCred.value;
  }
  const globalCred = queryOne(
    "SELECT value FROM credentials WHERE type = 'github_token' AND scope = 'global' LIMIT 1"
  );
  return globalCred?.value ?? process.env.GITHUB_TOKEN ?? null;
}
