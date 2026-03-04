interface Props {
  vncPort: number;
  engineerName: string;
}

export default function VncViewer({ vncPort, engineerName }: Props) {
  // noVNC is served from the container's VNC port (6080 mapped to vncPort)
  // Most noVNC setups serve at /vnc.html or /vnc_lite.html
  const vncUrl = `http://localhost:${vncPort}/vnc.html?autoconnect=true&resize=scale&password=`;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-900 border-b border-gray-800 text-xs">
        <span className="text-gray-400">
          Desktop: <span className="text-gray-200">{engineerName}</span>
        </span>
        <a
          href={vncUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-nest-400 hover:text-nest-300"
        >
          Open in new tab
        </a>
      </div>
      <div className="flex-1 bg-black">
        <iframe
          src={vncUrl}
          className="w-full h-full border-0"
          title={`VNC - ${engineerName}`}
          allow="clipboard-read; clipboard-write"
        />
      </div>
    </div>
  );
}
