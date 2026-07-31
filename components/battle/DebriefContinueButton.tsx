'use client';

import React from 'react';

interface DebriefContinueButtonProps {
  onContinue: () => void;
}

// Purely presentational - the DEBRIEF_PROMPT phase itself (see
// hooks/useSilencerBattle.ts) is what stops the state machine from
// auto-advancing into the darkened dialogue; this button only ever reports
// the click.
export default function DebriefContinueButton({ onContinue }: DebriefContinueButtonProps) {
  return (
    <div className="absolute inset-x-0 bottom-6 z-20 flex justify-center">
      <button
        onClick={onContinue}
        className="neo-btn bg-green-400 hover:bg-green-300 text-white font-black uppercase text-sm px-8 py-3 rounded-xl"
      >
        Continue
      </button>
    </div>
  );
}
