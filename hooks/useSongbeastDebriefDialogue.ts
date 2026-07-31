'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DebriefDialogueSpeaker,
  DebriefPlayerChoiceOption,
  SONGBEAST_DEBRIEF_DIALOGUE,
} from '../config/songbeastDebriefDialogue';

export type DebriefDialogueDisplay =
  | { kind: 'line'; speaker: DebriefDialogueSpeaker; text: string; hasMore: boolean }
  | { kind: 'cucumberGift'; prompt: string }
  | { kind: 'choice'; options: [DebriefPlayerChoiceOption, DebriefPlayerChoiceOption] }
  | null;

interface UseSongbeastDebriefDialogueOptions {
  /** True only while the battle hook's phase is DIALOGUE - drives the reset-on-(re)entry effect below. */
  active: boolean;
  /** Writes the gift to the player's existing GameContext cucumber balance - see hooks/useSilencerBattle.ts. */
  grantCucumbers: (amount: number) => void;
  /** Fired once the final line is dismissed - hands off to the battle hook's own returnToMap(). */
  onComplete: () => void;
}

/**
 * Sequencing engine for the RESTORED -> DEBRIEF_PROMPT -> DIALOGUE -> COMPLETE
 * debrief beats. Steps through config/songbeastDebriefDialogue.ts's static
 * script; a "dynamic queue" holds the player's spoken choice + the Songbeast's
 * branch-specific reply for Beat 4, since those two lines depend on which
 * option was picked rather than being fixed script entries.
 */
export function useSongbeastDebriefDialogue({ active, grantCucumbers, onComplete }: UseSongbeastDebriefDialogueOptions) {
  const [stepIndex, setStepIndex] = useState(0);
  const [giftAccepted, setGiftAccepted] = useState(false);
  const [dynamicQueue, setDynamicQueue] = useState<{ speaker: DebriefDialogueSpeaker; text: string }[]>([]);

  const steps = SONGBEAST_DEBRIEF_DIALOGUE;
  const currentStep = steps[stepIndex];

  // Each DIALOGUE entry replays the tape from the top - a battle replay
  // (startBattle) should never resume mid-dialogue or with the gift already
  // marked accepted from a previous run.
  useEffect(() => {
    if (!active) return;
    setStepIndex(0);
    setGiftAccepted(false);
    setDynamicQueue([]);
  }, [active]);

  const advance = useCallback(() => {
    if (!active) return;
    if (dynamicQueue.length > 0) {
      setDynamicQueue((q) => q.slice(1));
      return;
    }
    if (!currentStep) return;
    if (currentStep.type === 'cucumberGift' && !giftAccepted) return; // gated - must tap the cucumber itself
    if (currentStep.type === 'choice') return; // gated - must tap a response button
    if (stepIndex + 1 >= steps.length) {
      onComplete();
      return;
    }
    setStepIndex((i) => i + 1);
  }, [active, dynamicQueue, currentStep, giftAccepted, stepIndex, steps.length, onComplete]);

  const acceptGift = useCallback(() => {
    if (!currentStep || currentStep.type !== 'cucumberGift' || giftAccepted) return;
    setGiftAccepted(true);
    grantCucumbers(currentStep.amount);
  }, [currentStep, giftAccepted, grantCucumbers]);

  const choose = useCallback(
    (optionId: string) => {
      if (!currentStep || currentStep.type !== 'choice') return;
      const option = currentStep.options.find((o) => o.id === optionId);
      if (!option) return;
      // The final "Thank you" line sits immediately after the choice step in
      // the static script, so advancing stepIndex now already points at it -
      // the queued player/Songbeast lines below play first, then fall
      // straight through to that shared closing line for both branches.
      setDynamicQueue([
        { speaker: 'player', text: option.label },
        { speaker: 'songbeast', text: option.responseText },
      ]);
      setStepIndex((i) => i + 1);
    },
    [currentStep]
  );

  const display: DebriefDialogueDisplay = useMemo(() => {
    if (dynamicQueue.length > 0) {
      // Always "more" - a queued line is always followed by either another
      // queued line or the script's real next step, never a dead end.
      return { kind: 'line', speaker: dynamicQueue[0].speaker, text: dynamicQueue[0].text, hasMore: true };
    }
    if (!currentStep) return null;
    if (currentStep.type === 'line') {
      return { kind: 'line', speaker: currentStep.speaker, text: currentStep.text, hasMore: stepIndex + 1 < steps.length };
    }
    if (currentStep.type === 'cucumberGift') {
      return giftAccepted
        ? { kind: 'line', speaker: 'songbeast', text: currentStep.confirmation, hasMore: stepIndex + 1 < steps.length }
        : { kind: 'cucumberGift', prompt: currentStep.prompt };
    }
    return { kind: 'choice', options: currentStep.options };
  }, [dynamicQueue, currentStep, giftAccepted, stepIndex, steps.length]);

  const activeSpeaker: DebriefDialogueSpeaker | null = display?.kind === 'line' ? display.speaker : null;

  return { display, activeSpeaker, advance, acceptGift, choose };
}
