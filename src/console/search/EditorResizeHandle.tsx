import { useRef } from 'react';
import { GripHorizontal } from 'lucide-react';

type Props = {
  height: number;
  onHeightChange: (next: number) => void;
};

export const MIN_EDITOR_HEIGHT = 128;
const MAX_HEIGHT_RATIO = 0.7;

function clampHeight(next: number): number {
  return Math.min(Math.max(next, MIN_EDITOR_HEIGHT), Math.round(window.innerHeight * MAX_HEIGHT_RATIO));
}

export function EditorResizeHandle({ height, onHeightChange }: Props) {
  const start = useRef<{ y: number; height: number } | undefined>(undefined);

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    start.current = undefined;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize query editor"
      className="flex h-3 shrink-0 cursor-row-resize touch-none items-center justify-center rounded-b-md border-x border-b hover:bg-accent"
      onPointerDown={(e) => {
        e.preventDefault(); // no text selection while dragging
        e.currentTarget.setPointerCapture(e.pointerId);
        start.current = { y: e.clientY, height };
      }}
      onPointerMove={(e) => {
        if (!start.current) return;
        onHeightChange(clampHeight(start.current.height + (e.clientY - start.current.y)));
      }}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <GripHorizontal className="h-3 w-3 text-muted-foreground" />
    </div>
  );
}
