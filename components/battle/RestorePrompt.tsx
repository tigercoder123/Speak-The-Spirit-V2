'use client';

import React from 'react';
import { RESTORE_PROMPT_COPY } from '../../config/battleApproach';

interface RestorePromptProps {
  /** Whether the player is currently close enough to show the prompt - the
   * proximity hook/util owns this decision; this component only renders it. */
  visible: boolean;
  onConfirm: () => void;
}

// Flavor text + "Sing the Verse" button shown when the player walks close
// enough to the silenced Songbeast+Silencer on the exploration background -
// hidden again if they walk away. Purely presentational: visibility and the
// confirm callback come from props; copy comes from
// config/battleApproach.ts, not hardcoded here.
export default function RestorePrompt({ visible, onConfirm }: RestorePromptProps) {
  if (!visible) return null;

  return (
    <div className="absolute inset-x-0 bottom-6 z-30 flex justify-center px-6 animate-slide-in-up">
      <div className="max-w-sm bg-amber-100 border-4 border-black p-4 rounded-2xl text-black shadow-[4px_4px_0px_#000] text-center">
        <p className="text-xs font-bold italic leading-relaxed">{RESTORE_PROMPT_COPY.flavorText}</p>
        <button
          onClick={onConfirm}
          className="mt-3 neo-btn-restore text-white font-black uppercase text-sm px-6 py-2.5 rounded-xl neo-btn"
        >
          {RESTORE_PROMPT_COPY.buttonLabel}
        </button>
      </div>
    </div>
  );
}
