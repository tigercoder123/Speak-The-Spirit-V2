'use client';

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { BATTLE_ASSETS } from '../../config/battleAssets';
import {
  BATTLE_SCENE_ASPECT_RATIO,
  BATTLE_SCENE_MAX_WIDTH,
  BATTLE_SCENE_SCALE,
} from '../../config/battleApproach';
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
type GearKey = 'headphones' | 'glasses' | 'muzzle' | 'handcuffs' | 'legcuffs';

// Fixed 5-slot order, matching config/silencerBattleRounds.ts's
// getGearPieceOrder(true, true) - used by diffGearStatus below to scan for
// changes on every key, including handcuffs/legcuffs (a harmless no-op scan
// for a battle that doesn't track one or both of them, since their status
// never changes from 'on' in that case - see toGearStatusRecord's own
// `order` param for the part that actually varies per battle).
const GEAR_ORDER: GearKey[] = ['headphones', 'glasses', 'muzzle', 'handcuffs', 'legcuffs'];

function toGearState(piece: GearPieceState): GearState {
  if (piece === 'REMOVED') return 'off';
  if (piece === 'HALF_ON') return 'half';
  return 'on';
}

// `order` is THIS battle's actual gear order (3, 4, or 5 items, matching
// `pieces`' own length - see config/silencerBattleRounds.ts's
// getGearPieceOrder) - handcuffs/legcuffs default to 'on' and simply never
// change when they're not part of `order`, since nothing in `pieces` maps
// to them.
function toGearStatusRecord(pieces: GearPieceState[], order: GearKey[]): Record<GearKey, GearState> {
  const status: Record<GearKey, GearState> = {
    headphones: 'on',
    glasses: 'on',
    muzzle: 'on',
    handcuffs: 'on',
    legcuffs: 'on',
  };
  order.forEach((key, i) => {
    status[key] = toGearState(pieces[i]);
  });
  return status;
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
  // Unlike every other piece, handcuffs' half-on pose is asymmetric - Arm_Back
  // (main) stays exactly at its default placement, only Arm_Front (add) goes
  // askew (see HANDCUFFS_ASKEW_ADD below and its use in buildPlayerTurnTweens's
  // gear-cascade loop). This entry is the "main" half - identity, i.e. no
  // movement - kept here only so ASKEW_POSE stays a complete Record<GearKey, ...>.
  handcuffs: { rotation: 0, x: 0, y: 0 },
  // Same asymmetry as handcuffs, mirrored to the back leg - Leg_Back (main)
  // stays fixed, only Leg_Front (add) goes askew (see LEGCUFFS_ASKEW_ADD
  // below). Identity entry kept for the same Record-completeness reason.
  legcuffs: { rotation: 0, x: 0, y: 0 },
};

// Arm_Front's (the "add" layer's) own half-on offset - the single source of
// truth for that pose, read directly by buildPlayerTurnTweens's cascade
// tween, the handcuffs resting-pose safety net, AND the Speak Lies restore
// path (buildSetbackTweens), so all three always land on the exact same
// askew pose instead of drifting from each other. Change the numbers here
// and every consumer follows.
const HANDCUFFS_ASKEW_ADD = { rotation: -60, x: -5, y: -80};

// Leg_Front's own half-on offset - same role as HANDCUFFS_ASKEW_ADD above,
// just for legcuffs' add layer. Starts from the same numbers as handcuffs;
// tune against the actual leg art if the swing needs adjusting.
const LEGCUFFS_ASKEW_ADD = { rotation: -60, x: -10, y: 20 };

// Where each item lands on the floor (relative to floorBehindRef's/floorFrontRef's
// own inset-0 box, which is the same size/position as the head's box, just
// static/untransformed).
const FLOOR_POSE: Record<GearKey, { x: number; y: number; rotation: number; scale: number }> = {
  headphones: { x: -75, y: 85, rotation: -30, scale: 0.9 },
  glasses: { x: -80, y: 100, rotation: 15, scale: 0.8 },
  muzzle: { x: -35, y: 90, rotation: -12, scale: 0.9 },
  handcuffs: { x: -50, y: 30, rotation: -2, scale: 0.9 },
  legcuffs: { x: -50, y: 30, rotation: -2, scale: 0.9 },
};

// The Songbeast group's true resting scale - matches the transform: scale()
// on songbeastGroupRef's own JSX below. Every GSAP tween that squashes/
// stretches/settles that group (the removal jump's crouch/launch/impact/
// settle, the restore flourish's recoil) must target values relative to
// THIS, not to a literal 1 - the first tween GSAP ever runs on that element
// parses its current transform (scale(SONGBEAST_BASE_SCALE)) and takes over
// the property completely from then on, so a literal "return to scaleY: 1"
// doesn't return to rest, it shrinks scaleY down to bare identity while
// scaleX (whichever tween doesn't happen to also touch it) stays at
// SONGBEAST_BASE_SCALE - a permanent, visible mismatch between the two axes.
// The JSX below reads this same constant, so it's the only place the base
// size needs to change.
const SONGBEAST_BASE_SCALE = 1.08;

// How much bigger the Songbeast's own group box grows once restored (final
// golden-flash climax, or mounting straight into the restored pose via the
// startRestored dev cheat) - a ratio on top of the group's own base size
// (itself already BATTLE_SCENE_SCALE'd), so this doesn't need scaling by
// that same factor - it's already scale-invariant.
const RESTORED_SONGBEAST_SCALE = 1.2;

// Speak Lies hover pose - where gear levitates to (in front of the face) while
// held up for the 1s beat, before the Songbeast slumps into it.
const HOVER_POSE: Record<GearKey, { x: number; y: number; rotation: number; scale: number }> = {
  headphones: { x: -15, y: 15, rotation: 0, scale: 1.08 },
  glasses: { x: -5, y: 7, rotation: 0, scale: 1.06 },
  muzzle: { x: -25, y: 25, rotation: 0, scale: 1.05 },
  handcuffs: { x: -20, y: -5, rotation: 0, scale: 1.06 },
  legcuffs: { x: -20, y: -10, rotation: 0, scale: 1.06 },
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
  handcuffs: glowFilter([8, 18, 32], [1, 0.9, 0.7]),
  legcuffs: glowFilter([8, 18, 32], [1, 0.9, 0.7]),
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
const SONGBEAST_BOX = {
  bottom: 120 * BATTLE_SCENE_SCALE,
  right: 110 * BATTLE_SCENE_SCALE,
  width: 320 * BATTLE_SCENE_SCALE,
  height: 176 * BATTLE_SCENE_SCALE,
};

// Where the Songbeast's forehead actually renders, in the same bottom/right
// frame as SONGBEAST_BOX above. The head artwork has transparent margin
// baked into its source PNG rather than filling the box edge-to-edge (and
// the box's own 1.08 scale grows it upward from its bottom edge), so this
// is calibrated directly against the rendered art instead of derived by
// formula from the box's edges - it's still relative to the same parent,
// so it stays correct if SONGBEAST_BOX's position changes, just not if the
// art itself is swapped for a differently-proportioned image.
const FOREHEAD = { bottom: 260 * BATTLE_SCENE_SCALE, right: 326 * BATTLE_SCENE_SCALE };

// Shortened (rather than spanning the Songbeast's full width) and centered
// above the forehead. Held well clear of the thought bubble below it - the
// bubble's cloud rises roughly 110px (pre-scale) above FOREHEAD.bottom, so
// this sits above that with a clean gap rather than overlapping it.
const RESTORE_BAR_WIDTH = 160 * BATTLE_SCENE_SCALE;
const RESTORE_BAR_POSITION = {
  bottom: FOREHEAD.bottom + 120 * BATTLE_SCENE_SCALE - 18 * BATTLE_SCENE_SCALE,
  right: FOREHEAD.right - RESTORE_BAR_WIDTH / 2,
  width: RESTORE_BAR_WIDTH,
};

// Anchored right at the forehead so its trailing dots read as coming from
// it, nudged slightly to one side rather than dead-centered. Nudged up an
// extra 7px on top of that.
const THOUGHT_BUBBLE_POSITION = {
  bottom: FOREHEAD.bottom - 2 * BATTLE_SCENE_SCALE + 7,
  right: FOREHEAD.right - 45 * BATTLE_SCENE_SCALE,
};

interface SongbeastBattleAvatarProps {
  /** This battle's randomly-picked battle background (see
   * hooks/useSilencerBattle.ts's battleTheme / BATTLE_ASSETS.backgrounds.themes) -
   * the SAME theme BattleExplorationView is using this battle. */
  backgroundSrc: string;
  /** Current authoritative gear state from the hook - [headphones, glasses,
   * muzzle], plus handcuffs and legcuffs appended when includesHandcuffs/
   * includesLegcuffs are true. */
  gearPieces: GearPieceState[];
  /** Whether this battle's verse qualified for the 4th gear piece
   * (handcuffs) - see config/silencerBattleRounds.ts's
   * HANDCUFFS_WORD_THRESHOLD. Gates whether the handcuffs art/refs render
   * at all. */
  includesHandcuffs: boolean;
  /** Whether this battle's verse qualified for the 5th gear piece
   * (legcuffs) - see config/silencerBattleRounds.ts's
   * LEGCUFFS_WORD_THRESHOLD. Gates whether the legcuffs art/refs render at
   * all. Implies includesHandcuffs (nested thresholds), but is checked
   * independently everywhere rather than assumed. */
  includesLegcuffs: boolean;
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
  /** Hush Silencer power-up - when true, the upcoming correct turn's re-
   * silence beat (arm swing, dark wave, taunt line) never plays at all;
   * playerTurn calls onReSilenceBlocked instead of setback() once the gear-
   * removal cascade finishes. */
  skipReSilence: boolean;
  /** Fires instead of the setback()/onReSilenceEffectStart chain when
   * skipReSilence blocked this turn's re-silence - see useSilencerBattle.ts's
   * handleReSilenceBlocked. */
  onReSilenceBlocked: () => void;
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
  backgroundSrc,
  gearPieces,
  includesHandcuffs,
  includesLegcuffs,
  silencerTurnRequestId,
  onSilencerTurnComplete,
  battleTurnRequestId,
  onGearRemoved,
  onGearLanded,
  onReSilenceEffectStart,
  onFinalRestorationComplete,
  isFinalTurn,
  skipReSilence,
  onReSilenceBlocked,
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
  const skipReSilenceRef = useRef(skipReSilence);
  const gearPiecesRef = useRef(gearPieces);
  // This battle's actual gear order (3 items, 4 with handcuffs appended, or
  // 5 with legcuffs appended after that) - matches gearPieces' own
  // length/order, see toGearStatusRecord. includesLegcuffs implies
  // includesHandcuffs (nested thresholds - see config/silencerBattleRounds.ts's
  // getGearPieceOrder), so slicing to 5 vs 4 is equivalent to checking
  // includesLegcuffs alone, but both are checked for clarity.
  const activeGearOrder: GearKey[] = includesLegcuffs
    ? GEAR_ORDER
    : includesHandcuffs
      ? GEAR_ORDER.slice(0, 4)
      : GEAR_ORDER.slice(0, 3);
  const activeGearOrderRef = useRef(activeGearOrder);

  // The last-committed (currently at-rest) gear status - only updated at the
  // specific moments a cascade/restore tween actually lands, so the resting-
  // pose effect below never snaps gear to its final pose before the
  // animation gets there.
  const [gearStatus, setGearStatus] = useState<Record<GearKey, GearState>>(() => toGearStatusRecord(gearPieces, activeGearOrder));
  const gearStatusRef = useRef(gearStatus);

  // Mirrored into refs (via a LAYOUT effect, not during render, and not a
  // plain effect) so contextSafe-wrapped functions - which can fire from
  // GSAP timeline callbacks scheduled several renders earlier - always read
  // the truly-current value. Must be a layout effect specifically: the
  // battleTurnRequestId/silencerTurnRequestId trigger effects further down
  // are useGSAP-based (also layout effects), and when a parent bumps
  // gearPieces and battleTurnRequestId in the same commit, React runs ALL
  // layout effects (in declaration order) before any passive effects - a
  // plain useEffect here would still be holding the PREVIOUS render's
  // gearPieces by the time that trigger's playerTurn() reads
  // gearPiecesRef.current, computing a no-op diff against gearStatusRef and
  // silently skipping the cascade entirely.
  useLayoutEffect(() => {
    isFinalTurnRef.current = isFinalTurn;
    skipReSilenceRef.current = skipReSilence;
    gearPiecesRef.current = gearPieces;
    gearStatusRef.current = gearStatus;
    activeGearOrderRef.current = activeGearOrder;
  }, [isFinalTurn, skipReSilence, gearPieces, gearStatus, activeGearOrder]);

  // Player
  const playerRef = useRef<HTMLImageElement>(null);
  const playerArmRef = useRef<HTMLImageElement>(null);
  const armContainerRef = useRef(null);

  // Songbeast - layered anatomy.
  // torsoGroupRef (torso + wing) and the 4 lower-body layers below breathe
  // together (see startIdle's breathingTargets); lower-mane stays planted.
  // Lower body used to be one flat legsRef image - now 4 independently
  // stacked full-canvas parts (see BATTLE_ASSETS.songbeast.base) plus a 5th,
  // normally-hidden restoredLegsRef that swaps in for all 4 at once at the
  // final-restoration flash (there's only one combined restored asset).
  const tailRef = useRef<HTMLImageElement>(null);
  const backLegsRef = useRef<HTMLImageElement>(null);
  const bellyRef = useRef<HTMLImageElement>(null);
  const frontLegsRef = useRef<HTMLImageElement>(null);
  const restoredLegsRef = useRef<HTMLImageElement>(null);
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

  // Handcuffs - unlike the head-mounted gear above, these are anchored near
  // the front leg (see their JSX, sandwiching frontLegsRef) and are NEVER
  // reparented into headContainerRef/floorFrontRef/floorBehindRef the way
  // applyGearRestingPose does for the other 3 - that would drag them along
  // with head-tilt tweens, which reads wrong for a wrist/leg-mounted item.
  // Their own resting-pose effect (see the useGSAP below applyGearRestingPose)
  // sets their transform directly instead. Only rendered/populated when
  // `includesHandcuffs` is true - null the rest of the time, same as every
  // other ref this component filters defensively.
  const handcuffsMainRef = useRef<HTMLImageElement>(null);
  const handcuffsAddRef = useRef<HTMLImageElement>(null);

  // Legcuffs - same anchoring rules as handcuffs above (never reparented,
  // own resting-pose safety net), just around the back leg (see their JSX,
  // sandwiching backLegsRef) instead of the front. Only rendered/populated
  // when `includesLegcuffs` is true.
  const legcuffsMainRef = useRef<HTMLImageElement>(null);
  const legcuffsAddRef = useRef<HTMLImageElement>(null);

  // Lookup used by the Speak Truth cascade to find each category's DOM refs.
  const gearRefs: Record<
    GearKey,
    { main: RefObject<HTMLImageElement | null>; add: RefObject<HTMLImageElement | null> | null }
  > = {
    headphones: { main: headphonesMainRef, add: headphonesAddRef },
    glasses: { main: glassesMainRef, add: glassesAddRef },
    muzzle: { main: muzzleRef, add: null },
    handcuffs: { main: handcuffsMainRef, add: handcuffsAddRef },
    legcuffs: { main: legcuffsMainRef, add: legcuffsAddRef },
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

  // Handcuffs'/legcuffs' own resting-pose safety net - deliberately NOT
  // applyGearRestingPose (see handcuffsMainRef's own comment for why: no
  // reparenting, and the half-on pose is asymmetric between main/add rather
  // than one shared pose). Mirrors that function's job otherwise: snap to
  // the correct resting values whenever gearStatus.handcuffs/legcuffs
  // changes, as a safety net behind whatever tween already animated into
  // these same values. Shared helper since both pieces need the identical
  // logic, just against different refs/askew-add constants.
  const applyCuffRestingPose = (
    mainEl: HTMLImageElement | null,
    addEl: HTMLImageElement | null,
    state: GearState,
    key: 'handcuffs' | 'legcuffs',
    askewAdd: { rotation: number; x: number; y: number }
  ) => {
    if (!mainEl || !addEl) return;
    if (state === 'off') {
      const f = FLOOR_POSE[key];
      gsap.set([mainEl, addEl], { rotation: f.rotation, x: f.x, y: f.y, scale: f.scale });
    } else if (state === 'half') {
      gsap.set(mainEl, { rotation: 0, x: 0, y: 0, scale: 1 });
      gsap.set(addEl, { rotation: askewAdd.rotation, x: askewAdd.x, y: askewAdd.y, scale: 1 });
    } else {
      gsap.set([mainEl, addEl], { rotation: 0, x: 0, y: 0, scale: 1 });
    }
  };

  useGSAP(() => {
    applyCuffRestingPose(handcuffsMainRef.current, handcuffsAddRef.current, gearStatus.handcuffs, 'handcuffs', HANDCUFFS_ASKEW_ADD);
    applyCuffRestingPose(legcuffsMainRef.current, legcuffsAddRef.current, gearStatus.legcuffs, 'legcuffs', LEGCUFFS_ASKEW_ADD);
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

    // Legs/tail/belly breathe along with the torso - same two tweens, but
    // staggered (belly closest behind the torso, tail last) instead of
    // hitting every keyframe in perfect unison, which read as one stiff
    // rigid block rather than a body with follow-through. Handcuffs are
    // deliberately EXCLUDED here (unlike every other gear piece) - this
    // tween's scaleY step sets transformOrigin: '50% 100%' every cycle,
    // which fights handcuffsAddRef's own pivot (HANDCUFFS_ASKEW_ADD.
    // transformOrigin, '100% 0%', needed for its askew rotation to read
    // correctly) - the same rotation/position rendered around two different
    // pivots every ~1.4s looks like the cuff snapping between two spots.
    const breathingTargets = [
      torsoGroupRef.current,
      bellyRef.current,
      backLegsRef.current,
      frontLegsRef.current,
      tailRef.current,
    ].filter((el): el is HTMLImageElement | HTMLDivElement => el !== null);

    // Every idle tween below is a plain gsap.to() with no explicit `from` -
    // GSAP lazily captures its starting value from whatever the target's
    // CSS actually is the moment the tween first renders. startIdle() now
    // runs not just at mount but every time a cascade/restore finishes (see
    // playerTurn/setback's onComplete), and a just-killed tween can leave a
    // target sitting AT (or very near) that same property's own target value
    // - e.g. paused mid-breath right at scaleY 1.025. A new tween built on
    // top of that captures from=to, so it has zero amplitude to yoyo across
    // and just sits frozen at that value forever instead of breathing. This
    // set() forces every target back to its true rest pose first, so each
    // new tween always has its full swing to animate through regardless of
    // where the previous one happened to get killed.
    gsap.set(breathingTargets, { scaleX: 1, scaleY: 1 });
    gsap.set(headContainerRef.current, { rotation: 0, y: 0 });
    gsap.set([playerRef.current, playerArmRef.current], { scaleY: 1 });
    gsap.set(playerArmRef.current, { rotation: 0 });
    gsap.set(silencerGroupRef.current, { y: 0, scaleX: 1, scaleY: 1 });

    idleTweens.current.push(
      gsap.to(breathingTargets, {
        scaleY: 1.025,
        duration: 1.4,
        ease: 'power1.inOut',
        yoyo: true,
        repeat: -1,
        stagger: 0.09,
        transformOrigin: '50% 100%',
      })
    );
    idleTweens.current.push(
      gsap.to(breathingTargets, {
        scaleX: 0.99,
        duration: 0.73,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
        stagger: 0.06,
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
      gsap.set(songbeastGroupRef.current, { scale: RESTORED_SONGBEAST_SCALE });
      // Counter-scale the floor containers any already-removed gear is
      // sitting in, so it doesn't visually grow along with the Songbeast -
      // it's the Silencer's old gear on the ground, not part of the
      // Songbeast's own body. floorFrontRef/floorBehindRef have no scale of
      // their own to preserve, but handcuffsMainRef/AddRef DO (their own
      // FLOOR_POSE/ASKEW_POSE resting scale, since they never reparent into
      // these containers - see their own resting-pose effect) - a `*=`
      // relative multiply cancels out just the parent's scale-up on top of
      // whatever they're already at, instead of overwriting it outright.
      // See the matching tween in buildFinalRestorationTweens for the
      // animated (non-cheat) path.
      gsap.set([floorFrontRef.current, floorBehindRef.current], { scale: 1 / RESTORED_SONGBEAST_SCALE });
      // Null-filtered - handcuffsMainRef/AddRef/legcuffsMainRef/AddRef stay
      // null (never rendered) when includesHandcuffs/includesLegcuffs is
      // false, and GSAP throws (rather than no-oping) if handed a target
      // array containing null.
      const startRestoredCuffRefs = [
        handcuffsMainRef.current,
        handcuffsAddRef.current,
        legcuffsMainRef.current,
        legcuffsAddRef.current,
      ].filter((el): el is HTMLImageElement => el !== null);
      if (startRestoredCuffRefs.length > 0) {
        gsap.set(startRestoredCuffRefs, { scale: `*=${1 / RESTORED_SONGBEAST_SCALE}` });
      }
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

    // Gate for the dip-and-whip below - true when this turn's gear cascade
    // will run the handcuffs/legcuffs full-removal flourish (see the
    // matching `change.key === 'handcuffs' || change.key === 'legcuffs'`
    // check further down), which drives its own jump across roughly the
    // same window the whip occupies. Skipping the whip entirely on that
    // turn avoids two tweens fighting over the same elements' rotation - the
    // cascade's own jump plays instead, uninterrupted.
    const handcuffsRemoving = gearChanges.some((c) => c.key === 'handcuffs' && c.to !== 'half');
    const legcuffsRemoving = gearChanges.some((c) => c.key === 'legcuffs' && c.to !== 'half');

    // True whenever handcuffs/legcuffs are the piece changing THIS turn - to
    // 'half' or fully 'off' alike. Gates each out of the whip below on its
    // own turn (see torsoAndLowerBody's own comment) - unlike
    // handcuffsRemoving/legcuffsRemoving above, this covers the 'half' case too.
    const handcuffsChangingThisTurn = gearChanges.some((c) => c.key === 'handcuffs');
    const legcuffsChangingThisTurn = gearChanges.some((c) => c.key === 'legcuffs');

    // The dip-and-whip's torso rotation, shared with the lower-body layers
    // (plus handcuffs/legcuffs, when this battle has them AND they're not
    // the piece changing this turn - see handcuffsChangingThisTurn/
    // legcuffsChangingThisTurn above) so they whip along with it instead of
    // staying rigid underneath, on turns where some OTHER piece is coming
    // loose. When handcuffs/legcuffs themselves are changing, they're
    // excluded here entirely - they already get their own dedicated tween
    // into their own ASKEW_ADD/FLOOR_POSE further down, and having BOTH that
    // tween and this whip's rotation animate them at once made the cuff
    // visibly detour through the whip's arc before arriving, instead of
    // moving straight to its target. A small stagger (torso leads, tail lags
    // furthest behind) gives the whip follow-through instead of every layer
    // snapping in perfect unison. Nulls filtered defensively - the cuff refs
    // stay null when includesHandcuffs/includesLegcuffs is false.
    const torsoAndLowerBody = [
      torsoGroupRef.current,
      bellyRef.current,
      backLegsRef.current,
      frontLegsRef.current,
      tailRef.current,
      ...(handcuffsChangingThisTurn ? [] : [handcuffsMainRef.current, handcuffsAddRef.current]),
      ...(legcuffsChangingThisTurn ? [] : [legcuffsMainRef.current, legcuffsAddRef.current]),
    ].filter((el): el is HTMLImageElement | HTMLDivElement => el !== null);

    // Whole-body jump groupings for the handcuffs/legcuffs full-removal
    // flourish below - legs push off/absorb the landing, torso/belly ride
    // along with songbeastGroupRef's own y/scale. Shared regardless of which
    // of the two pieces triggers the jump, since it's a generic whole-body
    // flourish, not specific to either piece's own anchor point. Nulls
    // filtered defensively, though legs/torso are always present so this
    // filter is a type-narrowing no-op for them.
    const jumpLegs = [frontLegsRef.current, backLegsRef.current].filter(
      (el): el is HTMLImageElement => el !== null
    );
    const jumpTorso = [torsoGroupRef.current, bellyRef.current].filter(
      (el): el is HTMLDivElement | HTMLImageElement => el !== null
    );


    if (!handcuffsRemoving && !legcuffsRemoving) {
      tl.to(headContainerRef.current, { rotation: 8, duration: 0.32, ease: 'power2.in', transformOrigin: headPivot }, 'phase2+=2.25');
      tl.to(torsoAndLowerBody, { rotation: 2, duration: 0.32, ease: 'power2.in', stagger: 0.025, transformOrigin: torsoPivot }, 'phase2+=2.29');

      tl.to(headContainerRef.current, { rotation: -7, duration: 0.14, ease: 'power3.out' }, 'phase2+=2.57');
      tl.to(torsoAndLowerBody, { rotation: -1.5, duration: 0.14, ease: 'power3.out', stagger: 0.02 }, 'phase2+=2.61');

      tl.to(headContainerRef.current, { rotation: 0, duration: 0.45, ease: 'elastic.out(1, 0.55)' }, 'phase2+=2.71');
      tl.to(torsoAndLowerBody, { rotation: 0, duration: 0.45, ease: 'elastic.out(1, 0.55)', stagger: 0.03 }, 'phase2+=2.75');
    }

    // Speak Truth's gear cascade - whatever the hook says changed comes loose right on the whip itself.
    for (const change of gearChanges) {
      const { main, add } = gearRefs[change.key];
      const targets = [main.current, add?.current ?? null].filter((el): el is HTMLImageElement => el !== null);
      if (targets.length === 0) continue;

      if (change.to === 'half') {
        if (change.key === 'handcuffs' || change.key === 'legcuffs') {
          // Asymmetric, unlike every other piece - main (Arm_Back/Leg_Back,
          // carrying the chain) stays exactly where it is; only add
          // (Arm_Front/Leg_Front) goes askew, so the cuff visibly hangs
          // loose off the leg while the chain still reads as attached. See
          // ASKEW_POSE.handcuffs/legcuffs's own comment.
          const askewAdd = change.key === 'handcuffs' ? HANDCUFFS_ASKEW_ADD : LEGCUFFS_ASKEW_ADD;
          if (add?.current) {
            tl.to(
              add.current,
              {
                rotation: askewAdd.rotation,
                x: askewAdd.x,
                y: askewAdd.y,
                duration: 0.6,
                ease: 'power2.out',
              },
              'phase2+=3.7'
            );
          }
        } else {
          const p = ASKEW_POSE[change.key];
          tl.to(targets, { rotation: -10, x: 7, y: -2, duration: 0.6, ease: 'power2.out', transformOrigin: '10%, 100%' }, 'phase2+=3.7');
        }
      } else {
        const f = FLOOR_POSE[change.key];
        if (change.key === 'handcuffs' || change.key === 'legcuffs') {
          // Rotation is included here (unlike the shared FLOOR_POSE tween
          // below) since nothing else touches the cuffs' rotation during
          // this flourish - the jump below moves songbeastGroupRef/legs/
          // torso/head/tail, never the cuffs themselves - so there's no
          // fight over ownership of the property the way there used to be
          // with the old rear-up. Timed to 'phase2+=3.0', the jump's
          // landing-impact beat (see below), so the cuffs visibly come loose
          // exactly as the feet touch down.
          tl.to(targets, { x: f.x, y: f.y, rotation: f.rotation, scale: f.scale, duration: 0.6, ease: 'power2.out' }, 'phase2+=3.52');
        } else {
          tl.to(targets, { x: f.x, y: f.y, rotation: f.rotation, scale: f.scale, duration: 0.6, ease: 'power2.out' }, 'phase2+=2.61');
        }

        // Handcuffs'/legcuffs' own removal flourish - a whole-body jump
        // instead of the generic dip-and-whip (skipped entirely via the
        // handcuffsRemoving/legcuffsRemoving gate above). songbeastGroupRef
        // carries the actual up/down travel; legs/torso/head/tail each get
        // their own tween a beat offset from it (not one shared stagger
        // call) so the jump reads as overlapping secondary motion rather
        // than one rigid transform - legs lead (push off, then absorb the
        // landing a beat after the body), torso/belly follow the body
        // closely, head lags slightly (inertia), tail lags furthest
        // (follow-through). Identical for both pieces since it's a
        // whole-body flourish, not anchored to either piece's own leg.
        if (change.key === 'handcuffs' || change.key === 'legcuffs') {
          // Anticipation crouch (0.4s -> 0.5s). scaleY/scaleX on
          // songbeastGroupRef are relative to SONGBEAST_BASE_SCALE, not
          // literal - see that constant's own comment for why.
          tl.to(songbeastGroupRef.current, { y: 10, scaleY: SONGBEAST_BASE_SCALE * 0.9, scaleX: SONGBEAST_BASE_SCALE * 1.05, duration: 0.5, ease: 'power2.in', transformOrigin: '50% 100%' }, 'phase2+=2.15');
          tl.to(jumpLegs, { rotation: -2, scaleY: 0.9, duration: 0.5, ease: 'power2.in', stagger: 0.02, transformOrigin: '50% 0%' }, 'phase2+=2.15');

          // Launch - starts 0.1s later (2.65) to follow the now-longer crouch.
          // ease is power3.in (slow start, fastest right at the end) instead
          // of power3.out, so the push-off builds rather than bursts.
          tl.to(songbeastGroupRef.current, { y: -15, scaleY: SONGBEAST_BASE_SCALE, scaleX: SONGBEAST_BASE_SCALE * 0.95, duration: 0.48, ease: 'power2.out' }, 'phase2+=2.65');
          tl.to(jumpLegs, { rotation: 2, scaleY: 1, y: -1, duration: 0.45, ease: 'power2.out', stagger: 0.02 }, 'phase2+=2.67');
          tl.to(jumpTorso, { rotation: -1.5, duration: 0.45, ease: 'power2.out', stagger: 0.02, transformOrigin: torsoPivot }, 'phase2+=2.69');
          tl.to(headContainerRef.current, { y: -3, rotation: -3, duration: 0.45, ease: 'power2.out', transformOrigin: headPivot }, 'phase2+=2.71');
          tl.to(tailRef.current, { rotation: 7, duration: 0.47, ease: 'power2.out', transformOrigin: '80% 50%' }, 'phase2+=2.73');

          // Hang
          const hangEnd = 'phase2+=3.17';

          // Descent
          tl.to(songbeastGroupRef.current, { y: 0, scaleY: SONGBEAST_BASE_SCALE, scaleX: SONGBEAST_BASE_SCALE, duration: 0.35, ease: 'power3.in' }, hangEnd);
          tl.to(jumpTorso, { rotation: 0, duration: 0.33, ease: 'power3.in', stagger: 0.02 }, 'phase2+=3.19');
          tl.to(headContainerRef.current, { y: 0, rotation: 0, duration: 0.33, ease: 'power3.in' }, 'phase2+=3.21');
          tl.to(tailRef.current, { rotation: -4, duration: 0.35, ease: 'power3.in' }, 'phase2+=3.23');

          // Landing impact
          tl.to(songbeastGroupRef.current, { y: 5, scaleY: SONGBEAST_BASE_SCALE * 0.9, scaleX: SONGBEAST_BASE_SCALE * 1.1, duration: 0.165, ease: 'power3.out' }, 'phase2+=3.52');
          tl.to(jumpLegs, { scaleY: 1, y: -2, duration: 0.185, ease: 'power3.out', transformOrigin: '50% 100%' }, 'phase2+=3.55');

          // Rebound
          tl.to(songbeastGroupRef.current, { y: -2, scaleY: SONGBEAST_BASE_SCALE * 1.03, scaleX: SONGBEAST_BASE_SCALE * 0.98, duration: 0.23, ease: 'back.out(1.8)' }, 'phase2+=3.685');
          tl.to(jumpLegs, { scaleY: 1.02, y: 1, duration: 0.23, ease: 'back.out(1.8)' }, 'phase2+=3.735');

          // Final settle
          tl.to(songbeastGroupRef.current, { y: 0, scaleY: SONGBEAST_BASE_SCALE, scaleX: SONGBEAST_BASE_SCALE, duration: 0.18, ease: 'power2.out' }, 'phase2+=3.915');
          tl.to(jumpLegs, { scaleY: 1, y: 0, rotation: 0, duration: 0.18, ease: 'power2.out' }, 'phase2+=3.965');
          tl.to(tailRef.current, { rotation: 0, duration: 0.3, ease: 'power2.out' }, 'phase2+=3.755');
        }
      }
    }
    if (gearChanges.length > 0) {
      // 'phase2+=4.2' (handcuffsRemoving/legcuffsRemoving) sits just after
      // every jump/cascade tween above has finished (the last of them, the
      // legs' own settle at +=3.965 running 0.18s, ending +=4.145, and the
      // cuffs' own drop tween at +=3.52 running 0.6s, ending +=4.12) -
      // landing here, instead of mid-flight through those settles, is what
      // makes the resting-pose safety net's gsap.set below a no-op rather
      // than a visible pop.
      const gearLandTime = handcuffsRemoving || legcuffsRemoving ? 'phase2+=4.2' : 'phase2+=3.20';
      tl.add(() => {
        setGearStatus(nextGearStatus);
        onGearLanded();
      }, gearLandTime);
    }

    tl.to(playerArmRef.current, { rotation: 0, duration: 0.5, ease: 'power2.inOut' }, 'phase2+=1.3');
  };

  // eslint-disable-next-line react-hooks/refs
  const playerTurn = contextSafe(() => {
    if (phaseRef.current !== 'idle') return;
    setPhaseBoth('player');

    idleTweens.current.forEach((t) => t.pause());

    const nextGearStatus = toGearStatusRecord(gearPiecesRef.current, activeGearOrderRef.current);
    const gearChanges = diffGearStatus(gearStatusRef.current, nextGearStatus);
    const isFinal = isFinalTurnRef.current;

    const tl = gsap.timeline({
      onComplete: () => {
        onGearRemoved();
        if (isFinal) {
          finalRestoration();
        } else if (skipReSilenceRef.current) {
          // Hush Silencer - the re-silence beat (arm swing, dark wave, taunt
          // line) never plays at all, since handleGearRemoved already left
          // gear untouched for this turn. setback() itself is what normally
          // restarts idleTweens (in its own onComplete) and reports
          // onSilencerTurnComplete, so both need doing here instead.
          // startIdle() (kills + rebuilds), not .resume() - a paused
          // repeat:-1/yoyo tween resumes from its OWN cached mid-cycle
          // progress, not from whatever value the just-finished cascade
          // settled on, so resuming one paused at a mid-breath scaleY
          // visibly snapped the body back to that stale value, undoing the
          // cascade's own clean settle-to-1. Rebuilding fresh instead starts
          // the new tweens from the body's actual current (already-settled)
          // values.
          startIdle();
          setPhaseBoth('idle');
          onReSilenceBlocked();
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

        // On a handcuffs/legcuffs turn, torso/head/belly/tail sit this
        // generic dip out entirely - their own restore flourish further
        // down already drives songbeastGroupRef (their shared PARENT)
        // through an equivalent "body reacts" beat in this same window.
        // Running both at once composed a child sinking down inside a
        // parent stretching taller from the bottom, which read as the whole
        // body shrinking rather than either individual motion.
        const restoreBodyTargets = change.key === 'handcuffs' || change.key === 'legcuffs'
          ? []
          : [torsoGroupRef.current, headContainerRef.current, bellyRef.current, tailRef.current].filter(
              (el): el is HTMLImageElement | HTMLDivElement => el !== null
            );

        tl.to(
          restoreBodyTargets,
          { rotation: -4, y: 10, duration: 0.5, ease: 'sine.inOut', stagger: 0.03, transformOrigin: '50% 100%' },
          'restore+=1.6'
        );

        const targetPose = change.to === 'half' ? ASKEW_POSE[change.key] : { rotation: 0, x: 0, y: 0 };
        tl.set(restoreFlashRef.current, { x: targetPose.x, y: targetPose.y }, 'restore+=1.95');
        tl.to(restoreFlashRef.current, { opacity: 0.85, duration: 0.12, ease: 'power1.out' }, 'restore+=1.95');
        tl.to(restoreFlashRef.current, { opacity: 0, duration: 0.35, ease: 'power1.in' }, 'restore+=2.07');

        if ((change.key === 'handcuffs' || change.key === 'legcuffs') && change.to === 'half') {
          // Same asymmetry as the whip's half-on branch - main (Arm_Back/
          // Leg_Back) snaps to identity, only add (Arm_Front/Leg_Front)
          // lands on the askew pose.
          const askewAdd = change.key === 'handcuffs' ? HANDCUFFS_ASKEW_ADD : LEGCUFFS_ASKEW_ADD;
          if (main?.current) {
            tl.to(main.current, { rotation: 0, x: 0, y: 0, scale: 1, duration: 0.25, ease: 'back.out(2)' }, 'restore+=1.95');
          }
          if (add?.current) {
            tl.to(add.current, { rotation: askewAdd.rotation, x: askewAdd.x, y: askewAdd.y, scale: 1, duration: 0.25, ease: 'back.out(2)', transfomationOrigin: '10%, 90%' }, 'restore+=1.95');
          }
        } else {
          tl.to(
            targets,
            { rotation: targetPose.rotation, x: targetPose.x, y: targetPose.y, scale: 1, duration: 0.25, ease: 'back.out(2)' },
            'restore+=1.95'
          );
        }
        tl.to(targets, { filter: RESTORE_GLOW_OFF, duration: 0.35, ease: 'power1.in' }, 'restore+=1.95');

        tl.to(
          restoreBodyTargets,
          { rotation: 0, y: 0, scaleY: 1, duration: 0.5, ease: 'sine.inOut', stagger: 0.03 },
          'restore+=2.1'
        );

        // Handcuffs'/legcuffs' own restore flourish - a slower, mirrored
        // reverse of the whip's rear-up-and-kick: legs settle back down and
        // the whole body lowers, as the Silencer closes the cuffs back on.
        // Identical for both pieces - a whole-body reaction, not anchored to
        // either piece's own leg.
        if (change.key === 'handcuffs' || change.key === 'legcuffs') {
          // scaleY targets are relative to SONGBEAST_BASE_SCALE, not literal
          // 1 - see that constant's own comment for why a literal 1 here
          // permanently shrinks the group instead of returning it to rest.
          tl.to(songbeastGroupRef.current, { rotation: 4, y: -7, scaleY: SONGBEAST_BASE_SCALE * 1.03, duration: 0.5, ease: 'sine.out', transformOrigin: '50% 100%' }, 'restore+=1.6');
          tl.to(songbeastGroupRef.current, { rotation: 0, y: 0, scaleY: SONGBEAST_BASE_SCALE, scaleX: SONGBEAST_BASE_SCALE, duration: 0.7, ease: 'sine.inOut' }, 'restore+=2.1');
          tl.to(frontLegsRef.current, { rotation: 5, x: 6, y: -5, duration: 0.5, ease: 'sine.out', transformOrigin: '50% 100%' }, 'restore+=1.6');
          tl.to(frontLegsRef.current, { rotation: 0, x: 0, y: 0, duration: 0.7, ease: 'sine.inOut' }, 'restore+=2.1');
          tl.to(backLegsRef.current, { rotation: 4, x: 6, y: -5, duration: 0.5, ease: 'sine.out', transformOrigin: '50% 100%' }, 'restore+=1.6');
          tl.to(backLegsRef.current, { rotation: 0, x: 0, y: 0, duration: 0.7, ease: 'sine.inOut' }, 'restore+=2.1');
        }

        tl.add(() => setGearStatus(nextGearStatusRestore), 'restore+=2.55');
      }
    }
  };

  // eslint-disable-next-line react-hooks/refs
  const setback = contextSafe(() => {
    setPhaseBoth('setback');
    onReSilenceEffectStart();

    idleTweens.current.forEach((t) => t.pause());

    const nextGearStatusRestore = toGearStatusRecord(gearPiecesRef.current, activeGearOrderRef.current);
    const gearRestoreChanges = diffGearStatus(gearStatusRef.current, nextGearStatusRestore);

    const tl = gsap.timeline({
      onComplete: () => {
        setPhaseBoth('idle');
        // startIdle(), not .resume() - see playerTurn's matching comment on
        // why resuming a paused repeat:-1/yoyo tween can snap the body back
        // to a stale mid-breath value instead of the settle this timeline
        // just finished landing on.
        startIdle();
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
      // No single restored src to swap to here - the base lower body is 4
      // separate layers (tail/backLegs/belly/frontLegs) but there's only one
      // combined restored.legs asset, so the swap is a visibility flip
      // across all 5 elements instead of a src reassignment.
      [tailRef, backLegsRef, bellyRef, frontLegsRef].forEach((ref) => {
        if (ref.current) ref.current.style.opacity = '0';
      });
      if (restoredLegsRef.current) restoredLegsRef.current.style.opacity = '1';
      gsap.set(songbeastHeadImgRef.current, { y: 0 });
    }, 'phase4+=1.6');

    tl.to(silencerGroupRef.current, { opacity: 0, scale: 0.9, duration: 0.6, ease: 'power1.in' }, 'phase4+=1.6');

    tl.to(songbeastGroupRef.current, { scale: RESTORED_SONGBEAST_SCALE, duration: 0.6, ease: 'power2.out' }, 'phase4+=1.6');

    // Counter-scale the floor containers any already-removed gear landed in,
    // in lockstep with the Songbeast's own scale-up above, so that gear (the
    // Silencer's, left behind on the ground) doesn't visually grow too - it's
    // not part of the Songbeast's body being restored. Handcuffs get a
    // relative `*=` multiply instead of an absolute value, since (unlike the
    // floor containers) they carry their own resting scale already (see
    // their own resting-pose effect) that this needs to cancel the parent
    // scale-up on TOP of, not overwrite.
    tl.to([floorFrontRef.current, floorBehindRef.current], { scale: 1 / RESTORED_SONGBEAST_SCALE, duration: 0.6, ease: 'power2.out' }, 'phase4+=1.6');

    // Null-filtered - handcuffsMainRef/AddRef/legcuffsMainRef/AddRef stay
    // null (never rendered) when includesHandcuffs/includesLegcuffs is
    // false, and GSAP throws (rather than no-oping) if handed a target
    // array containing null.
    const cuffRefs = [
      handcuffsMainRef.current,
      handcuffsAddRef.current,
      legcuffsMainRef.current,
      legcuffsAddRef.current,
    ].filter((el): el is HTMLImageElement => el !== null);
    if (cuffRefs.length > 0) {
      tl.to(
        cuffRefs,
        { scale: `*=${1 / RESTORED_SONGBEAST_SCALE}`, duration: 0.6, ease: 'power2.out' },
        'phase4+=1.6'
      );
    }

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

  // Every real battle-turn/re-silence/golden-flash tween along the way
  // (idle breathing, the whip cascade, the Speak Lies restore, the golden
  // flash's own head tilt) leaves torsoGroupRef/headContainerRef/playerRef
  // sitting at whatever value they were mid-tween when paused/killed or
  // never tweened back - the "Cheat: Restored" mount-time path never touches
  // any of that history, so it always starts this loop from a clean
  // baseline. Snapping every property this function actually animates back
  // to that same neutral baseline first - unconditionally, regardless of
  // which path called this - is what makes the two look identical instead
  // of the real path's leftover offsets (and, worse, an interpolated
  // transformOrigin sliding from the golden flash's '50% 100%' to this
  // loop's '0% 50%') reading as the head detaching from the body.
  // eslint-disable-next-line react-hooks/refs
  const startMajesticIdle = contextSafe(() => {
    idleTweens.current.forEach((t) => t.kill());
    idleTweens.current = [];

    gsap.set(torsoGroupRef.current, { scaleY: 1, scaleX: 1 });
    gsap.set(headContainerRef.current, { rotation: 0, y: 0, transformOrigin: '0% 50%' });
    gsap.set(playerRef.current, { y: 0, scaleY: 1 });

    idleTweens.current.push(
      gsap.to(torsoGroupRef.current, {
        scaleY: 1.02,
        duration: 2.2,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
        transformOrigin: '50% 100%',
      })
    );
    idleTweens.current.push(
      gsap.to(headContainerRef.current, {
        rotation: -1.5,
        y: -1,
        duration: 2.2,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
        transformOrigin: '0% 50%',
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
    // `isolate` traps this scene's internal z-index values (several of which
    // go up to 999, see silencerWaveRef below) inside a local stacking
    // context - without it, those values escape all the way to the page's
    // root stacking context (since no ancestor between here and <body> sets
    // a z-index of its own) and can out-rank unrelated fixed-position
    // overlays elsewhere on the page, like SettingsModal's z-50 backdrop.
    <div
      className="relative isolate mx-auto flex w-full flex-col overflow-hidden rounded-xl bg-gradient-to-b from-green-950 to-slate-900 text-white"
      style={{ maxWidth: BATTLE_SCENE_MAX_WIDTH, aspectRatio: BATTLE_SCENE_ASPECT_RATIO }}
    >
      <div className="relative flex-1">
        <img
          src={backgroundSrc}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />

        {/* Player's ground shadow. bottom is NOT the same 52 the player body
            div below uses - Player_Girl_Body.png has ~65 (pre-scale) worth
            of transparent padding below the character's actual feet
            (measured directly against the PNG's non-transparent pixels), so
            anchoring the shadow to the body div's own bottom edge floats it
            deep in that empty padding, invisible. The extra +65 compensates
            for that; +15 on top is the deliberate upward nudge, same as the
            Songbeast's own shadow below. */}
        <div
          className="pointer-events-none absolute rounded-full"
          style={{
            bottom: (52 + 65) * BATTLE_SCENE_SCALE + 15,
            left: 78 * BATTLE_SCENE_SCALE,
            width: 116 * BATTLE_SCENE_SCALE,
            height: 16 * BATTLE_SCENE_SCALE,
            background: 'radial-gradient(ellipse, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.22) 55%, rgba(0,0,0,0) 75%)',
          }}
        />

        <div
          className="absolute"
          style={{
            bottom: 52 * BATTLE_SCENE_SCALE,
            left: 32 * BATTLE_SCENE_SCALE,
            height: 288 * BATTLE_SCENE_SCALE,
            width: 208 * BATTLE_SCENE_SCALE,
            transform: 'scale(1.08)',
            transformOrigin: '50% 100%',
          }}
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
          className="absolute pointer-events-none"
          style={{
            bottom: 52 * BATTLE_SCENE_SCALE,
            left: 32 * BATTLE_SCENE_SCALE,
            height: 288 * BATTLE_SCENE_SCALE,
            width: 208 * BATTLE_SCENE_SCALE,
            zIndex: 9,
            transform: 'scale(1.08)',
            transformOrigin: '50% 100%',
          }}
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
          className="pointer-events-none absolute opacity-0"
          style={{
            bottom: 200 * BATTLE_SCENE_SCALE,
            left: 160 * BATTLE_SCENE_SCALE,
            height: 96 * BATTLE_SCENE_SCALE,
            width: 96 * BATTLE_SCENE_SCALE,
            borderRadius: '50%',
            border: '6px solid rgba(255,210,90,0.9)',
            clipPath: 'polygon(50% 50%, 100% 12%, 100% 88%)',
            boxShadow: '0 0 30px 6px rgba(255,210,90,0.7)',
            filter: 'blur(3px)',
          }}
        />

        {/* Songbeast's ground shadow - nudged up 15px from its natural
            foot-aligned position (bottom matches songbeastGroupRef below). */}
        <div
          className="pointer-events-none absolute rounded-full"
          style={{
            bottom: 120 * BATTLE_SCENE_SCALE + 5,
            left: 554 * BATTLE_SCENE_SCALE - 20,
            width: 144 * BATTLE_SCENE_SCALE,
            height: 16 * BATTLE_SCENE_SCALE,
            background: 'radial-gradient(ellipse, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.22) 55%, rgba(0,0,0,0) 75%)',
          }}
        />

        <div
          ref={songbeastGroupRef}
          className="absolute"
          style={{
            bottom: 120 * BATTLE_SCENE_SCALE,
            right: 110 * BATTLE_SCENE_SCALE,
            height: 176 * BATTLE_SCENE_SCALE,
            width: 320 * BATTLE_SCENE_SCALE,
            transform: `scale(${SONGBEAST_BASE_SCALE})`,
            transformOrigin: '50% 100%',
          }}
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
            ref={tailRef}
            src={BATTLE_ASSETS.songbeast.base.tail}
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full object-contain object-bottom"
            style={{ zIndex: 2, opacity: startRestored ? 0 : 1 }}
          />
          {includesLegcuffs && (
            <img
              ref={legcuffsAddRef}
              src={BATTLE_ASSETS.songbeast.gear.legcuffs.add}
              alt=""
              className="pointer-events-none absolute inset-0 h-full w-full object-contain object-bottom"
              style={{ zIndex: 5 }}
            />
          )}

          <img
            ref={backLegsRef}
            src={BATTLE_ASSETS.songbeast.base.backLegs}
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full object-contain object-bottom"
            style={{ zIndex: 4, opacity: startRestored ? 0 : 1 }}
          />

          {includesLegcuffs && (
            <img
              ref={legcuffsMainRef}
              src={BATTLE_ASSETS.songbeast.gear.legcuffs.main}
              alt="Songbeast legcuffs"
              className="pointer-events-none absolute inset-0 h-full w-full object-contain object-bottom"
              style={{ zIndex: 7 }}
            />
          )}
          <img
            ref={bellyRef}
            src={BATTLE_ASSETS.songbeast.base.belly}
            alt="Songbeast legs and tail"
            className="pointer-events-none absolute inset-0 h-full w-full object-contain object-bottom"
            style={{ zIndex: 3, opacity: startRestored ? 0 : 1 }}
          />
          <img
            ref={restoredLegsRef}
            src={BATTLE_ASSETS.songbeast.restored.legs}
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full object-contain object-bottom"
            style={{ zIndex: 4, opacity: startRestored ? 1 : 0 }}
          />

          {includesHandcuffs && (
            <img
              ref={handcuffsAddRef}
              src={BATTLE_ASSETS.songbeast.gear.handcuffs.add}
              alt=""
              className="pointer-events-none absolute inset-0 h-full w-full object-contain object-bottom"
              style={{ zIndex: 9 }}
            />
          )}

          <img
            ref={frontLegsRef}
            src={BATTLE_ASSETS.songbeast.base.frontLegs}
            alt="Songbeast legs and tail"
            className="pointer-events-none absolute inset-0 h-full w-full object-contain object-bottom"
            style={{ zIndex: 6, opacity: startRestored ? 0 : 1 }}
          />

          {includesHandcuffs && (
            <img
              ref={handcuffsMainRef}
              src={BATTLE_ASSETS.songbeast.gear.handcuffs.main}
              alt="Songbeast handcuffs"
              className="pointer-events-none absolute inset-0 h-full w-full object-contain object-bottom"
              style={{ zIndex: 10 }}
            />
          )}

          {/* No transformOrigin here on purpose - every tween that rotates
              torsoGroupRef/headContainerRef (whip, idle breathing, handcuffs
              cascade) already sets its own explicitly. A static value here
              would get reasserted by React on any unrelated re-render mid-
              tween, snapping the pivot back and corrupting whichever
              rotation is currently in flight. */}
          <div ref={torsoGroupRef} className="absolute inset-0" style={{ zIndex: 8 }}>
            <img
              ref={songbeastBodyImgRef}
              src={startRestored ? BATTLE_ASSETS.songbeast.restored.body : BATTLE_ASSETS.songbeast.base.body}
              alt="Songbeast torso"
              className="absolute inset-0 h-full w-full object-contain object-bottom translate-y-[1px]"
            />
          </div>

          <div ref={floorBehindRef} className="pointer-events-none absolute inset-0" style={{ zIndex: 9 }} />

          <div ref={headContainerRef} className="absolute inset-0" style={{ zIndex: 10 }}>
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

          <div ref={floorFrontRef} className="pointer-events-none absolute inset-0" style={{ zIndex: 11 }} />
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
          className="pointer-events-none absolute rounded-full"
          style={{
            bottom: 48 * BATTLE_SCENE_SCALE,
            left: 735 * BATTLE_SCENE_SCALE,
            width: 114 * BATTLE_SCENE_SCALE,
            height: 16 * BATTLE_SCENE_SCALE,
            background: 'radial-gradient(ellipse, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.22) 55%, rgba(0,0,0,0) 75%)',
          }}
        />

        <div
          ref={silencerGroupRef}
          className="absolute opacity-90"
          style={{
            bottom: 48 * BATTLE_SCENE_SCALE,
            height: 288 * BATTLE_SCENE_SCALE,
            width: 208 * BATTLE_SCENE_SCALE,
            right: '0px',
            zIndex: 0,
            transformOrigin: '50% 100%',
            transform: 'scale(1.08)',
          }}
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
          className="pointer-events-none absolute opacity-0"
          style={{
            bottom: 196 * BATTLE_SCENE_SCALE,
            right: 56 * BATTLE_SCENE_SCALE,
            height: 96 * BATTLE_SCENE_SCALE,
            width: 96 * BATTLE_SCENE_SCALE,
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
