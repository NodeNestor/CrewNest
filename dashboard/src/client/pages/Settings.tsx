import { useEffect, useState } from 'react';
import { Save, Plus, Trash2, Eye, EyeOff, Key, Server, Shield } from 'lucide-react';

interface Credential {
  id: string;
  name: string;
  type: string;
  value: string;
  scope: string;
  project_id: string | null;
}

const SETTING_GROUPS = [
  {
    title: 'Service Connections',
    icon: Server,
    settings: [
      { key: 'hivemind_url', label: 'HiveMindDB URL', placeholder: 'http://hivemind:8100' },
      { key: 'codegate_url', label: 'CodeGate URL', placeholder: 'http://codegate:9212' },
      { key: 'codegate_api_key', label: 'CodeGate API Key', placeholder: 'cgk_...' },
      { key: 'docker_network', label: 'Docker Network', placeholder: 'crewnest-network' },
    ],
  },
  {
    title: 'Defaults',
    icon: Shield,
    settings: [
      { key: 'default_image', label: 'Default Engineer Image', placeholder: 'agentcore:minimal' },
      { key: 'default_model', label: 'Orchestrator Model', placeholder: 'claude-sonnet-4-20250514' },
    ],
  },
];

const CREDENTIAL_TYPES = [
  { value: 'github_token', label: 'GitHub Token (PAT)' },
  { value: 'github_app', label: 'GitHub App Key' },
  { value: 'api_key', label: 'API Key' },
  { value: 'ssh_key', label: 'SSH Private Key' },
];

export default function Settings() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showNewCred, setShowNewCred] = useState(false);
  const [newCred, setNewCred] = useState({ name: '', type: 'github_token', value: '', scope: 'global', project_id: '' });
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});

  const loadSettings = () => {
    fetch('/api/settings').then(r => r.json()).then(setSettings).catch(() => {});
    fetch('/api/settings/credentials/list').then(r => r.json()).then(setCredentials).catch(() => {});
  };

  useEffect(() => { loadSettings(); }, []);

  const handleSettingChange = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setDirty(true);
    setSaved(false);
  };

  const handleSaveSettings = async () => {
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    setDirty(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleCreateCredential = async () => {
    if (!newCred.name || !newCred.value) return;
    await fetch('/api/settings/credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newCred),
    });
    setNewCred({ name: '', type: 'github_token', value: '', scope: 'global', project_id: '' });
    setShowNewCred(false);
    loadSettings();
  };

  const handleDeleteCredential = async (id: string) => {
    await fetch(`/api/settings/credentials/${id}`, { method: 'DELETE' });
    loadSettings();
  };

  return (
    <div className="p-6 overflow-y-auto h-full max-w-3xl mx-auto">
      <h2 className="text-xl font-semibold mb-6">Settings</h2>

      {/* Settings groups */}
      {SETTING_GROUPS.map(group => (
        <div key={group.title} className="mb-8">
          <h3 className="flex items-center gap-2 text-sm font-medium text-gray-400 mb-3 uppercase tracking-wider">
            <group.icon size={14} />
            {group.title}
          </h3>
          <div className="bg-gray-900 border border-gray-800 rounded-lg divide-y divide-gray-800">
            {group.settings.map(s => (
              <div key={s.key} className="flex items-center justify-between px-4 py-3">
                <label className="text-sm text-gray-300 w-48 shrink-0">{s.label}</label>
                <input
                  value={settings[s.key] || ''}
                  onChange={e => handleSettingChange(s.key, e.target.value)}
                  placeholder={s.placeholder}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm
                             placeholder-gray-600 focus:outline-none focus:border-nest-500/50"
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Save button */}
      <div className="mb-8">
        <button
          onClick={handleSaveSettings}
          disabled={!dirty}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-md transition-colors ${
            saved ? 'bg-emerald-600/20 text-emerald-400' :
            dirty ? 'bg-nest-600 hover:bg-nest-500 text-white' :
            'bg-gray-800 text-gray-500 cursor-not-allowed'
          }`}
        >
          <Save size={14} />
          {saved ? 'Saved!' : 'Save Settings'}
        </button>
      </div>

      {/* Credentials */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h3 className="flex items-center gap-2 text-sm font-medium text-gray-400 uppercase tracking-wider">
            <Key size={14} />
            Credentials & Tokens
          </h3>
          <button
            onClick={() => setShowNewCred(!showNewCred)}
            className="flex items-center gap-1 px-2.5 py-1 text-xs bg-nest-600 hover:bg-nest-500 rounded transition-colors"
          >
            <Plus size={12} /> Add Credential
          </button>
        </div>

        {showNewCred && (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input
                placeholder="Name (e.g. My GitHub PAT)"
                value={newCred.name}
                onChange={e => setNewCred({ ...newCred, name: e.target.value })}
                className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-nest-500/50"
              />
              <select
                value={newCred.type}
                onChange={e => setNewCred({ ...newCred, type: e.target.value })}
                className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-nest-500/50"
              >
                {CREDENTIAL_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <input
              placeholder="Token / Key value"
              type="password"
              value={newCred.value}
              onChange={e => setNewCred({ ...newCred, value: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-nest-500/50"
            />
            <div className="grid grid-cols-2 gap-3">
              <select
                value={newCred.scope}
                onChange={e => setNewCred({ ...newCred, scope: e.target.value })}
                className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-nest-500/50"
              >
                <option value="global">Global (all projects)</option>
                <option value="project">Project-specific</option>
              </select>
              {newCred.scope === 'project' && (
                <input
                  placeholder="Project ID"
                  value={newCred.project_id}
                  onChange={e => setNewCred({ ...newCred, project_id: e.target.value })}
                  className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-nest-500/50"
                />
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={handleCreateCredential} className="px-3 py-1.5 text-sm bg-nest-600 hover:bg-nest-500 rounded transition-colors">Save</button>
              <button onClick={() => setShowNewCred(false)} className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 rounded transition-colors">Cancel</button>
            </div>
          </div>
        )}

        <div className="bg-gray-900 border border-gray-800 rounded-lg divide-y divide-gray-800">
          {credentials.length === 0 && (
            <p className="px-4 py-6 text-sm text-gray-600 text-center">
              No credentials configured. Add a GitHub token to enable repo access for engineers.
            </p>
          )}
          {credentials.map(cred => (
            <div key={cred.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <Key size={14} className="text-gray-500" />
                <div>
                  <p className="text-sm text-gray-200">{cred.name}</p>
                  <p className="text-xs text-gray-500">
                    {CREDENTIAL_TYPES.find(t => t.value === cred.type)?.label || cred.type}
                    {' '}&middot;{' '}
                    {cred.scope === 'global' ? 'Global' : `Project: ${cred.project_id}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowValues(prev => ({ ...prev, [cred.id]: !prev[cred.id] }))}
                  className="text-gray-500 hover:text-gray-300"
                >
                  {showValues[cred.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                <code className="text-xs text-gray-500 font-mono">
                  {showValues[cred.id] ? cred.value : '••••••••'}
                </code>
                <button
                  onClick={() => handleDeleteCredential(cred.id)}
                  className="text-gray-600 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
