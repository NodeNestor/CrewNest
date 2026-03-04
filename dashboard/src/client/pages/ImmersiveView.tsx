import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Square, Terminal as TermIcon, Monitor, Columns } from 'lucide-react';
import TerminalView from '../components/Terminal';
import VncViewer from '../components/VncViewer';
import ResizableSplit from '../components/ResizableSplit';
import { fetchEngineer, startEngineer, stopEngineer, type Engineer } from '../lib/api';

type ViewMode = 'split' | 'terminal' | 'desktop';

export default function ImmersiveView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [engineer, setEngineer] = useState<Engineer | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    fetchEngineer(id).then(setEngineer).catch(() => navigate('/engineers'));
  }, [id, navigate]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [load]);

  if (!engineer) return null;

  const isRunning = engineer.live_status?.running ?? false;
  const hasVnc = engineer.vnc_port != null;
  const effectiveMode = !hasVnc ? 'terminal' : viewMode;

  const handleStart = async () => {
    setLoading(true);
    try {
      await startEngineer(engineer.id);
      load();
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    try {
      await stopEngineer(engineer.id);
      load();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-100">
      {/* Minimal top bar */}
      <div className="flex items-center gap-2 px-2 py-1 bg-gray-900/80 border-b border-gray-800 shrink-0">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-gray-200 rounded transition-colors"
        >
          <ArrowLeft size={14} />
        </button>

        <div className="w-px h-4 bg-gray-700" />

        <span className="text-sm font-medium text-gray-200">{engineer.name}</span>
        <span className={`flex items-center gap-1.5 text-xs ${isRunning ? 'text-emerald-400' : 'text-gray-500'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
          {isRunning ? 'Running' : 'Stopped'}
        </span>

        {engineer.role && (
          <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded">{engineer.role}</span>
        )}

        {/* View mode buttons */}
        {hasVnc && isRunning && (
          <>
            <div className="w-px h-4 bg-gray-700 ml-1" />
            <button
              onClick={() => setViewMode('terminal')}
              className={`flex items-center gap-1 px-2 py-0.5 text-xs rounded ${viewMode === 'terminal' ? 'bg-nest-600/20 text-nest-300' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <TermIcon size={11} /> Terminal
            </button>
            <button
              onClick={() => setViewMode('desktop')}
              className={`flex items-center gap-1 px-2 py-0.5 text-xs rounded ${viewMode === 'desktop' ? 'bg-nest-600/20 text-nest-300' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <Monitor size={11} /> Desktop
            </button>
            <button
              onClick={() => setViewMode('split')}
              className={`flex items-center gap-1 px-2 py-0.5 text-xs rounded ${viewMode === 'split' ? 'bg-nest-600/20 text-nest-300' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <Columns size={11} /> Split
            </button>
          </>
        )}

        {/* Start/Stop */}
        <div className="ml-auto flex items-center gap-2">
          {!isRunning && (
            <button
              onClick={handleStart}
              disabled={loading}
              className="flex items-center gap-1 px-3 py-1 text-xs bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 rounded transition-colors disabled:opacity-50"
            >
              <Play size={11} /> {loading ? 'Starting...' : 'Start'}
            </button>
          )}
          {isRunning && (
            <button
              onClick={handleStop}
              disabled={loading}
              className="flex items-center gap-1 px-3 py-1 text-xs bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded transition-colors disabled:opacity-50"
            >
              <Square size={11} /> {loading ? 'Stopping...' : 'Stop'}
            </button>
          )}
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        {!isRunning ? (
          <div className="flex items-center justify-center h-full text-gray-600">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-800/50 flex items-center justify-center">
                <TermIcon size={32} className="text-gray-600" />
              </div>
              <p className="text-lg text-gray-400">{engineer.name} is stopped</p>
              <button
                onClick={handleStart}
                disabled={loading}
                className="mt-6 px-6 py-2.5 text-sm bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 rounded-lg transition-colors disabled:opacity-50"
              >
                <Play size={14} className="inline mr-1.5" />
                {loading ? 'Starting...' : 'Start Engineer'}
              </button>
            </div>
          </div>
        ) : effectiveMode === 'terminal' ? (
          <TerminalView key={`immersive-term-${engineer.id}`} engineerId={engineer.id} engineerName={engineer.name} hideHeader />
        ) : effectiveMode === 'desktop' ? (
          <VncViewer vncPort={engineer.vnc_port!} engineerName={engineer.name} />
        ) : (
          /* Split: terminal left + VNC right */
          <ResizableSplit
            initialLeftPercent={30}
            minLeftPercent={20}
            maxLeftPercent={60}
            left={<TerminalView key={`immersive-split-term-${engineer.id}`} engineerId={engineer.id} engineerName={engineer.name} hideHeader />}
            right={<VncViewer vncPort={engineer.vnc_port!} engineerName={engineer.name} />}
          />
        )}
      </div>
    </div>
  );
}
