import { useEffect, useState, useRef } from 'react';
import { Wifi, WifiOff, Filter } from 'lucide-react';

interface ActivityEvent {
  id: string;
  type: string;
  agent_id?: string;
  data: any;
  timestamp: string;
}

const HIVEMINDDB_WS = 'ws://localhost:8100/ws';

export default function Activity() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [filter, setFilter] = useState('');
  const wsRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const connect = () => {
      try {
        const ws = new WebSocket(HIVEMINDDB_WS);
        wsRef.current = ws;

        ws.onopen = () => {
          setConnected(true);
          // Subscribe to all channels
          ws.send(JSON.stringify({ type: 'subscribe', channel: '*' }));
        };

        ws.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            const event: ActivityEvent = {
              id: crypto.randomUUID(),
              type: data.type || 'message',
              agent_id: data.agent_id,
              data,
              timestamp: new Date().toISOString(),
            };
            setEvents(prev => [...prev.slice(-500), event]);
          } catch { /* ignore malformed messages */ }
        };

        ws.onclose = () => {
          setConnected(false);
          setTimeout(connect, 3000);
        };

        ws.onerror = () => ws.close();
      } catch {
        setTimeout(connect, 3000);
      }
    };

    connect();
    return () => { wsRef.current?.close(); };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  const filtered = filter
    ? events.filter(e => e.type.includes(filter) || e.agent_id?.includes(filter))
    : events;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">Activity</h2>
          <span className={`flex items-center gap-1.5 text-xs ${connected ? 'text-emerald-400' : 'text-red-400'}`}>
            {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
            {connected ? 'Connected to HiveMindDB' : 'Disconnected'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-gray-500" />
          <input
            placeholder="Filter by type or agent..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded px-3 py-1 text-sm w-64 focus:outline-none focus:border-nest-500/50"
          />
          <button
            onClick={() => setEvents([])}
            className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Event stream */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-1">
        {filtered.length === 0 && (
          <div className="flex items-center justify-center h-full text-gray-600">
            <div className="text-center">
              <p className="text-lg font-medium text-gray-500">Live Activity Feed</p>
              <p className="text-sm mt-1">
                {connected
                  ? 'Waiting for events from HiveMindDB...'
                  : 'Connecting to HiveMindDB WebSocket...'}
              </p>
              <p className="text-xs mt-2 text-gray-600">
                Task completions, memory additions, and agent status changes will appear here.
              </p>
            </div>
          </div>
        )}
        {filtered.map(event => (
          <div key={event.id} className="flex items-start gap-3 text-sm py-1.5 hover:bg-gray-900/50 rounded px-2">
            <span className="text-[10px] text-gray-600 font-mono shrink-0 pt-0.5">
              {new Date(event.timestamp).toLocaleTimeString()}
            </span>
            <EventBadge type={event.type} />
            {event.agent_id && (
              <span className="text-nest-400 text-xs shrink-0">{event.agent_id}</span>
            )}
            <span className="text-gray-400 truncate">
              {formatEventData(event)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EventBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    task_completed: 'bg-emerald-500/15 text-emerald-400',
    task_created: 'bg-blue-500/15 text-blue-400',
    task_claimed: 'bg-amber-500/15 text-amber-400',
    memory_added: 'bg-purple-500/15 text-purple-400',
    agent_registered: 'bg-nest-500/15 text-nest-400',
    agent_heartbeat: 'bg-gray-700 text-gray-400',
  };
  const color = colors[type] || 'bg-gray-800 text-gray-400';
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${color}`}>
      {type}
    </span>
  );
}

function formatEventData(event: ActivityEvent): string {
  const d = event.data;
  if (d.title) return d.title;
  if (d.content) return typeof d.content === 'string' ? d.content.slice(0, 120) : JSON.stringify(d.content).slice(0, 120);
  if (d.message) return d.message;
  return JSON.stringify(d).slice(0, 120);
}
