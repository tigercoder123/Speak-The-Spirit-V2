'use client';

import React from 'react';

interface RestoreBarProps {
  percent: number;
}

// Purely a function of `percent`, which the hook derives from a
// challenge-progress score (see BATTLE_PROGRESS in
// config/silencerBattleRounds.ts and useSilencerBattle.ts's progressScore)
// - NOT from the Songbeast's gear-piece state, which drives only the gear
// visuals and can move independently of this bar.
export default function RestoreBar({ percent }: RestoreBarProps) {
  return (
    <div className="w-full bg-slate-950 h-5 border-2 border-black rounded-lg overflow-hidden flex items-center justify-center relative">
      <div
        className="absolute left-0 top-0 bottom-0 bg-emerald-400 transition-all duration-700 ease-out"
        style={{ width: `${percent}%` }}
      />
      <span className="z-10 text-[10px] font-black text-white mix-blend-difference">RESTORATION: {percent}%</span>
    </div>
  );
}
