import { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

interface Props {
  engineerId: string;
  engineerName: string;
  hideHeader?: boolean;
}

export default function TerminalView({ engineerId, engineerName, hideHeader }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new XTerm({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', monospace",
      theme: {
        background: '#0a0a0f',
        foreground: '#e4e4e7',
        cursor: '#38bdf8',
        selectionBackground: '#38bdf833',
        black: '#09090b',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#eab308',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#e4e4e7',
        brightBlack: '#52525b',
        brightRed: '#f87171',
        brightGreen: '#4ade80',
        brightYellow: '#facc15',
        brightBlue: '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan: '#22d3ee',
        brightWhite: '#fafafa',
      },
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.open(containerRef.current);

    termRef.current = term;
    fitRef.current = fitAddon;

    // Delay initial fit to ensure container has layout dimensions
    // Multiple attempts to handle cases where the container hasn't been laid out yet
    requestAnimationFrame(() => {
      fitAddon.fit();
      // Second fit after a short delay for late layout shifts
      setTimeout(() => fitAddon.fit(), 200);
      setTimeout(() => fitAddon.fit(), 1000);
    });

    // Connect WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/engineers/${engineerId}/terminal`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
      // Fit again now that we're connected, then send size
      fitAddon.fit();
      ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
    };

    ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        term.write(event.data);
      } else if (event.data instanceof Blob) {
        event.data.arrayBuffer().then(buf => {
          term.write(new Uint8Array(buf));
        });
      }
    };

    ws.onclose = () => setStatus('disconnected');
    ws.onerror = () => setStatus('disconnected');

    // Terminal → WebSocket
    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    // Handle resize with debounce
    let resizeTimer: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        fitAddon.fit();
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
        }
      }, 50);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);

    return () => {
      clearTimeout(resizeTimer);
      resizeObserver.disconnect();
      ws.close();
      term.dispose();
    };
  }, [engineerId]);

  return (
    <div className="flex flex-col h-full w-full" style={{ minHeight: 0 }}>
      {!hideHeader && (
        <div className="flex items-center justify-between px-3 py-1 bg-gray-900/80 border-b border-gray-800 text-xs shrink-0">
          <span className="text-gray-400">
            <span className="text-gray-200">{engineerName}</span>
          </span>
          <span className={`flex items-center gap-1.5 ${
            status === 'connected' ? 'text-emerald-400' :
            status === 'connecting' ? 'text-amber-400' : 'text-red-400'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              status === 'connected' ? 'bg-emerald-400' :
              status === 'connecting' ? 'bg-amber-400 animate-pulse' : 'bg-red-400'
            }`} />
            {status}
          </span>
        </div>
      )}
      <div
        ref={containerRef}
        className="flex-1 bg-[#0a0a0f]"
        style={{ minHeight: 0, overflow: 'hidden' }}
      />
    </div>
  );
}
