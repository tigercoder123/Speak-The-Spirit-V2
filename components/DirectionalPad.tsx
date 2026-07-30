'use client';

import React from 'react';
import type { Direction } from '../hooks/usePlayerWalker';

interface DirectionalPadProps {
  onStartMove: (direction: Direction) => void;
  onStopMove: (direction: Direction) => void;
}

const BUTTON_CLASS =
  'w-12 h-12 bg-slate-100 text-black text-xl font-black border-2 border-black rounded hover:bg-white active:translate-y-1';

// Press-and-hold D-pad shared by every walkable scene (Crossroads, Hunger
// Trial, Rushing Waters, Chest Return, the Silencer battle's approach view) -
// holding a button keeps moving via usePlayerWalker's startMove/stopMove
// instead of one step per click, and holding two at once combines into
// diagonal movement exactly like holding two keyboard keys does.
export default function DirectionalPad({ onStartMove, onStopMove }: DirectionalPadProps) {
  const bind = (direction: Direction) => ({
    onMouseDown: () => onStartMove(direction),
    onMouseUp: () => onStopMove(direction),
    onMouseLeave: () => onStopMove(direction),
    onTouchStart: (e: React.TouchEvent) => {
      e.preventDefault();
      onStartMove(direction);
    },
    onTouchEnd: () => onStopMove(direction),
  });

  return (
    <div className="absolute bottom-4 right-4 flex flex-col items-center gap-1 bg-slate-950 p-3 rounded-full border-4 border-black shadow-[0_4px_0_#000] z-30 opacity-80 hover:opacity-100 transition-opacity">
      <button {...bind('up')} className={BUTTON_CLASS}>↑</button>
      <div className="flex gap-1">
        <button {...bind('left')} className={BUTTON_CLASS}>←</button>
        <button {...bind('down')} className={BUTTON_CLASS}>↓</button>
        <button {...bind('right')} className={BUTTON_CLASS}>→</button>
      </div>
    </div>
  );
}
