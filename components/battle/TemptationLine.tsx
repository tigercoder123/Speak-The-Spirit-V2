'use client';

import React from 'react';
import { BATTLE_SCENE_SCALE } from '../../config/battleApproach';

interface TemptationLineProps {
  message: string;
}

// The Silencer's caption during the RESILENCE re-silence effect - no
// parchment here, the player is watching the battle scene itself, so this is
// just a floating caption over it, not a screen of its own. Scaled up by the
// same BATTLE_SCENE_SCALE as the rest of the battle scene, via a wrapper div
// rather than putting the transform directly on the <p> - the <p> already
// carries animate-slide-in-up, a CSS keyframe animation that also drives
// `transform` (translateY), which would otherwise fully override (not merge
// with) an inline transform set on the same element.
export default function TemptationLine({ message }: TemptationLineProps) {
  if (!message) return null;

  return (
    <div className="absolute inset-x-0 bottom-6 z-30 flex justify-center px-6">
      <div style={{ transform: `scale(${BATTLE_SCENE_SCALE})` }}>
        <p className="max-w-md text-center text-xs font-bold italic bg-slate-950 border-2 border-purple-800 text-purple-300 rounded-lg px-3 py-2 shadow-[3px_3px_0px_#000] animate-slide-in-up">
          {message}
        </p>
      </div>
    </div>
  );
}
