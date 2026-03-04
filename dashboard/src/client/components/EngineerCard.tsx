import { useNavigate } from 'react-router-dom';
import { Play, Square, RotateCcw, Maximize2 } from 'lucide-react';
import type { Engineer } from '../lib/api';

interface Props {
  engineer: Engineer;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onRestart: (id: string) => void;
  onClick: (engineer: Engineer) => void;
}

export default function EngineerCard({ engineer, onStart, onStop, onRestart, onClick }: Props) {
  const navigate = useNavigate();
  const running = engineer.live_status?.running ?? engineer.status === 'running';

  return (
    <div
      className="bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors cursor-pointer flex flex-col"
      onClick={() => onClick(engineer)}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${running ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
          <div>
            <h3 className="font-medium text-gray-100">{engineer.name}</h3>
            {engineer.role && <p className="text-xs text-gray-500">{engineer.role}</p>}
          </div>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
          running ? 'bg-emerald-500/15 text-emerald-400' : 'bg-gray-800 text-gray-500'
        }`}>
          {running ? 'running' : 'stopped'}
        </span>
      </div>

      <div className="mt-3 text-xs text-gray-500 flex-1">
        <p>{engineer.image}{engineer.vnc_port ? ' + desktop' : ''}</p>
      </div>

      <div className="mt-3 pt-3 border-t border-gray-800 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
        {!running ? (
          <button
            onClick={() => onStart(engineer.id)}
            className="flex items-center gap-1 px-2.5 py-1 text-xs bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 rounded transition-colors"
          >
            <Play size={12} /> Start
          </button>
        ) : (
          <>
            <button
              onClick={() => onStop(engineer.id)}
              className="flex items-center gap-1 px-2.5 py-1 text-xs bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded transition-colors"
            >
              <Square size={12} /> Stop
            </button>
            <button
              onClick={() => onRestart(engineer.id)}
              className="flex items-center gap-1 px-2.5 py-1 text-xs bg-amber-600/20 text-amber-400 hover:bg-amber-600/30 rounded transition-colors"
            >
              <RotateCcw size={12} /> Restart
            </button>
          </>
        )}
        <button
          onClick={() => navigate(`/engineer/${engineer.id}`)}
          className="flex items-center gap-1 px-2.5 py-1 text-xs bg-nest-600/20 text-nest-300 hover:bg-nest-600/30 rounded transition-colors ml-auto"
          title="Fullscreen immersive view"
        >
          <Maximize2 size={12} /> Enter
        </button>
      </div>
    </div>
  );
}
