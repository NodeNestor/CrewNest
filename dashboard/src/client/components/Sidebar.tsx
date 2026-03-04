import { Link, useLocation } from 'react-router-dom';
import { Terminal, Users, FolderGit2, Brain, Activity, Settings } from 'lucide-react';

const NAV = [
  { path: '/', label: 'Command Center', icon: Terminal },
  { path: '/engineers', label: 'Engineers', icon: Users },
  { path: '/projects', label: 'Projects', icon: FolderGit2 },
  { path: '/memory', label: 'Memory', icon: Brain },
  { path: '/activity', label: 'Activity', icon: Activity },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  const location = useLocation();

  return (
    <aside className="w-56 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
      <div className="p-4 border-b border-gray-800">
        <h1 className="text-lg font-bold tracking-tight">
          <span className="text-nest-400">Crew</span>
          <span className="text-gray-300">Nest</span>
        </h1>
        <p className="text-xs text-gray-500 mt-0.5">Persistent AI Engineers</p>
      </div>
      <nav className="flex-1 p-2 space-y-0.5">
        {NAV.map(({ path, label, icon: Icon }) => {
          const active = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                active
                  ? 'bg-nest-500/15 text-nest-300'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
              }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-gray-800 text-xs text-gray-600">
        NodeNestor Stack
      </div>
    </aside>
  );
}
