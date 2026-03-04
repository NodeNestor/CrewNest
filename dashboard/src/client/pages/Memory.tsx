import { useState, useEffect } from 'react';
import { Search, Brain, Tag, User, Clock, Trash2, AlertCircle, RefreshCw } from 'lucide-react';
import {
  searchMemories, fetchHivemindAgents, fetchHivemindHealth,
  type HiveMindSearchResult, type HiveMindAgent,
} from '../lib/api';

export default function Memory() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<HiveMindSearchResult[]>([]);
  const [agents, setAgents] = useState<HiveMindAgent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [searching, setSearching] = useState(false);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [selectedMemory, setSelectedMemory] = useState<HiveMindSearchResult | null>(null);

  useEffect(() => {
    fetchHivemindHealth()
      .then(h => {
        setConnected(h.ok);
        if (h.ok) {
          fetchHivemindAgents().then(setAgents).catch(() => {});
          // Load recent memories
          searchMemories('*', { limit: 20 }).then(setResults).catch(() => {});
        }
      })
      .catch(() => setConnected(false));
  }, []);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const opts: any = { limit: 30 };
      if (selectedAgent) opts.agent_id = selectedAgent;
      const res = await searchMemories(query, opts);
      setResults(res);
    } catch {
      // ignore
    } finally {
      setSearching(false);
    }
  };

  const handleRefresh = async () => {
    setSearching(true);
    try {
      const opts: any = { limit: 30 };
      if (selectedAgent) opts.agent_id = selectedAgent;
      const res = await searchMemories(query || '*', opts);
      setResults(res);
    } catch { /* ignore */ }
    finally { setSearching(false); }
  };

  if (connected === false) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-sm">
          <AlertCircle size={40} className="mx-auto text-amber-500 mb-3" />
          <h3 className="text-lg font-medium text-gray-200 mb-2">HiveMindDB Not Connected</h3>
          <p className="text-sm text-gray-500">
            Start HiveMindDB to access agent memories, knowledge graphs, and tasks.
            Configure the URL in Settings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Main content */}
      <div className={`flex-1 flex flex-col overflow-hidden ${selectedMemory ? 'max-w-[60%]' : ''}`}>
        {/* Search bar */}
        <div className="p-4 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="Search memories... (semantic + keyword)"
                className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-nest-500/50"
              />
            </div>
            <select
              value={selectedAgent}
              onChange={e => setSelectedAgent(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-nest-500/50"
            >
              <option value="">All Agents</option>
              {agents.map(a => (
                <option key={a.id} value={a.id}>{a.name || a.id}</option>
              ))}
            </select>
            <button
              onClick={handleSearch}
              disabled={searching}
              className="px-4 py-2 bg-nest-600 hover:bg-nest-500 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {searching ? 'Searching...' : 'Search'}
            </button>
            <button
              onClick={handleRefresh}
              disabled={searching}
              className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw size={14} className={searching ? 'animate-spin' : ''} />
            </button>
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
            <span>{results.length} memories</span>
            <span className={`flex items-center gap-1 ${connected ? 'text-emerald-500' : 'text-red-400'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400' : 'bg-red-400'}`} />
              HiveMindDB {connected ? 'connected' : 'disconnected'}
            </span>
            {agents.length > 0 && <span>{agents.length} agents registered</span>}
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {results.map((result, i) => {
            const mem = result.memory;
            const isSelected = selectedMemory?.memory.id === mem.id;
            return (
              <div
                key={mem.id || i}
                onClick={() => setSelectedMemory(result)}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-nest-600/10 border-nest-500/30'
                    : 'bg-gray-900 border-gray-800 hover:border-gray-700'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-gray-300 line-clamp-2 flex-1">{mem.content}</p>
                  {result.score > 0 && (
                    <span className="text-xs text-gray-600 shrink-0">
                      {(result.score * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                  {mem.agent_id && (
                    <span className="flex items-center gap-1">
                      <User size={10} /> {mem.agent_id}
                    </span>
                  )}
                  {mem.tags && mem.tags.length > 0 && (
                    <span className="flex items-center gap-1">
                      <Tag size={10} /> {mem.tags.slice(0, 3).join(', ')}
                    </span>
                  )}
                  {mem.created_at && (
                    <span className="flex items-center gap-1">
                      <Clock size={10} /> {new Date(mem.created_at).toLocaleString()}
                    </span>
                  )}
                  {mem.confidence != null && (
                    <span>conf: {(mem.confidence * 100).toFixed(0)}%</span>
                  )}
                </div>
              </div>
            );
          })}
          {connected !== null && results.length === 0 && !searching && (
            <div className="text-center text-gray-600 py-8">
              <Brain size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">No memories found. Try a different search or check HiveMindDB.</p>
            </div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selectedMemory && (
        <div className="w-[40%] border-l border-gray-800 bg-gray-900/50 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between shrink-0">
            <h3 className="text-sm font-medium text-gray-200">Memory Detail</h3>
            <button onClick={() => setSelectedMemory(null)} className="text-gray-500 hover:text-gray-300 text-xs">Close</button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Content</label>
              <p className="text-sm text-gray-200 whitespace-pre-wrap bg-gray-950 rounded-lg p-3">{selectedMemory.memory.content}</p>
            </div>
            {selectedMemory.score > 0 && (
              <div>
                <label className="text-xs text-gray-500 block mb-1">Relevance Score</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-nest-500 rounded-full" style={{ width: `${selectedMemory.score * 100}%` }} />
                  </div>
                  <span className="text-xs text-gray-400">{(selectedMemory.score * 100).toFixed(1)}%</span>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              {selectedMemory.memory.agent_id && (
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Agent</label>
                  <span className="text-sm text-gray-300">{selectedMemory.memory.agent_id}</span>
                </div>
              )}
              {selectedMemory.memory.id && (
                <div>
                  <label className="text-xs text-gray-500 block mb-1">ID</label>
                  <span className="text-xs text-gray-400 font-mono">{selectedMemory.memory.id}</span>
                </div>
              )}
              {selectedMemory.memory.created_at && (
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Created</label>
                  <span className="text-sm text-gray-300">{new Date(selectedMemory.memory.created_at).toLocaleString()}</span>
                </div>
              )}
              {selectedMemory.memory.confidence != null && (
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Confidence</label>
                  <span className="text-sm text-gray-300">{(selectedMemory.memory.confidence! * 100).toFixed(0)}%</span>
                </div>
              )}
            </div>
            {selectedMemory.memory.tags && selectedMemory.memory.tags.length > 0 && (
              <div>
                <label className="text-xs text-gray-500 block mb-1">Tags</label>
                <div className="flex flex-wrap gap-1.5">
                  {selectedMemory.memory.tags.map(tag => (
                    <span key={tag} className="px-2 py-0.5 bg-gray-800 text-gray-400 text-xs rounded-full">{tag}</span>
                  ))}
                </div>
              </div>
            )}
            {selectedMemory.memory.metadata && Object.keys(selectedMemory.memory.metadata).length > 0 && (
              <div>
                <label className="text-xs text-gray-500 block mb-1">Metadata</label>
                <pre className="text-xs text-gray-400 bg-gray-950 rounded-lg p-3 overflow-x-auto">
                  {JSON.stringify(selectedMemory.memory.metadata, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
