'use client';

import React from 'react';
import type { DebriefDialogueSpeaker } from '../../config/songbeastDebriefDialogue';

interface DebriefDialogueBoxProps {
  speaker: DebriefDialogueSpeaker;
  text: string;
  /** Shows the blinking ▸ indicator when there's another line to advance to. */
  hasMore: boolean;
}

// Purely presentational - the box itself has no click handler; the whole
// darkened overlay (components/battle/SongbeastDebriefDialogue.tsx) is the
// click target so kids have a large, forgiving area to tap, not a tiny arrow.
export default function DebriefDialogueBox({ speaker, text, hasMore }: DebriefDialogueBoxProps) {
  const speakerLabel = speaker === 'songbeast' ? 'Songbeast' : 'You';

  return (
    <div className="debrief-dialogue-box mx-auto w-full max-w-lg bg-amber-100 border-4 border-black rounded-2xl p-4 shadow-[4px_4px_0px_#000] text-black">
      <p className="text-[10px] font-black uppercase tracking-widest text-purple-700 mb-1">{speakerLabel}</p>
      <p className="text-sm font-bold leading-relaxed">{text}</p>
      {hasMore && <p className="debrief-more-indicator text-right text-lg font-black text-purple-700 mt-1">▸</p>}
    </div>
  );
}
