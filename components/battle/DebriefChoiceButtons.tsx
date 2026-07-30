'use client';

import React from 'react';
import type { DebriefPlayerChoiceOption } from '../../config/songbeastDebriefDialogue';

interface DebriefChoiceButtonsProps {
  options: [DebriefPlayerChoiceOption, DebriefPlayerChoiceOption];
  onChoose: (optionId: string) => void;
}

// Beat 4's send-off choice - both options are affirming, just different tone
// (see config/songbeastDebriefDialogue.ts). Gates dialogue advancement until
// one is picked (hooks/useSongbeastDebriefDialogue.ts's choose/advance).
export default function DebriefChoiceButtons({ options, onChoose }: DebriefChoiceButtonsProps) {
  return (
    <div className="mx-auto w-full max-w-lg flex flex-col sm:flex-row gap-2 mb-3">
      {options.map((option) => (
        <button
          key={option.id}
          onClick={(e) => {
            e.stopPropagation();
            onChoose(option.id);
          }}
          className="neo-btn neo-btn-restore flex-1 text-white font-black text-xs uppercase px-4 py-3 rounded-xl"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
