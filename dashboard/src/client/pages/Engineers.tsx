import { useEffect, useState } from 'react';
import { Plus, X, Terminal as TermIcon, Monitor, FileText, Info } from 'lucide-react';
import EngineerCard from '../components/EngineerCard';
import TerminalView from '../components/Terminal';
import VncViewer from '../components/VncViewer';
import {
  fetchEngineers, fetchProjects, createEngineer,
  startEngineer, stopEngineer, restartEngineer, deleteEngineer, fetchEngineerLogs,
  type Engineer, type Project,
} from '../lib/api';

type DetailTab = 'info' | 'terminal' | 'vnc' | 'logs';

export default function Engineers() {
  const [engineers, setEngineers] = useState<Engineer[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState<Engineer | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('info');
  const [logs, setLogs] = useState('');
  const [form, setForm] = useState({
    name: '', project_id: '', role: '', image: 'agentcore:minimal',
    ssh_port: '', api_port: '', vnc_port: '',
  });

  const load = () => {
    fetchEngineers().then(setEngineers).catch(() => {});
    fetchProjects().then(setProjects).catch(() => {});
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleCreate = async () => {
    if (!form.name) return;
    await createEngineer({
      name: form.name,
      project_id: form.project_id || undefined,
      role: form.role || undefined,
      image: form.image,
      ssh_port: form.ssh_port ? parseInt(form.ssh_port) : undefined,
      api_port: form.api_port ? parseInt(form.api_port) : undefined,
      vnc_port: form.vnc_port ? parseInt(form.vnc_port) : undefined,
    });
    setForm({ name: '', project_id: '', role: '', image: 'agentcore:minimal', ssh_port: '', api_port: '', vnc_port: '' });
    setShowModal(false);
    load();
  };

  const handleStart = async (id: string) => {
    try { await startEngineer(id); } catch (err: any) { alert(`Failed to start: ${err.message}`); }
    load();
  };
  const handleStop = async (id: string) => { await stopEngineer(id); load(); };
  const handleRestart = async (id: string) => { await restartEngineer(id); load(); };

  const handleSelect = async (engineer: Engineer) => {
    setSelected(engineer);
    setDetailTab('info');
    try {
      const { logs: l } = await fetchEngineerLogs(engineer.id);
      setLogs(l);
    } catch { setLogs('(could not fetch logs)'); }
  };

  const handleDelete = async (id: string) => {
    await deleteEngineer(id);
    setSelected(null);
    load();
  };

  const isRunning = selected?.live_status?.running ?? selected?.status === 'running';

  const TABS: { id: DetailTab; label: string; icon: typeof Info; needsRunning?: boolean; needsVnc?: boolean }[] = [
    { id: 'info', label: 'Info', icon: Info },
    { id: 'terminal', label: 'Terminal', icon: TermIcon, needsRunning: true },
    { id: 'vnc', label: 'Desktop', icon: Monitor, needsVnc: true },
    { id: 'logs', label: 'Logs', icon: FileText },
  ];

  return (
    <div className="flex h-full">
      {/* Grid */}
      <div className={`flex-1 overflow-y-auto p-6 ${selected ? 'max-w-[55%]' : ''}`}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Engineers</h2>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-nest-600 hover:bg-nest-500 rounded-md transition-colors"
          >
            <Plus size={14} /> New Engineer
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {engineers.map(e => (
            <EngineerCard key={e.id} engineer={e}
              onStart={handleStart} onStop={handleStop} onRestart={handleRestart} onClick={handleSelect} />
          ))}
          {engineers.length === 0 && (
            <p className="text-gray-600 text-sm col-span-full">No engineers yet. Create one to get started.</p>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="w-[45%] border-l border-gray-800 bg-gray-900/50 flex flex-col">
          <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between shrink-0">
            <h3 className="font-medium">{selected.name}</h3>
            <div className="flex items-center gap-2">
              <button onClick={() => handleDelete(selected.id)} className="text-xs text-red-400 hover:text-red-300">Delete</button>
              <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-gray-300"><X size={16} /></button>
            </div>
          </div>

          <div className="flex border-b border-gray-800 shrink-0">
            {TABS.map(tab => {
              if (tab.needsVnc && !selected.vnc_port) return null;
              const disabled = tab.needsRunning && !isRunning;
              return (
                <button
                  key={tab.id}
                  onClick={() => !disabled && setDetailTab(tab.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 text-xs border-b-2 transition-colors ${
                    detailTab === tab.id
                      ? 'border-nest-500 text-nest-300'
                      : disabled
                      ? 'border-transparent text-gray-700 cursor-not-allowed'
                      : 'border-transparent text-gray-500 hover:text-gray-300'
                  }`}
                >
                  <tab.icon size={12} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="flex-1 overflow-hidden">
            {detailTab === 'info' && (
              <div className="p-4 space-y-3 text-sm overflow-y-auto h-full">
                <div><span className="text-gray-500">ID:</span> <span className="text-gray-300">{selected.id}</span></div>
                <div><span className="text-gray-500">Project:</span> <span className="text-gray-300">{projects.find(p => p.id === selected.project_id)?.name || 'None'}</span></div>
                <div><span className="text-gray-500">Role:</span> <span className="text-gray-300">{selected.role || 'N/A'}</span></div>
                <div><span className="text-gray-500">Image:</span> <span className="text-gray-300">{selected.image}</span></div>
                <div><span className="text-gray-500">SSH Port:</span> <span className="text-gray-300">{selected.ssh_port || 'N/A'}</span></div>
                <div><span className="text-gray-500">API Port:</span> <span className="text-gray-300">{selected.api_port || 'N/A'}</span></div>
                {selected.vnc_port && <div><span className="text-gray-500">VNC Port:</span> <span className="text-gray-300">{selected.vnc_port}</span></div>}
                <div>
                  <span className="text-gray-500">Status:</span>{' '}
                  <span className={isRunning ? 'text-emerald-400' : 'text-gray-500'}>
                    {isRunning ? 'Running' : 'Stopped'}
                  </span>
                </div>
                {selected.live_status?.uptime && (
                  <div><span className="text-gray-500">Up since:</span> <span className="text-gray-300">{new Date(selected.live_status.uptime).toLocaleString()}</span></div>
                )}
                {selected.live_status?.containerId && (
                  <div><span className="text-gray-500">Container:</span> <span className="text-gray-300 font-mono">{selected.live_status.containerId}</span></div>
                )}
              </div>
            )}

            {detailTab === 'terminal' && isRunning && (
              <TerminalView engineerId={selected.id} engineerName={selected.name} />
            )}

            {detailTab === 'terminal' && !isRunning && (
              <div className="flex items-center justify-center h-full text-gray-600 text-sm">
                Start the engineer to access the terminal.
              </div>
            )}

            {detailTab === 'vnc' && selected.vnc_port && isRunning && (
              <VncViewer vncPort={selected.vnc_port} engineerName={selected.name} />
            )}

            {detailTab === 'logs' && (
              <div className="p-4 h-full overflow-y-auto">
                <pre className="text-xs text-gray-400 bg-gray-950 rounded p-3 whitespace-pre-wrap font-mono">
                  {logs || '(no logs available)'}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* New Engineer Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold">New Engineer</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-300"><X size={18} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Name</label>
                <input placeholder="e.g. poly-analyst" value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-nest-500/50" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Project</label>
                  <select value={form.project_id} onChange={e => setForm({ ...form, project_id: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-nest-500/50">
                    <option value="">No project</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Role</label>
                  <input placeholder="e.g. backend, research" value={form.role}
                    onChange={e => setForm({ ...form, role: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-nest-500/50" />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Docker Image</label>
                <input placeholder="agentcore:minimal" value={form.image}
                  onChange={e => setForm({ ...form, image: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-nest-500/50" />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">SSH Port</label>
                  <input placeholder="2222" value={form.ssh_port}
                    onChange={e => setForm({ ...form, ssh_port: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-nest-500/50" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">API Port</label>
                  <input placeholder="8081" value={form.api_port}
                    onChange={e => setForm({ ...form, api_port: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-nest-500/50" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">VNC Port</label>
                  <input placeholder="6080" value={form.vnc_port}
                    onChange={e => setForm({ ...form, vnc_port: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-nest-500/50" />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors">Cancel</button>
              <button onClick={handleCreate} disabled={!form.name}
                className="px-4 py-2 text-sm bg-nest-600 hover:bg-nest-500 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                Create Engineer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
