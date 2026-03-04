import { useEffect, useState } from 'react';
import { Server, Database, Shield, Users } from 'lucide-react';
import { fetchStatus, type StatusInfo } from '../lib/api';

function Dot({ ok }: { ok: boolean }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${ok ? 'bg-emerald-400' : 'bg-red-400'}`} />
  );
}

export default function StatusBar() {
  const [status, setStatus] = useState<StatusInfo | null>(null);

  useEffect(() => {
    const load = () => fetchStatus().then(setStatus).catch(() => {});
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  if (!status) return null;

  return (
    <div className="flex items-center gap-5 px-4 py-2 bg-gray-900/60 border-b border-gray-800 text-xs text-gray-400">
      <span className="flex items-center gap-1.5">
        <Server size={12} />
        <Dot ok={status.docker} />
        Docker
      </span>
      <span className="flex items-center gap-1.5">
        <Database size={12} />
        <Dot ok={status.hivemind} />
        HiveMindDB
      </span>
      <span className="flex items-center gap-1.5">
        <Shield size={12} />
        <Dot ok={status.codegate} />
        CodeGate
      </span>
      <span className="flex items-center gap-1.5 ml-auto">
        <Users size={12} />
        <span className="text-gray-300">{status.running_engineers}</span> engineers running
      </span>
    </div>
  );
}
