import { useState, useRef, useCallback, type ReactNode } from 'react';

interface Props {
  left: ReactNode;
  right: ReactNode;
  initialLeftPercent?: number;
  minLeftPercent?: number;
  maxLeftPercent?: number;
}

export default function ResizableSplit({
  left,
  right,
  initialLeftPercent = 35,
  minLeftPercent = 15,
  maxLeftPercent = 85,
}: Props) {
  const [leftPercent, setLeftPercent] = useState(initialLeftPercent);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    setIsDragging(true);

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      setLeftPercent(Math.min(maxLeftPercent, Math.max(minLeftPercent, pct)));
    };

    const onMouseUp = () => {
      dragging.current = false;
      setIsDragging(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [minLeftPercent, maxLeftPercent]);

  return (
    <div ref={containerRef} className="flex h-full relative" style={{ minHeight: 0 }}>
      {/* Overlay to prevent iframes from stealing mouse events during drag */}
      {isDragging && <div className="absolute inset-0 z-20" style={{ cursor: 'col-resize' }} />}
      <div style={{ width: `${leftPercent}%`, minWidth: 0, minHeight: 0 }}>
        {left}
      </div>
      <div
        onMouseDown={onMouseDown}
        className="w-1 shrink-0 bg-gray-800 hover:bg-nest-500/50 cursor-col-resize transition-colors relative group z-30"
      >
        <div className="absolute inset-y-0 -left-1 -right-1" />
      </div>
      <div className="flex-1" style={{ minWidth: 0, minHeight: 0 }}>
        {right}
      </div>
    </div>
  );
}
