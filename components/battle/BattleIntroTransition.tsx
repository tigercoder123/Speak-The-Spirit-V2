'use client';

import { useRef, type ReactNode } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { INTRO_TRANSITION_DURATION_MS } from '../../config/battleApproach';

interface BattleIntroTransitionProps {
  children: ReactNode;
}

// Wraps the battle-framed view (zoomed-in background + avatar) so it plays
// a scale-up + cross-fade push-in on mount, right as the state machine
// swaps from EXPLORING into INTRO (see hooks/useSilencerBattle.ts) - reads
// as a cinematic push toward the Songbeast. Mirrors
// components/battle/ParchmentOverlay.tsx's own GSAP mount-in fade/scale
// pattern rather than inventing a new animation technique. Purely
// presentational - the state machine owns when this mounts; this only
// plays the reveal.
export default function BattleIntroTransition({ children }: BattleIntroTransitionProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    gsap.set(contentRef.current, { opacity: 0, scale: 0.85 });
    gsap.to(contentRef.current, {
      opacity: 1,
      scale: 1,
      duration: INTRO_TRANSITION_DURATION_MS / 1000,
      ease: 'power2.out',
    });
  }, []);

  return <div ref={contentRef}>{children}</div>;
}
