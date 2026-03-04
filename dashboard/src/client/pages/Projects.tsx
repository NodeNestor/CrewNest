import { useEffect, useState } from 'react';
import { Plus, Trash2, Save, GitBranch, FileText, X } from 'lucide-react';
import { fetchProjects, createProject, updateProject, deleteProject, type Project } from '../lib/api';

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', repos: '' as string, claude_md: '' });

  const load = () => fetchProjects().then(setProjects).catch(() => {});
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!form.name) return;
    let repos: any[] = [];
    try {
      repos = form.repos.split('\n').filter(Boolean).map(line => {
        const parts = line.trim().split(/[|\s]+/);
        return { url: parts[0], branch: parts[1] || 'main', mode: parts[2] || 'push' };
      });
    } catch { /* leave empty */ }
    await createProject({ name: form.name, repos, claude_md: form.claude_md || undefined });
    setForm({ name: '', repos: '', claude_md: '' });
    setShowModal(false);
    load();
  };

  const handleSave = async (project: Project) => {
    await updateProject(project.id, {
      name: project.name,
      repos: project.repos,
      claude_md: project.claude_md,
    });
    setEditing(null);
    load();
  };

  const handleDelete = async (id: string) => {
    await deleteProject(id);
    load();
  };

  return (
    <div className="p-6 overflow-y-auto h-full">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Projects</h2>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-nest-600 hover:bg-nest-500 rounded-md transition-colors"
        >
          <Plus size={14} /> New Project
        </button>
      </div>

      <div className="space-y-4">
        {projects.map(project => (
          <div key={project.id} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-medium text-gray-100">{project.name}</h3>
                <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><GitBranch size={12} />{project.repos.length} repos</span>
                  <span>{project.engineer_count ?? 0} engineers</span>
                  {project.claude_md && <span className="flex items-center gap-1"><FileText size={12} />CLAUDE.md</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditing(editing === project.id ? null : project.id)}
                  className="text-xs text-gray-400 hover:text-gray-200"
                >
                  {editing === project.id ? 'Cancel' : 'Edit'}
                </button>
                <button
                  onClick={() => handleDelete(project.id)}
                  className="text-gray-600 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {project.repos.length > 0 && (
              <div className="mt-3 space-y-1">
                {project.repos.map((r, i) => (
                  <div key={i} className="text-xs text-gray-400 font-mono bg-gray-950 rounded px-2 py-1">
                    {r.url} <span className="text-gray-600">({r.branch || 'main'}, {r.mode || 'push'})</span>
                  </div>
                ))}
              </div>
            )}

            {editing === project.id && (
              <EditProjectForm
                project={project}
                onSave={handleSave}
                onCancel={() => setEditing(null)}
              />
            )}
          </div>
        ))}
        {projects.length === 0 && (
          <p className="text-gray-600 text-sm">No projects yet. Create one to get started.</p>
        )}
      </div>

      {/* New Project Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold">New Project</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-300"><X size={18} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Project Name</label>
                <input
                  placeholder="e.g. Polymarket"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-nest-500/50"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Repositories (one per line: url branch mode)</label>
                <textarea
                  placeholder={"https://github.com/user/repo main push\nhttps://github.com/user/lib main pull"}
                  value={form.repos}
                  onChange={e => setForm({ ...form, repos: e.target.value })}
                  rows={3}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-nest-500/50"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">CLAUDE.md (instructions injected into engineers)</label>
                <textarea
                  placeholder="Project-specific instructions for AI engineers..."
                  value={form.claude_md}
                  onChange={e => setForm({ ...form, claude_md: e.target.value })}
                  rows={5}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-nest-500/50"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors">Cancel</button>
              <button onClick={handleCreate} disabled={!form.name}
                className="px-4 py-2 text-sm bg-nest-600 hover:bg-nest-500 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                Create Project
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EditProjectForm({ project, onSave, onCancel }: { project: Project; onSave: (p: Project) => void; onCancel: () => void }) {
  const [name, setName] = useState(project.name);
  const [reposText, setReposText] = useState(
    project.repos.map(r => `${r.url} ${r.branch || 'main'} ${r.mode || 'push'}`).join('\n')
  );
  const [claudeMd, setClaudeMd] = useState(project.claude_md || '');

  const handleSave = () => {
    const repos = reposText.split('\n').filter(Boolean).map(line => {
      const parts = line.trim().split(/[|\s]+/);
      return { url: parts[0], branch: parts[1] || 'main', mode: parts[2] || 'push' };
    });
    onSave({ ...project, name, repos, claude_md: claudeMd || null });
  };

  return (
    <div className="mt-4 pt-4 border-t border-gray-800 space-y-3">
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-nest-500/50"
      />
      <textarea
        value={reposText}
        onChange={e => setReposText(e.target.value)}
        rows={3}
        placeholder="url branch mode (one per line)"
        className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm font-mono focus:outline-none focus:border-nest-500/50"
      />
      <textarea
        value={claudeMd}
        onChange={e => setClaudeMd(e.target.value)}
        rows={5}
        placeholder="CLAUDE.md content..."
        className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm font-mono focus:outline-none focus:border-nest-500/50"
      />
      <div className="flex gap-2">
        <button onClick={handleSave} className="flex items-center gap-1 px-3 py-1.5 text-sm bg-nest-600 hover:bg-nest-500 rounded transition-colors">
          <Save size={12} /> Save
        </button>
        <button onClick={onCancel} className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 rounded transition-colors">Cancel</button>
      </div>
    </div>
  );
}
