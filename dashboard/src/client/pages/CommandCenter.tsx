import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Terminal as TermIcon, Monitor, Play, Square, Columns, Maximize2, Bot, LayoutGrid } from 'lucide-react';
import StatusBar from '../components/StatusBar';
import TerminalView from '../components/Terminal';
import VncViewer from '../components/VncViewer';
import ResizableSplit from '../components/ResizableSplit';
import { fetchEngineers, startEngineer, stopEngineer, ensureOrchestrator, type Engineer } from '../lib/api';

type Layout = 'terminal' | 'desktop' | 'split' | 'multi';

export default function CommandCenter() {
  const navigate = useNavigate();
  const [layout, setLayout] = useState<Layout>('terminal');
  const [engineers, setEngineers] = useState<Engineer[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [orchestratorReady, setOrchestratorReady] = useState(false);

  // Use a ref so the polling callback always reads the latest selectedId
  const selectedIdRef = useRef(selectedId);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);

  const load = useCallback(() => {
    fetchEngineers().then(engs => {
      setEngineers(engs);
      const currentId = selectedIdRef.current;
      if (!currentId || !engs.find(e => e.id === currentId)) {
        const orch = engs.find(e => e.name === 'orchestrator');
        const running = engs.find(e => e.live_status?.running);
        const pick = orch || running || engs[0];
        if (pick) setSelectedId(pick.id);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    ensureOrchestrator().then(() => {
      setOrchestratorReady(true);
      load();
    }).catch(() => {
      setOrchestratorReady(true);
      load();
    });
  }, []);

  useEffect(() => {
    if (!orchestratorReady) return;
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [orchestratorReady, load]);

  const selected = engineers.find(e => e.id === selectedId);
  const isRunning = selected?.live_status?.running ?? false;
  const hasVnc = selected?.vnc_port != null;
  const isOrchestrator = selected?.name === 'orchestrator';
  const runningEngineers = engineers.filter(e => e.live_status?.running);

  const handleStart = async () => {
    if (!selected) return;
    setStarting(true);
    try {
      await startEngineer(selected.id);
      load();
    } catch (err: any) {
      alert(`Failed to start: ${err.message}`);
    } finally {
      setStarting(false);
    }
  };

  const handleStop = async () => {
    if (!selected) return;
    setStopping(true);
    try {
      await stopEngineer(selected.id);
      load();
    } catch (err: any) {
      alert(`Failed to stop: ${err.message}`);
    } finally {
      setStopping(false);
    }
  };

  // Grid layout for multi-view: 1 col for 1, 2 cols for 2-4, 3 cols for 5+
  const gridCols = runningEngineers.length <= 1 ? 1 : runningEngineers.length <= 4 ? 2 : 3;

  return (
    <div className="flex flex-col h-full" style={{ minHeight: 0 }}>
      <StatusBar />

      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-1 border-b border-gray-800 bg-gray-900/40 shrink-0">
        <button
          onClick={() => setLayout('terminal')}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition-colors ${
            layout === 'terminal' ? 'bg-nest-600/20 text-nest-300' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <TermIcon size={12} /> Terminal
        </button>
        {hasVnc && layout !== 'multi' && (
          <>
            <button
              onClick={() => setLayout('desktop')}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition-colors ${
                layout === 'desktop' ? 'bg-nest-600/20 text-nest-300' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <Monitor size={12} /> Desktop
            </button>
            <button
              onClick={() => setLayout('split')}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition-colors ${
                layout === 'split' ? 'bg-nest-600/20 text-nest-300' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <Columns size={12} /> Split
            </button>
          </>
        )}
        {runningEngineers.length > 1 && (
          <button
            onClick={() => setLayout('multi')}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition-colors ${
              layout === 'multi' ? 'bg-nest-600/20 text-nest-300' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <LayoutGrid size={12} /> Multi ({runningEngineers.length})
          </button>
        )}

        <div className="w-px h-4 bg-gray-700 mx-1" />

        {engineers.length > 0 && layout !== 'multi' && (
          <div className="flex items-center gap-2 ml-auto">
            <select
              value={selectedId}
              onChange={e => setSelectedId(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-xs text-gray-300 focus:outline-none focus:border-nest-500/50 max-w-[180px]"
            >
              {engineers.map(e => (
                <option key={e.id} value={e.id}>
                  {e.name === 'orchestrator' ? '\u{1F916} ' : ''}{e.name} {e.live_status?.running ? '\u25CF' : '\u25CB'}
                </option>
              ))}
            </select>
            {selected && !isRunning && (
              <button
                onClick={handleStart}
                disabled={starting}
                className="flex items-center gap-1 px-2.5 py-0.5 text-xs bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 rounded transition-colors disabled:opacity-50"
              >
                <Play size={10} />
                {starting ? 'Starting...' : 'Start'}
              </button>
            )}
            {selected && isRunning && (
              <button
                onClick={handleStop}
                disabled={stopping}
                className="flex items-center gap-1 px-2.5 py-0.5 text-xs bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded transition-colors disabled:opacity-50"
              >
                <Square size={10} />
                {stopping ? 'Stopping...' : 'Stop'}
              </button>
            )}
            {selected && (
              <button
                onClick={() => navigate(`/engineer/${selected.id}`)}
                className="flex items-center gap-1 px-2.5 py-0.5 text-xs bg-nest-600/20 text-nest-300 hover:bg-nest-600/30 rounded transition-colors"
                title="Immersive fullscreen view"
              >
                <Maximize2 size={10} /> Enter
              </button>
            )}
          </div>
        )}

        {layout === 'multi' && (
          <span className="text-xs text-gray-500 ml-auto">
            Showing {runningEngineers.length} running engineers
          </span>
        )}
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        {/* Multi-view: grid of all running engineers */}
        {layout === 'multi' && (
          <div
            className="grid h-full"
            style={{
              gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
              gridAutoRows: '1fr',
              minHeight: 0,
            }}
          >
            {runningEngineers.map(eng => (
              <div key={`multi-${eng.id}`} className="border border-gray-800 flex flex-col" style={{ minHeight: 0, overflow: 'hidden' }}>
                <div className="flex items-center justify-between px-2 py-0.5 bg-gray-900/80 border-b border-gray-800 shrink-0">
                  <span className="text-[10px] text-gray-300 font-medium truncate">{eng.name}</span>
                  <button
                    onClick={() => { setSelectedId(eng.id); setLayout('terminal'); }}
                    className="text-[10px] text-gray-500 hover:text-nest-300 px-1"
                  >
                    focus
                  </button>
                </div>
                <div className="flex-1" style={{ minHeight: 0 }}>
                  {eng.vnc_port ? (
                    <VncViewer vncPort={eng.vnc_port} engineerName={eng.name} />
                  ) : (
                    <TerminalView key={`multi-term-${eng.id}`} engineerId={eng.id} engineerName={eng.name} hideHeader />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Single-view modes */}
        {layout === 'terminal' && selected && isRunning && (
          <TerminalView key={`term-${selected.id}`} engineerId={selected.id} engineerName={selected.name} />
        )}

        {layout === 'desktop' && selected && isRunning && hasVnc && (
          <VncViewer vncPort={selected.vnc_port!} engineerName={selected.name} />
        )}

        {layout === 'split' && selected && isRunning && hasVnc && (
          <ResizableSplit
            initialLeftPercent={60}
            left={<VncViewer vncPort={selected.vnc_port!} engineerName={selected.name} />}
            right={<TerminalView key={`split-term-${selected.id}`} engineerId={selected.id} engineerName={selected.name} />}
          />
        )}

        {layout !== 'multi' && selected && !isRunning && (
          <div className="flex items-center justify-center h-full text-gray-600">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-800/50 flex items-center justify-center">
                {isOrchestrator ? <Bot size={24} className="text-gray-600" /> : <TermIcon size={24} className="text-gray-600" />}
              </div>
              <p className="text-sm">
                <span className="text-gray-300 font-medium">{selected.name}</span> is stopped
              </p>
              {isOrchestrator && (
                <p className="text-xs text-gray-500 mt-1">
                  Start the orchestrator to manage your crew via Claude Code.
                </p>
              )}
              <button
                onClick={handleStart}
                disabled={starting}
                className="mt-4 px-5 py-2 text-sm bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 rounded-lg transition-colors disabled:opacity-50"
              >
                <Play size={14} className="inline mr-1.5" />
                {starting ? 'Starting...' : isOrchestrator ? 'Start Orchestrator' : 'Start Engineer'}
              </button>
            </div>
          </div>
        )}

        {layout !== 'multi' && engineers.length === 0 && (
          <div className="flex items-center justify-center h-full text-gray-600">
            <p className="text-sm">Setting up orchestrator...</p>
          </div>
        )}
      </div>
    </div>
  );
}
