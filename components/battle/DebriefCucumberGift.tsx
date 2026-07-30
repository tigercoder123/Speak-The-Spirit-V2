'use client';

import React from 'react';
import { CURRENCY_ASSETS } from '../../config/currencyAssets';

interface DebriefCucumberGiftProps {
  prompt: string;
  onAccept: () => void;
}

// Pops up center-screen in a glowy (CSS radial-gradient + pulse, see
// .cucumber-glow in app/globals.css) circle - gates dialogue advancement
// until tapped (see hooks/useSongbeastDebriefDialogue.ts's acceptGift/advance).
export default function DebriefCucumberGift({ prompt, onAccept }: DebriefCucumberGiftProps) {
  return (
    <div className="flex flex-col items-center gap-3 mb-4">
      <button
        onClick={(e) => {
          e.stopPropagation();
          onAccept();
        }}
        aria-label="Accept the cucumber gift"
        className="relative w-24 h-24 flex items-center justify-center"
      >
        <span className="cucumber-glow" />
        <img
          src={CURRENCY_ASSETS.cucumber}
          alt="Cucumber gift"
          className="relative z-10 w-16 h-16 object-contain animate-bounce"
        />
      </button>
      <p className="text-xs font-black uppercase text-yellow-200 text-center max-w-xs">{prompt}</p>
    </div>
  );
}
