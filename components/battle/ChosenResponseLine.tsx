'use client';

import React from 'react';
import { BATTLE_SCENE_SCALE } from '../../config/battleApproach';

interface ChosenResponseLineProps {
  message: string;
}

// Caption showing the response the player just picked on the CHOICE screen -
// visible from the moment the player's own restoring animation begins until
// the removed gear item actually lands on the floor. No parchment here, same
// as TemptationLine - the player is watching the battle scene itself. Scaled
// up the same way as TemptationLine - see that file for why the transform
// lives on a wrapper div instead of directly on the animated <p>.
export default function ChosenResponseLine({ message }: ChosenResponseLineProps) {
  return (
    <div className="absolute inset-x-0 bottom-6 z-30 flex justify-center px-6">
      <div style={{ transform: `scale(${BATTLE_SCENE_SCALE})` }}>
        <p className="max-w-md text-center text-xs font-bold italic bg-amber-100 border-2 border-black text-amber-900 rounded-lg px-3 py-2 shadow-[3px_3px_0px_#000] animate-slide-in-up">
          &ldquo;{message}&rdquo;
        </p>
      </div>
    </div>
  );
}
