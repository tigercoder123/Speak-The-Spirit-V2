'use client';

import React from 'react';
import type { ResponseOption, ResponseTone } from '../../config/silencerBattleRounds';

interface ResponseChoicesProps {
  /** null while a fresh set is still generating - renders a loading state instead. */
  options: ResponseOption[] | null;
  loading: boolean;
  onSelect: (tone: ResponseTone) => void;
}

// The three tone-based response options - purely presentational, data-driven
// from whatever the caller hands in (fresh, Gloo-generated lines or the
// static config fallback - this component doesn't know or care which).
// Rendered inside the same ParchmentOverlay shell as the challenge screen so
// it reads as a continuation, not a new layout.
export default function ResponseChoices({ options, loading, onSelect }: ResponseChoicesProps) {
  const showLoading = loading || !options;

  return (
    <div className="bg-amber-100 border-4 border-black p-6 rounded-2xl text-black shadow-[4px_4px_0px_#000] relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(#eab308_1px,transparent_1px)] [background-size:16px_16px] opacity-20 pointer-events-none" />
      <p className="text-[10px] font-black uppercase tracking-wider text-amber-800 mb-4 text-center relative">
        {showLoading ? 'The Songbeast searches for the words...' : 'Speak your response'}
      </p>

      <div className="flex flex-col gap-3 relative">
        {showLoading
          ? Array.from({ length: 3 }, (_, i) => (
              <div
                key={i}
                className="bg-white border-2 border-black rounded-xl px-4 py-3 animate-pulse"
              >
                <span className="block h-2.5 w-24 rounded bg-purple-200" />
                <span className="mt-2 block h-3 w-full rounded bg-amber-200" />
              </div>
            ))
          : options.map((option) => (
              <button
                key={option.tone}
                onClick={() => onSelect(option.tone)}
                className="text-left bg-white border-2 border-black rounded-xl px-4 py-3 neo-btn"
              >
                <span className="block text-[10px] font-black uppercase tracking-wide text-purple-700">
                  {option.label}
                </span>
                <span className="mt-1 block text-sm font-bold italic leading-snug">{option.message}</span>
              </button>
            ))}
      </div>
    </div>
  );
}
