const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

// --- Types ---

export interface Project {
  id: string;
  name: string;
  repos: Array<{ url: string; branch?: string; mode?: string }>;
  claude_md: string | null;
  env_vars: Record<string, string>;
  engineer_count?: number;
  created_at: string;
}

export interface Engineer {
  id: string;
  name: string;
  project_id: string | null;
  agent_type: string;
  image: string;
  role: string | null;
  capabilities: string[];
  container_id: string | null;
  status: string;
  ssh_port: number | null;
  api_port: number | null;
  vnc_port: number | null;
  env_overrides: Record<string, string>;
  live_status?: {
    running: boolean;
    containerId?: string;
    uptime?: string;
    health?: string;
  };
  created_at: string;
}

export interface ChatMessage {
  id: number;
  role: string;
  content: string;
  tool_calls: string | null;
  created_at: string;
}

export interface StatusInfo {
  docker: boolean;
  hivemind: boolean;
  codegate: boolean;
  running_engineers: number;
  containers: Array<{ name: string; id: string; status: string; image: string }>;
}

// --- Projects ---

export const fetchProjects = () => request<Project[]>('/projects');
export const fetchProject = (id: string) => request<Project>(`/projects/${id}`);
export const createProject = (data: { name: string; repos?: any[]; claude_md?: string }) =>
  request<Project>('/projects', { method: 'POST', body: JSON.stringify(data) });
export const updateProject = (id: string, data: Partial<Project>) =>
  request<Project>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteProject = (id: string) =>
  request<{ success: boolean }>(`/projects/${id}`, { method: 'DELETE' });

// --- Engineers ---

export interface ImageTier {
  value: string;
  label: string;
  description: string;
  hasVnc: boolean;
}

export const fetchImageTiers = () => request<ImageTier[]>('/engineers/images');
export const fetchEngineers = () => request<Engineer[]>('/engineers');
export const fetchEngineer = (id: string) => request<Engineer>(`/engineers/${id}`);
export const createEngineer = (data: { name: string; project_id?: string; role?: string; image?: string }) =>
  request<Engineer>('/engineers', { method: 'POST', body: JSON.stringify(data) });
export const updateEngineer = (id: string, data: Partial<Engineer>) =>
  request<Engineer>(`/engineers/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteEngineer = (id: string) =>
  request<{ success: boolean }>(`/engineers/${id}`, { method: 'DELETE' });
export const startEngineer = (id: string) =>
  request<{ success: boolean; container_id: string }>(`/engineers/${id}/start`, { method: 'POST' });
export const stopEngineer = (id: string) =>
  request<{ success: boolean }>(`/engineers/${id}/stop`, { method: 'POST' });
export const restartEngineer = (id: string) =>
  request<{ success: boolean; container_id: string }>(`/engineers/${id}/restart`, { method: 'POST' });
export const fetchEngineerLogs = (id: string, tail = 100) =>
  request<{ logs: string }>(`/engineers/${id}/logs?tail=${tail}`);
export const ensureOrchestrator = () =>
  request<Engineer & { created: boolean }>('/engineers/orchestrator/ensure', { method: 'POST' });

// --- Chat ---

export const sendChatMessage = (message: string) =>
  request<{ response: string }>('/chat', { method: 'POST', body: JSON.stringify({ message }) });
export const fetchChatHistory = (limit = 100) =>
  request<ChatMessage[]>(`/chat/history?limit=${limit}`);
export const clearChatHistory = () =>
  request<{ success: boolean }>('/chat/history', { method: 'DELETE' });

// --- Status ---

export const fetchStatus = () => request<StatusInfo>('/status');

// --- Settings ---

export const fetchSettings = () => request<Record<string, string>>('/settings');
export const updateSettings = (data: Record<string, string | null>) =>
  request<Record<string, string>>('/settings', { method: 'PUT', body: JSON.stringify(data) });

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

export const fetchCredentials = () => request<Credential[]>('/settings/credentials/list');
export const createCredential = (data: { name: string; type: string; value: string; scope?: string; project_id?: string }) =>
  request<Credential>('/settings/credentials', { method: 'POST', body: JSON.stringify(data) });
export const deleteCredential = (id: string) =>
  request<{ success: boolean }>(`/settings/credentials/${id}`, { method: 'DELETE' });

// --- HiveMindDB ---

export interface HiveMindMemory {
  id: string;
  content: string;
  agent_id?: string;
  tags?: string[];
  confidence?: number;
  metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export interface HiveMindSearchResult {
  memory: HiveMindMemory;
  score: number;
}

export interface HiveMindAgent {
  id: string;
  name?: string;
  agent_type?: string;
  capabilities?: string[];
  status?: string;
  last_heartbeat?: string;
}

export interface HiveMindTask {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority?: string;
  assigned_to?: string;
  created_at?: string;
}

export const searchMemories = (query: string, options?: { agent_id?: string; tags?: string[]; limit?: number }) =>
  request<HiveMindSearchResult[]>('/hivemind/memory/search', {
    method: 'POST',
    body: JSON.stringify({ query, ...options }),
  });

export const fetchHivemindAgents = () => request<HiveMindAgent[]>('/hivemind/agents');
export const fetchHivemindTasks = (status?: string, assigned_to?: string) => {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (assigned_to) params.set('assigned_to', assigned_to);
  return request<HiveMindTask[]>(`/hivemind/tasks?${params}`);
};
export const createHivemindTask = (data: { title: string; description?: string; priority?: string; assigned_to?: string }) =>
  request<HiveMindTask>('/hivemind/tasks', { method: 'POST', body: JSON.stringify(data) });
export const fetchHivemindHealth = () => request<{ ok: boolean; [key: string]: any }>('/hivemind/health');
