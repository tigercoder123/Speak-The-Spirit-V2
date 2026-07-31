'use client';

import React from 'react';

interface MissionCompleteButtonProps {
  onContinue: () => void;
}

// Purely presentational - the MISSION_COMPLETE phase itself (see
// hooks/useSilencerBattle.ts) is what stops the state machine from
// auto-advancing back to the map; this button only ever reports the click.
// Corner-anchored (not centered like DebriefContinueButton) and z-40 so it
// stays above the "Mission Complete!" banner's own ParchmentOverlay (z-30).
export default function MissionCompleteButton({ onContinue }: MissionCompleteButtonProps) {
  return (
    <div className="absolute bottom-6 right-6 z-40">
      <button
        onClick={onContinue}
        className="neo-btn bg-green-400 hover:bg-green-300 text-white font-black uppercase text-sm px-8 py-3 rounded-xl"
      >
        Continue
      </button>
    </div>
  );
}
