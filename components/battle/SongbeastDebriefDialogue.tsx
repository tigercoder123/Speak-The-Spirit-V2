'use client';

import React from 'react';
import { useGame } from '../../context/GameContext';
import { BATTLE_ASSETS, SONGBEAST_RESTORED_HEAD_PORTRAIT_CROP } from '../../config/battleAssets';
import type { DebriefDialogueDisplay } from '../../hooks/useSongbeastDebriefDialogue';
import DebriefSpeakerPortrait from './DebriefSpeakerPortrait';
import DebriefDialogueBox from './DebriefDialogueBox';
import DebriefCucumberGift from './DebriefCucumberGift';
import DebriefChoiceButtons from './DebriefChoiceButtons';

interface SongbeastDebriefDialogueProps {
  display: DebriefDialogueDisplay;
  activeSpeaker: 'songbeast' | 'player' | null;
  onAdvance: () => void;
  onAcceptGift: () => void;
  onChoose: (optionId: string) => void;
}

// Darkened overlay laid over the still-visible, frozen final battle scene
// (rendered by the caller, components/SilencerBattleScene.tsx, behind this) -
// a semi-transparent scrim (.debrief-overlay in app/globals.css), not a cut
// to black. The whole overlay is the click target to advance, per the "big
// click target, not a tiny arrow" requirement - interactive children
// (the cucumber, the choice buttons) stop propagation so their own taps
// don't also fire an advance.
export default function SongbeastDebriefDialogue({
  display,
  activeSpeaker,
  onAdvance,
  onAcceptGift,
  onChoose,
}: SongbeastDebriefDialogueProps) {
  const { characterPath } = useGame();

  if (!display) return null;

  return (
    <div className="debrief-overlay" onClick={onAdvance}>
      <div className="flex-1 flex items-center justify-center gap-8 px-6">
        <DebriefSpeakerPortrait
          imageSrc={BATTLE_ASSETS.songbeast.restored.head}
          alt="Songbeast (restored)"
          label="Songbeast"
          active={activeSpeaker === 'songbeast'}
          crop={SONGBEAST_RESTORED_HEAD_PORTRAIT_CROP}
        />
        <DebriefSpeakerPortrait
          imageSrc={characterPath}
          alt="Player"
          label="You"
          active={activeSpeaker === 'player'}
        />
      </div>

      <div className="px-6 pb-6">
        {display.kind === 'cucumberGift' && <DebriefCucumberGift prompt={display.prompt} onAccept={onAcceptGift} />}
        {display.kind === 'choice' && <DebriefChoiceButtons options={display.options} onChoose={onChoose} />}
        {display.kind === 'line' && <DebriefDialogueBox speaker={display.speaker} text={display.text} hasMore={display.hasMore} />}
      </div>
    </div>
  );
}
