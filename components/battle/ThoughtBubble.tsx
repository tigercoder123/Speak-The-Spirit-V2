'use client';

import React from 'react';
import type { ThoughtBubbleBeat } from '../../hooks/useSilencerBattle';

export interface ThoughtBubblePosition {
  /** Pixels from the bottom of the nearest positioned ancestor. */
  bottom: number;
  /** Pixels from the right of the nearest positioned ancestor. */
  right: number;
}

interface ThoughtBubbleProps {
  /** What to show - null hides the bubble entirely (the typed-config
   * fallback was also unavailable, or there's nothing to show right now). */
  text: string | null;
  /** Whether the current beat wants the bubble showing - toggled
   * independently of `text` so the exit transition still has real text to
   * fade, instead of vanishing blank. */
  visible: boolean;
  /** Which beat this thought belongs to - CHOICE (reacting to the player's
   * chosen line) or RESILENCE (wavering back toward doubt at the Silencer's
   * line). Not currently used for different styling, but kept as a distinct
   * prop per the state machine's own beat distinction. */
  beat: ThoughtBubbleBeat | null;
  /** Where to anchor the bubble, in pixels from the bottom/right of whichever
   * positioned ancestor the caller renders this inside - the caller (see
   * SongbeastBattleAvatar.tsx) owns the Songbeast's own rendered box and
   * derives this from it, so the bubble stays correctly placed beside the
   * Songbeast's head rather than at an independent screen coordinate. */
  position: ThoughtBubblePosition;
}

// The muted Songbeast can't speak - RestoreBar carries the game's visible
// feedback, so this is a completely different read: the Songbeast's own
// unspoken inner thought, floating beside its head as a comic-strip thought
// cloud with trailing dots. Purely presentational and a pure function of
// props - the state machine (useSilencerBattle) owns what text shows, for
// which beat, and for how long, and the caller (SongbeastBattleAvatar) owns
// where the Songbeast itself renders; this component only ever renders what
// it's given. No self-owned state, no imperative DOM work - visibility is a
// CSS class swap so both the in and out transitions animate smoothly.
export default function ThoughtBubble({ text, visible, beat, position }: ThoughtBubbleProps) {
  if (!text) return null;

  return (
    <div
      className={`thought-bubble-anchor ${visible ? 'thought-bubble-visible' : ''}`}
      style={{ bottom: position.bottom, right: position.right }}
      aria-hidden={!visible}
      data-beat={beat ?? undefined}
    >
      <div className="thought-bubble-cloud">
        <p className="thought-bubble-text">{text}</p>
      </div>
      <span className="thought-bubble-dot thought-bubble-dot-lg" />
      <span className="thought-bubble-dot thought-bubble-dot-md" />
      <span className="thought-bubble-dot thought-bubble-dot-sm" />
    </div>
  );
}
