'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { BATTLE_ASSETS } from '../../config/battleAssets';
import type { GearPieceState, ThoughtBubbleBeat } from '../../hooks/useSilencerBattle';
import RestoreBar from './RestoreBar';
import ThoughtBubble from './ThoughtBubble';

/**
 * SongbeastBattleAvatar - the animated battle scene: idle breathing, the
 * player's Speak-Truth gear-removal cascade, the Silencer's re-silence
 * comeback, and the final-restoration golden flash. Purely presentational -
 * gear state and all game logic live in useSilencerBattle; this component
 * only reacts to the phase-driven props/triggers it's given and reports
 * animation-beat callbacks back up.
 */

type Phase = 'idle' | 'player' | 'setback' | 'restored';

// Gear: each tracked item has 3 states - on (default), half (askew), off (on the floor).
type GearState = 'on' | 'half' | 'off';
type GearKey = 'headphones' | 'glasses' | 'muzzle';

// Index order matches GearPieceState[] from the hook - see
// config/battleAssets.ts's `songbeast` keys.
const GEAR_ORDER: GearKey[] = ['headphones', 'glasses', 'muzzle'];

function toGearState(piece: GearPieceState): GearState {
  if (piece === 'REMOVED') return 'off';
  if (piece === 'HALF_ON') return 'half';
  return 'on';
}

function toGearStatusRecord(pieces: GearPieceState[]): Record<GearKey, GearState> {
  return {
    headphones: toGearState(pieces[0]),
    glasses: toGearState(pieces[1]),
    muzzle: toGearState(pieces[2]),
  };
}

type GearChange = { key: GearKey; from: GearState; to: GearState };

// Diffs the previously-rendered gear status against the hook's newly
// committed gearPieces (already the "next" value by the time an animation
// trigger fires - the hook commits gear state synchronously on submit, well
// before the visual reveal) to find out which pieces actually changed and
// how, so the cascade/restore tweens below animate exactly the pieces the
// hook says moved, with no gear-cascade math of its own.
function diffGearStatus(
  from: Record<GearKey, GearState>,
  to: Record<GearKey, GearState>
): GearChange[] {
  const changes: GearChange[] = [];
  for (const key of GEAR_ORDER) {
    if (from[key] !== to[key]) changes.push({ key, from: from[key], to: to[key] });
  }
  return changes;
}

// Static resting poses (in the head's own local coordinates) - reused both by the
// animated Speak Truth cascade and by the plain gsap.set() correction effect below,
// so debug-panel toggles and real gameplay always land on identical values.
const ASKEW_POSE: Record<GearKey, { rotation: number; x: number; y: number; scaleX?: number }> = {
  headphones: { rotation: -35, x: 25, y: -35, scaleX: -1 },
  glasses: { rotation: 10, x: 3, y: -2 },
  muzzle: { rotation: -8, x: 5, y: 4 },
};

// Where each item lands on the floor (relative to floorBehindRef's/floorFrontRef's
// own inset-0 box, which is the same size/position as the head's box, just
// static/untransformed).
const FLOOR_POSE: Record<GearKey, { x: number; y: number; rotation: number; scale: number }> = {
  headphones: { x: -70, y: 85, rotation: -30, scale: 0.8 },
  glasses: { x: -70, y: 100, rotation: 15, scale: 0.72 },
  muzzle: { x: -20, y: 90, rotation: -12, scale: 0.75 },
};

// Speak Lies hover pose - where gear levitates to (in front of the face) while
// held up for the 1s beat, before the Songbeast slumps into it.
const HOVER_POSE: Record<GearKey, { x: number; y: number; rotation: number; scale: number }> = {
  headphones: { x: -15, y: 15, rotation: 0, scale: 1.08 },
  glasses: { x: -5, y: 7, rotation: 0, scale: 1.06 },
  muzzle: { x: -25, y: 25, rotation: 0, scale: 1.05 },
};

// The Speak Lies restore glow (see buildSetbackTweens) traces each gear
// item's own opaque pixels via CSS drop-shadow - stacking 3 drop-shadows at
// increasing radius/decreasing opacity builds up a substantial, unmistakable
// halo regardless of the underlying shape.
function glowFilter(radii: [number, number, number], alphas: [number, number, number]): string {
  return radii.map((r, i) => `drop-shadow(0px 0px ${r}px rgba(168,85,247,${alphas[i]}))`).join(' ');
}
const RESTORE_GLOW_OFF = glowFilter([0, 0, 0], [0, 0, 0]);
const RESTORE_GLOW_ON: Record<GearKey, string> = {
  headphones: glowFilter([6, 14, 24], [1, 0.85, 0.6]),
  glasses: glowFilter([8, 18, 32], [1, 0.9, 0.7]),
  muzzle: glowFilter([8, 18, 32], [1, 0.9, 0.7]),
};

// The Songbeast's own rendered box within this component's `relative flex-1`
// scene container below - mirrors the songbeastGroupRef div's own
// `bottom-[120px] right-[110px] h-44 w-80` classes (Tailwind's arbitrary
// values can't be derived from a JS constant, so if those classes ever
// change, update these numbers to match). Single source of truth for
// "where is the Songbeast" so anything anchored to it (the restore bar
// above its head, the thought bubble in front of its forehead) derives its
// position from this box instead of guessing independent screen
// coordinates - both stay correctly placed if the box above moves or the
// container resizes, since they share the exact same `relative` parent and
// reference frame.
const SONGBEAST_BOX = { bottom: 120, right: 110, width: 320, height: 176 };

// Where the Songbeast's forehead actually renders, in the same bottom/right
// frame as SONGBEAST_BOX above. The head artwork has transparent margin
// baked into its source PNG rather than filling the box edge-to-edge (and
// the box's own 1.08 scale grows it upward from its bottom edge), so this
// is calibrated directly against the rendered art instead of derived by
// formula from the box's edges - it's still relative to the same parent,
// so it stays correct if SONGBEAST_BOX's position changes, just not if the
// art itself is swapped for a differently-proportioned image.
const FOREHEAD = { bottom: 260, right: 326 };

// Shortened (rather than spanning the Songbeast's full width) and centered
// above the forehead. Held well clear of the thought bubble below it - the
// bubble's cloud rises roughly 110px above FOREHEAD.bottom, so this sits
// above that with a clean gap rather than overlapping it.
const RESTORE_BAR_WIDTH = 160;
const RESTORE_BAR_POSITION = {
  bottom: FOREHEAD.bottom + 120 - 18,
  right: FOREHEAD.right - RESTORE_BAR_WIDTH / 2,
  width: RESTORE_BAR_WIDTH,
};

// Anchored right at the forehead so its trailing dots read as coming from
// it, nudged slightly to one side rather than dead-centered.
const THOUGHT_BUBBLE_POSITION = {
  bottom: FOREHEAD.bottom - 2,
  right: FOREHEAD.right - 45,
};

interface SongbeastBattleAvatarProps {
  /** Current authoritative gear state from the hook - [headphones, glasses, muzzle]. */
  gearPieces: GearPieceState[];
  /** Bump to run an isolated Silencer re-silence turn (the wrong-answer path). */
  silencerTurnRequestId: number;
  /** Fires once that isolated turn's animation finishes. */
  onSilencerTurnComplete: () => void;
  /** Bump to run the full player turn (gear-removal cascade), then chain into
   * the Silencer's comeback (or, on the final round, full restoration). */
  battleTurnRequestId: number;
  /** Fires when the player turn's own timeline completes - gear is removed, bar has risen. */
  onGearRemoved: () => void;
  /** Fires the instant the removed gear item actually lands, well before onGearRemoved. */
  onGearLanded: () => void;
  /** Fires the instant the Silencer's re-silence beat begins (either path). */
  onReSilenceEffectStart: () => void;
  /** Fires once the full-restore victory sequence finishes. */
  onFinalRestorationComplete: () => void;
  /** Whether this upcoming correct turn ends the battle (golden flash, sprite
   * swap, Silencer gone for good) instead of the Silencer's usual comeback. */
  isFinalTurn: boolean;
  /** Dev cheat (see GameHeader.tsx's "Cheat: Restored" button) - mounts
   * already in the fully-restored pose (restored sprites, Silencer gone,
   * majestic idle breathing) instead of playing the idle/gear-on state and
   * waiting for a real final-restoration animation to reach it. */
  startRestored?: boolean;
  /** Restoration progress (0-100) - rendered directly above the Songbeast's
   * head via RestoreBar, so this owns the bar's positioning instead of the
   * scene component. */
  restorePercent: number;
  /** Whether the restore bar should be showing - false while the parchment
   * (verse challenge, feedback banners, response choices) covers the scene,
   * so the bar never floats over that content. */
  restoreBarVisible: boolean;
  /** Text for the Songbeast's thought bubble, rendered in front of its
   * forehead - null hides it (see components/battle/ThoughtBubble.tsx). */
  thoughtBubbleText: string | null;
  /** Whether the thought bubble's current beat wants it showing. */
  thoughtBubbleVisible: boolean;
  /** Which beat the current thought bubble text belongs to. */
  thoughtBubbleBeat: ThoughtBubbleBeat | null;
}

export default function SongbeastBattleAvatar({
  gearPieces,
  silencerTurnRequestId,
  onSilencerTurnComplete,
  battleTurnRequestId,
  onGearRemoved,
  onGearLanded,
  onReSilenceEffectStart,
  onFinalRestorationComplete,
  isFinalTurn,
  startRestored = false,
  restorePercent,
  restoreBarVisible,
  thoughtBubbleText,
  thoughtBubbleVisible,
  thoughtBubbleBeat,
}: SongbeastBattleAvatarProps) {
  const [, setPhase] = useState<Phase>(() => (startRestored ? 'restored' : 'idle'));
  const phaseRef = useRef<Phase>(startRestored ? 'restored' : 'idle');
  const setPhaseBoth = (next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  };
  const isFinalTurnRef = useRef(isFinalTurn);
  const gearPiecesRef = useRef(gearPieces);

  // The last-committed (currently at-rest) gear status - only updated at the
  // specific moments a cascade/restore tween actually lands, so the resting-
  // pose effect below never snaps gear to its final pose before the
  // animation gets there.
  const [gearStatus, setGearStatus] = useState<Record<GearKey, GearState>>(() => toGearStatusRecord(gearPieces));
  const gearStatusRef = useRef(gearStatus);

  // Mirrored into refs (via an effect, not during render) so contextSafe-
  // wrapped functions - which can fire from GSAP timeline callbacks scheduled
  // several renders earlier - always read the truly-current value.
  useEffect(() => {
    isFinalTurnRef.current = isFinalTurn;
    gearPiecesRef.current = gearPieces;
    gearStatusRef.current = gearStatus;
  }, [isFinalTurn, gearPieces, gearStatus]);

  // Player
  const playerRef = useRef<HTMLImageElement>(null);
  const playerArmRef = useRef<HTMLImageElement>(null);
  const armContainerRef = useRef(null);

  // Songbeast - layered anatomy.
  // Only torsoGroupRef (torso + wing) breathes; legs+tail and lower-mane stay planted.
  const legsRef = useRef<HTMLImageElement>(null);
  const torsoGroupRef = useRef<HTMLDivElement>(null);
  const headContainerRef = useRef<HTMLDivElement>(null);
  // Body + head img elements specifically (as opposed to their group
  // containers above) - final restoration swaps these three `src`s to the
  // restored sprites at the peak of the golden flash.
  const songbeastBodyImgRef = useRef<HTMLImageElement>(null);
  const songbeastHeadImgRef = useRef<HTMLImageElement>(null);

  // Gear - Main and Add stay as SEPARATE DOM nodes (siblings within
  // headContainerRef, at their own z-indices) so Add can render behind the head
  // and Main in front of it - a single shared parent can't do that, since a
  // parent's children can't be split across a sibling's z-index. Instead, "moves
  // together" is guaranteed by always animating [addRef, mainRef] as ONE array
  // target in a single GSAP call - one tween instance, byte-identical values on
  // both nodes every frame, no possibility of drift.
  const headphonesMainRef = useRef<HTMLImageElement>(null);
  const headphonesAddRef = useRef<HTMLImageElement>(null);
  const glassesMainRef = useRef<HTMLImageElement>(null);
  const glassesAddRef = useRef<HTMLImageElement>(null);
  const muzzleRef = useRef<HTMLImageElement>(null);
  // Static, never-animated containers gear lands in once "off" - decouples it
  // from every head tween (idle breathing, dip & whip, etc.) for good.
  const floorBehindRef = useRef<HTMLDivElement>(null);
  const floorFrontRef = useRef<HTMLDivElement>(null);

  // Lookup used by the Speak Truth cascade to find each category's DOM refs.
  const gearRefs: Record<
    GearKey,
    { main: RefObject<HTMLImageElement | null>; add: RefObject<HTMLImageElement | null> | null }
  > = {
    headphones: { main: headphonesMainRef, add: headphonesAddRef },
    glasses: { main: glassesMainRef, add: glassesAddRef },
    muzzle: { main: muzzleRef, add: null },
  };

  // Silencer - distant antagonist beyond the Songbeast, controlling it from behind.
  const silencerGroupRef = useRef<HTMLDivElement>(null);
  // Outer box wrapping the Songbeast's whole anatomy (legs/torso/head/gear) -
  // holds the baseline "scale everything up a little" bump, and gets tweened
  // bigger still at final restoration.
  const songbeastGroupRef = useRef<HTMLDivElement>(null);
  const silencerArmRef = useRef<HTMLImageElement>(null);

  // VFX
  const truthWaveRef = useRef<HTMLDivElement>(null);
  const silencerWaveRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const restoreFlashRef = useRef<HTMLDivElement>(null);

  // Idle tweens we need to pause/resume/kill on transitions.
  const idleTweens = useRef<gsap.core.Tween[]>([]);
  const { contextSafe } = useGSAP();

  // ---------------------------------------------------------------------------
  // Gear correctness effect: whenever gearStatus changes - by a committed
  // cascade/restore below - make sure both nodes of a pair live under the
  // right parent (head vs. floor) and instantly snap them to the right
  // resting pose. This is the safety net; the cascade's own tweens animate
  // INTO these same numeric values first so nothing visibly pops when this
  // effect re-applies them a moment later. Nodes are NEVER unmounted/
  // recreated and NEVER faded - moveGearInto() just relocates the existing
  // elements with plain appendChild, so they stay 100% visible the whole time.
  // ---------------------------------------------------------------------------
  const moveGearInto = (els: (HTMLElement | null)[], parent: HTMLElement | null) => {
    if (!parent) return;
    for (const el of els) {
      if (el && el.parentElement !== parent) parent.appendChild(el);
    }
  };

  const applyGearRestingPose = (
    mainRef: RefObject<HTMLElement | null>,
    addRef: RefObject<HTMLElement | null> | null,
    state: GearState,
    key: GearKey
  ) => {
    const mainEl = mainRef.current;
    const addEl = addRef?.current ?? null;
    const targets = [mainEl, addEl].filter((el): el is HTMLElement => el !== null);
    if (targets.length === 0) return;

    if (state === 'off') {
      // Main (+ muzzle, which has no add) goes to the "in front" floor spot;
      // Add goes to the "behind" one - same split as head-mounted.
      moveGearInto(mainEl ? [mainEl] : [], floorFrontRef.current);
      moveGearInto(addEl ? [addEl] : [], floorBehindRef.current);
      const f = FLOOR_POSE[key];
      gsap.set(targets, { rotation: f.rotation, x: f.x, y: f.y, scale: f.scale });
    } else {
      moveGearInto(targets, headContainerRef.current);
      if (state === 'half') {
        const p = ASKEW_POSE[key];
        gsap.set(targets, { rotation: p.rotation, x: p.x, y: p.y, scale: 1 });
      } else {
        gsap.set(targets, { rotation: 0, x: 0, y: 0, scale: 1 });
      }
    }
  };

  useGSAP(() => {
    applyGearRestingPose(headphonesMainRef, headphonesAddRef, gearStatus.headphones, 'headphones');
    applyGearRestingPose(glassesMainRef, glassesAddRef, gearStatus.glasses, 'glasses');
    applyGearRestingPose(muzzleRef, null, gearStatus.muzzle, 'muzzle');
  }, [gearStatus]);

  // ---------------------------------------------------------------------------
  // Phase 1 - Idle: heavy/erratic breathing + drooping head, subtle player sway
  // ---------------------------------------------------------------------------
  // contextSafe registers `func` with the GSAP context for safe cleanup; it
  // doesn't invoke it during render, so this is safe despite the lint rule's
  // static analysis not being able to see that.
  // eslint-disable-next-line react-hooks/refs
  const startIdle = contextSafe(() => {
    idleTweens.current.forEach((t) => t.kill());
    idleTweens.current = [];

    idleTweens.current.push(
      gsap.to(torsoGroupRef.current, {
        scaleY: 1.025,
        duration: 1.4,
        ease: 'power1.inOut',
        yoyo: true,
        repeat: -1,
        transformOrigin: '50% 100%',
      })
    );
    idleTweens.current.push(
      gsap.to(torsoGroupRef.current, {
        scaleX: 0.99,
        duration: 0.73,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
      })
    );
    idleTweens.current.push(
      gsap.to(headContainerRef.current, {
        rotation: 0.3,
        y: -1,
        duration: 1.4,
        ease: 'power1.inOut',
        yoyo: true,
        repeat: -1,
        transformOrigin: '50% 100%',
      })
    );
    idleTweens.current.push(
      gsap.to([playerRef.current, playerArmRef.current], {
        scaleY: 1.01,
        duration: 1.5,
        ease: 'power1.inOut',
        yoyo: true,
        repeat: -1,
        transformOrigin: '50% 100%',
      })
    );
    idleTweens.current.push(
      gsap.to(playerArmRef.current, {
        rotation: 1.4,
        duration: 1.75,
        ease: 'power1.inOut',
        yoyo: true,
        repeat: -1,
        transformOrigin: '40% 45%',
      })
    );
    idleTweens.current.push(
      gsap.to(silencerGroupRef.current, {
        y: -4,
        scaleY: 1.02,
        scaleX: 0.98,
        duration: 1.6,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
        transformOrigin: '50% 100%',
      })
    );
    idleTweens.current.push(
      gsap.to(silencerGroupRef.current, {
        scaleX: 0.985,
        duration: 0.93,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
      })
    );
  });

  // Kicks off idle breathing once on mount, now that startIdle is declared -
  // unless the dev cheat (startRestored) skips straight past the whole
  // silenced/idle state: gone Silencer + grown Songbeast match
  // buildFinalRestorationTweens' own end-state (see finalRestoration below),
  // just set instantly instead of tweened. useGSAP runs this in a
  // useLayoutEffect, so this resolves before the browser's first paint - no
  // flash of the silenced pose first.
  useGSAP(() => {
    if (startRestored) {
      gsap.set(silencerGroupRef.current, { opacity: 0 });
      gsap.set(songbeastGroupRef.current, { scale: 1.16 });
      gsap.set(songbeastHeadImgRef.current, { y: 0 });
      startMajesticIdle();
    } else {
      startIdle();
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Phase 2 - Player turn: arm sweep, truth wave, gasp + dip-and-whip
  // ---------------------------------------------------------------------------
  const buildPlayerTurnTweens = (tl: gsap.core.Timeline, gearChanges: GearChange[], nextGearStatus: Record<GearKey, GearState>) => {
    tl.addLabel('phase2');

    tl.to(playerArmRef.current, { rotation: -55, duration: 0.3, ease: 'power2.out', transformOrigin: '40% 45%' }, 'phase2');
    tl.to(playerArmRef.current, { rotation: -35, duration: 0.2, ease: 'power3.in' }, 'phase2+=0.3');

    tl.set(truthWaveRef.current, { opacity: 0, x: 0, y: 0, rotation: 0, scale: 0.3 }, 'phase2');
    tl.to(truthWaveRef.current, { opacity: 1, scale: 0.9, duration: 0.2, ease: 'power1.out' }, 'phase2+=0.6');
    tl.to(truthWaveRef.current, { x: 298, y: 40, rotation: 12, scale: 1.8, duration: 0.7, ease: 'power2.out' }, 'phase2+=0.8');
    tl.to(truthWaveRef.current, { opacity: 0, scale: 2.4, duration: 0.2, ease: 'power1.out' }, 'phase2+=1.45');

    tl.to(glowRef.current, { opacity: 0.9, duration: 0.3, ease: 'power1.out' }, 'phase2+=1.5');
    tl.to(glowRef.current, { opacity: 0, duration: 0.3, ease: 'power1.in' }, 'phase2+=1.8');

    const headPivot = '50% 88%';
    const torsoPivot = '50% 100%';

    tl.to(headContainerRef.current, { rotation: 8, duration: 0.32, ease: 'power2.in', transformOrigin: headPivot }, 'phase2+=2.25');
    tl.to(torsoGroupRef.current, { rotation: 2, duration: 0.32, ease: 'power2.in', transformOrigin: torsoPivot }, 'phase2+=2.29');

    tl.to(headContainerRef.current, { rotation: -7, duration: 0.14, ease: 'power3.out' }, 'phase2+=2.57');
    tl.to(torsoGroupRef.current, { rotation: -1.5, duration: 0.14, ease: 'power3.out' }, 'phase2+=2.61');

    tl.to(headContainerRef.current, { rotation: 0, duration: 0.45, ease: 'elastic.out(1, 0.55)' }, 'phase2+=2.71');
    tl.to(torsoGroupRef.current, { rotation: 0, duration: 0.45, ease: 'elastic.out(1, 0.55)' }, 'phase2+=2.75');

    // Speak Truth's gear cascade - whatever the hook says changed comes loose
    // right on the whip itself.
    const whipTime = 'phase2+=2.57';
    for (const change of gearChanges) {
      const { main, add } = gearRefs[change.key];
      const targets = [main.current, add?.current ?? null].filter((el): el is HTMLImageElement => el !== null);
      if (targets.length === 0) continue;

      if (change.to === 'half') {
        const p = ASKEW_POSE[change.key];
        tl.to(targets, { rotation: p.rotation, x: p.x, y: p.y, duration: 0.35, ease: 'back.out(2.5)' }, whipTime);
      } else {
        const f = FLOOR_POSE[change.key];
        tl.to(targets, { x: f.x, y: f.y, rotation: f.rotation, scale: f.scale, duration: 0.6, ease: 'power2.out' }, whipTime);
      }
    }
    if (gearChanges.length > 0) {
      tl.add(() => {
        setGearStatus(nextGearStatus);
        onGearLanded();
      }, 'phase2+=3.20');
    }

    tl.to(playerArmRef.current, { rotation: 0, duration: 0.5, ease: 'power2.inOut' }, 'phase2+=1.3');
  };

  // eslint-disable-next-line react-hooks/refs
  const playerTurn = contextSafe(() => {
    if (phaseRef.current !== 'idle') return;
    setPhaseBoth('player');

    idleTweens.current.forEach((t) => t.pause());

    const nextGearStatus = toGearStatusRecord(gearPiecesRef.current);
    const gearChanges = diffGearStatus(gearStatusRef.current, nextGearStatus);
    const isFinal = isFinalTurnRef.current;

    const tl = gsap.timeline({
      onComplete: () => {
        onGearRemoved();
        if (isFinal) {
          finalRestoration();
        } else {
          gsap.delayedCall(0.35, () => setback());
        }
      },
    });

    buildPlayerTurnTweens(tl, gearChanges, nextGearStatus);
  });

  // ---------------------------------------------------------------------------
  // Phase 3 - Setback: dark wave from off-screen right, cower
  // ---------------------------------------------------------------------------
  const buildSetbackTweens = (tl: gsap.core.Timeline, gearRestoreChanges: GearChange[], nextGearStatusRestore: Record<GearKey, GearState>) => {
    tl.addLabel('phase3');

    tl.to(silencerArmRef.current, { rotation: -55, duration: 0.32, ease: 'power2.out' }, 'phase3');
    tl.to(silencerArmRef.current, { rotation: 12, duration: 0.2, ease: 'power3.in' }, 'phase3+=0.32');
    tl.to(silencerArmRef.current, { rotation: 0, duration: 0.35, ease: 'elastic.out(1, 0.6)' }, 'phase3+=0.52');

    tl.set(silencerWaveRef.current, { opacity: 0, x: 0, y: 0, scale: 0.3 }, 'phase3+=0.32');
    tl.to(silencerWaveRef.current, { opacity: 1, scale: 0.9, duration: 0.2, ease: 'power1.out' }, 'phase3+=0.32');
    tl.to(silencerWaveRef.current, { x: -166, y: 36, scale: 1.8, duration: 0.75, ease: 'power2.in' }, 'phase3+=0.52');

    tl.to(silencerWaveRef.current, { opacity: 0, scale: 2.4, duration: 0.3, ease: 'power1.out' });

    // -------------------------------------------------------------------------
    // Speak Lies: the Silencer restores exactly 1 gear level, repairing
    // whichever item the hook says changed.
    // -------------------------------------------------------------------------
    if (gearRestoreChanges.length > 0) {
      const change = gearRestoreChanges[0]; // exactly one item can change per +1 level
      const { main, add } = gearRefs[change.key];
      const targets = [main.current, add?.current ?? null].filter((el): el is HTMLImageElement => el !== null);

      if (targets.length > 0) {
        tl.addLabel('restore');

        tl.set(targets, { filter: RESTORE_GLOW_OFF }, 'restore');
        tl.to(targets, { filter: RESTORE_GLOW_ON[change.key], duration: 0.4, ease: 'power1.out' }, 'restore');

        const hover = HOVER_POSE[change.key];
        tl.to(targets, { x: hover.x, y: hover.y, rotation: hover.rotation, scale: hover.scale, duration: 0.5, ease: 'power2.out' }, 'restore+=0.1');

        tl.to(
          [torsoGroupRef.current, headContainerRef.current],
          { rotation: -5, y: 10, duration: 0.5, ease: 'sine.inOut', transformOrigin: '50% 100%' },
          'restore+=1.6'
        );

        const targetPose = change.to === 'half' ? ASKEW_POSE[change.key] : { rotation: 0, x: 0, y: 0 };
        tl.set(restoreFlashRef.current, { x: targetPose.x, y: targetPose.y }, 'restore+=1.95');
        tl.to(restoreFlashRef.current, { opacity: 0.85, duration: 0.12, ease: 'power1.out' }, 'restore+=1.95');
        tl.to(restoreFlashRef.current, { opacity: 0, duration: 0.35, ease: 'power1.in' }, 'restore+=2.07');

        tl.to(
          targets,
          { rotation: targetPose.rotation, x: targetPose.x, y: targetPose.y, scale: 1, duration: 0.25, ease: 'back.out(2)' },
          'restore+=1.95'
        );
        tl.to(targets, { filter: RESTORE_GLOW_OFF, duration: 0.35, ease: 'power1.in' }, 'restore+=1.95');

        tl.to(
          [torsoGroupRef.current, headContainerRef.current],
          { rotation: 0, y: 0, scaleY: 1, duration: 0.5, ease: 'sine.inOut' },
          'restore+=2.1'
        );

        tl.add(() => setGearStatus(nextGearStatusRestore), 'restore+=2.55');
      }
    }
  };

  // eslint-disable-next-line react-hooks/refs
  const setback = contextSafe(() => {
    setPhaseBoth('setback');
    onReSilenceEffectStart();

    idleTweens.current.forEach((t) => t.pause());

    const nextGearStatusRestore = toGearStatusRecord(gearPiecesRef.current);
    const gearRestoreChanges = diffGearStatus(gearStatusRef.current, nextGearStatusRestore);

    const tl = gsap.timeline({
      onComplete: () => {
        setPhaseBoth('idle');
        idleTweens.current.forEach((t) => t.resume());
        onSilencerTurnComplete();
      },
    });

    buildSetbackTweens(tl, gearRestoreChanges, nextGearStatusRestore);
  });

  // Fires an isolated Silencer turn whenever the parent bumps
  // silencerTurnRequestId - skips the mount-time call so an initial value of
  // 0 doesn't fire setback() immediately. Compares against the LAST-HANDLED
  // VALUE rather than a fired-once boolean flag: under React StrictMode,
  // effects run twice at mount specifically to catch bugs like a boolean
  // flag - comparing values instead means both mount passes skip identically.
  const lastHandledSilencerTurnRequestId = useRef(silencerTurnRequestId);
  useGSAP(() => {
    if (lastHandledSilencerTurnRequestId.current === silencerTurnRequestId) return;
    lastHandledSilencerTurnRequestId.current = silencerTurnRequestId;
    setback();
    // setback is intentionally excluded from deps: it's a fresh closure every
    // render, so including it would re-fire this effect on every render
    // instead of only on silencerTurnRequestId bumps.
  }, [silencerTurnRequestId]);

  // Fires the full player turn whenever the parent bumps battleTurnRequestId
  // - same last-handled-value pattern as the Silencer trigger above.
  const lastHandledBattleTurnRequestId = useRef(battleTurnRequestId);
  useGSAP(() => {
    if (lastHandledBattleTurnRequestId.current === battleTurnRequestId) return;
    lastHandledBattleTurnRequestId.current = battleTurnRequestId;
    playerTurn();
  }, [battleTurnRequestId]);

  // ---------------------------------------------------------------------------
  // Phase 4 - Final restoration: final sweep, massive wave, golden flash (sprite
  // swap + Silencer fade-out hidden at its peak), majestic breathing after.
  // ---------------------------------------------------------------------------
  const buildFinalRestorationTweens = (tl: gsap.core.Timeline) => {
    tl.addLabel('phase4');

    tl.to(playerArmRef.current, { rotation: -40, duration: 0.4, ease: 'power2.out', transformOrigin: '40% 45%' }, 'phase4');
    tl.to(playerArmRef.current, { rotation: 0, duration: 0.6, ease: 'power2.inOut' }, '+=0.3');

    tl.set(truthWaveRef.current, { opacity: 0, x: 0, y: 0, rotation: 0, scale: 0.5 }, 'phase4');
    tl.to(truthWaveRef.current, { opacity: 1, scale: 1.5, duration: 0.25 }, 'phase4+=0.3');
    tl.to(truthWaveRef.current, { x: 298, y: 40, rotation: 12, duration: 0.6, ease: 'power1.in' }, 'phase4+=0.4');
    tl.to(truthWaveRef.current, { opacity: 0, scale: 3, duration: 0.4 }, 'phase4+=1.0');

    tl.to(headContainerRef.current, { rotation: -6, y: -10, duration: 0.6, ease: 'power2.out', transformOrigin: '50% 100%' }, 'phase4+=1.0');

    tl.set(glowRef.current, { opacity: 0, scale: 1 }, 'phase4+=1.0');
    tl.to(glowRef.current, { opacity: 1, scale: 4.5, duration: 0.5, ease: 'power2.in' }, 'phase4+=1.1');

    tl.add(() => {
      if (songbeastBodyImgRef.current) songbeastBodyImgRef.current.src = BATTLE_ASSETS.songbeast.restored.body;
      if (songbeastHeadImgRef.current) songbeastHeadImgRef.current.src = BATTLE_ASSETS.songbeast.restored.head;
      if (legsRef.current) legsRef.current.src = BATTLE_ASSETS.songbeast.restored.legs;
      gsap.set(songbeastHeadImgRef.current, { y: 0 });
    }, 'phase4+=1.6');

    tl.to(silencerGroupRef.current, { opacity: 0, scale: 0.9, duration: 0.6, ease: 'power1.in' }, 'phase4+=1.6');

    tl.to(songbeastGroupRef.current, { scale: 1.16, duration: 0.6, ease: 'power2.out' }, 'phase4+=1.6');

    tl.to(glowRef.current, { opacity: 0, scale: 1, duration: 0.7, ease: 'power2.out' }, 'phase4+=1.75');
  };

  // eslint-disable-next-line react-hooks/refs
  const finalRestoration = contextSafe(() => {
    setPhaseBoth('restored');
    idleTweens.current.forEach((t) => t.kill());
    idleTweens.current = [];

    const tl = gsap.timeline();
    buildFinalRestorationTweens(tl);

    tl.add(() => {
      startMajesticIdle();
      onFinalRestorationComplete();
    });
  });

  // eslint-disable-next-line react-hooks/refs
  const startMajesticIdle = contextSafe(() => {
    idleTweens.current.forEach((t) => t.kill());
    idleTweens.current = [];

    idleTweens.current.push(
      gsap.to(torsoGroupRef.current, {
        scaleY: 1.03,
        duration: 2.2,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
        transformOrigin: '50% 100%',
      })
    );
    idleTweens.current.push(
      gsap.to(headContainerRef.current, {
        rotation: -1,
        y: -1,
        duration: 2.6,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
        transformOrigin: '50% 50%',
      })
    );
    idleTweens.current.push(
      gsap.to(playerRef.current, {
        y: -6,
        duration: 2.4,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
      })
    );
  });

  return (
    <div className="relative mx-auto flex h-[520px] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-gradient-to-b from-emerald-950 to-slate-900 text-white">
      <div className="relative flex-1">
        <img
          src={BATTLE_ASSETS.backgrounds.zoomedIn}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />

        <div
          className="pointer-events-none absolute h-4 rounded-full"
          style={{
            bottom: '52px',
            left: '78px',
            width: '116px',
            background: 'radial-gradient(ellipse, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.22) 55%, rgba(0,0,0,0) 75%)',
          }}
        />

        <div
          className="absolute bottom-[52px] left-8 h-72 w-52"
          style={{ transform: 'scale(1.08)', transformOrigin: '50% 100%' }}
        >
          <img
            ref={playerRef}
            src={BATTLE_ASSETS.player.battleBody}
            alt="Player"
            className="absolute inset-0 h-full w-full object-contain object-bottom"
          />
        </div>

        <div
          ref={armContainerRef}
          className="absolute bottom-[52px] left-8 h-72 w-52 pointer-events-none"
          style={{ zIndex: 9, transform: 'scale(1.08)', transformOrigin: '50% 100%' }}
        >
          <img
            ref={playerArmRef}
            src={BATTLE_ASSETS.player.battleArm}
            alt="Player arm"
            className="absolute inset-0 h-full w-full object-contain object-bottom"
          />
        </div>

        <div
          ref={truthWaveRef}
          className="pointer-events-none absolute bottom-[200px] left-40 h-24 w-24 opacity-0"
          style={{
            borderRadius: '50%',
            border: '6px solid rgba(255,210,90,0.9)',
            clipPath: 'polygon(50% 50%, 100% 12%, 100% 88%)',
            boxShadow: '0 0 30px 6px rgba(255,210,90,0.7)',
            filter: 'blur(3px)',
          }}
        />

        <div
          className="pointer-events-none absolute h-4 rounded-full"
          style={{
            bottom: '120px',
            left: '554px',
            width: '144px',
            background: 'radial-gradient(ellipse, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.22) 55%, rgba(0,0,0,0) 75%)',
          }}
        />

        <div
          ref={songbeastGroupRef}
          className="absolute bottom-[120px] right-[110px] h-44 w-80"
          style={{ transform: 'scale(1.08)', transformOrigin: '50% 100%' }}
        >
          <div
            ref={glowRef}
            className="pointer-events-none absolute opacity-0"
            style={{
              top: '-30%',
              bottom: '-30%',
              left: '-15%',
              right: '-15%',
              zIndex: 1,
              background:
                'radial-gradient(ellipse at center, rgba(255,214,110,0.55) 0%, rgba(255,214,110,0.2) 40%, rgba(255,214,110,0) 62%)',
              filter: 'blur(16px)',
            }}
          />

          <div
            ref={restoreFlashRef}
            className="pointer-events-none absolute opacity-0"
            style={{
              top: '25%',
              bottom: '25%',
              left: '25%',
              right: '25%',
              zIndex: 1,
              background:
                'radial-gradient(ellipse at center, rgba(168,85,247,0.85) 0%, rgba(168,85,247,0.35) 45%, rgba(168,85,247,0) 72%)',
              filter: 'blur(6px)',
            }}
          />

          <img
            ref={legsRef}
            src={startRestored ? BATTLE_ASSETS.songbeast.restored.legs : BATTLE_ASSETS.songbeast.base.legsTail}
            alt="Songbeast legs and tail"
            className="absolute inset-0 h-full w-full object-contain object-bottom"
            style={{ zIndex: 2 }}
          />

          <div ref={torsoGroupRef} className="absolute inset-0" style={{ zIndex: 3, transformOrigin: '50% 100%' }}>
            <img
              ref={songbeastBodyImgRef}
              src={startRestored ? BATTLE_ASSETS.songbeast.restored.body : BATTLE_ASSETS.songbeast.base.body}
              alt="Songbeast torso"
              className="absolute inset-0 h-full w-full object-contain object-bottom translate-y-[1px]"
            />
          </div>

          <div ref={floorBehindRef} className="pointer-events-none absolute inset-0" style={{ zIndex: 4 }} />

          <div ref={headContainerRef} className="absolute inset-0" style={{ zIndex: 5, transformOrigin: '50% 100%' }}>
            <img
              ref={glassesAddRef}
              src={BATTLE_ASSETS.songbeast.gear.glasses.add}
              alt="Songbeast glasses (back)"
              className="pointer-events-none absolute inset-0 h-full w-full object-contain object-bottom translate-y-[1px]"
              style={{ zIndex: 1, transformOrigin: '50% 60%' }}
            />
            <img
              ref={headphonesAddRef}
              src={BATTLE_ASSETS.songbeast.gear.headphones.add}
              alt="Songbeast headphones (back)"
              className="pointer-events-none absolute inset-0 h-full w-full object-contain object-bottom translate-y-[1px]"
              style={{ zIndex: 2, transformOrigin: '50% 60%' }}
            />

            <img
              ref={songbeastHeadImgRef}
              src={startRestored ? BATTLE_ASSETS.songbeast.restored.head : BATTLE_ASSETS.songbeast.base.head}
              alt="Songbeast head"
              className="absolute inset-0 h-full w-full object-contain object-bottom translate-y-[1px]"
              style={{ zIndex: 3 }}
            />

            <img
              ref={muzzleRef}
              src={BATTLE_ASSETS.songbeast.base.muzzle}
              alt="Songbeast muzzle"
              className="pointer-events-none absolute inset-0 h-full w-full object-contain object-bottom translate-y-[1px]"
              style={{ zIndex: 4, transformOrigin: '50% 60%' }}
            />
            <img
              ref={glassesMainRef}
              src={BATTLE_ASSETS.songbeast.gear.glasses.main}
              alt="Songbeast glasses"
              className="pointer-events-none absolute inset-0 h-full w-full object-contain object-bottom translate-y-[1px]"
              style={{ zIndex: 5, transformOrigin: '50% 60%' }}
            />
            <img
              ref={headphonesMainRef}
              src={BATTLE_ASSETS.songbeast.gear.headphones.main}
              alt="Songbeast headphones"
              className="pointer-events-none absolute inset-0 h-full w-full object-contain object-bottom translate-y-[1px]"
              style={{ zIndex: 6, transformOrigin: '50% 60%' }}
            />
          </div>

          <div ref={floorFrontRef} className="pointer-events-none absolute inset-0" style={{ zIndex: 6 }} />
        </div>

        {/* Anchored to SONGBEAST_BOX above - the same box/parent frame the
            Songbeast group itself uses - rather than the scene's own
            container, so both stay correctly placed relative to the
            Songbeast regardless of container size or the group's position.
            Hidden while the parchment covers the scene (restoreBarVisible),
            so it never floats over that content. */}
        {restoreBarVisible && (
          <div
            className="pointer-events-none absolute"
            style={{
              bottom: RESTORE_BAR_POSITION.bottom,
              right: RESTORE_BAR_POSITION.right,
              width: RESTORE_BAR_POSITION.width,
            }}
          >
            <RestoreBar percent={restorePercent} />
          </div>
        )}

        <ThoughtBubble
          text={thoughtBubbleText}
          visible={thoughtBubbleVisible}
          beat={thoughtBubbleBeat}
          position={THOUGHT_BUBBLE_POSITION}
        />

        <div
          className="pointer-events-none absolute h-4 rounded-full"
          style={{
            bottom: '48px',
            left: '735px',
            width: '114px',
            background: 'radial-gradient(ellipse, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.22) 55%, rgba(0,0,0,0) 75%)',
          }}
        />

        <div
          ref={silencerGroupRef}
          className="absolute bottom-[48px] h-72 w-52 opacity-90"
          style={{ right: '0px', zIndex: 0, transformOrigin: '50% 100%', transform: 'scale(1.08)' }}
        >
          <img
            src={BATTLE_ASSETS.silencer.body}
            alt="Silencer body"
            className="absolute inset-0 h-full w-full object-contain object-bottom"
          />

          <div className="pointer-events-none absolute inset-0" style={{ zIndex: 1 }}>
            <img
              ref={silencerArmRef}
              src={BATTLE_ASSETS.silencer.arm}
              alt="Silencer arm"
              className="absolute inset-0 h-full w-full object-contain object-bottom"
              style={{ transformOrigin: '60% 40%' }}
            />
          </div>
        </div>

        <div
          ref={silencerWaveRef}
          className="pointer-events-none absolute h-24 w-24 opacity-0"
          style={{
            bottom: '196px',
            right: '56px',
            zIndex: 999,
            background:
              'radial-gradient(circle, rgba(168,85,247,0.4) 0%, rgba(168,85,247,0.4) 40%, rgba(126,34,206,0.34) 60%, rgba(88,28,135,0) 78%)',
            clipPath:
              'polygon(50% 50%, 0% 12%, 14% 20%, 0% 28%, 14% 36%, 0% 44%, 14% 50%, 0% 56%, 14% 64%, 0% 72%, 14% 80%, 0% 88%)',
            boxShadow: '0 0 32px 10px rgba(168,85,247,0.32)',
          }}
        />
      </div>
    </div>
  );
}
