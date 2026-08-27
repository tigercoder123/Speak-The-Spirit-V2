'use client';

import { useState } from 'react';
import SongbeastBattleAvatar from '../../../components/battle/SongbeastBattleAvatar';
import type { GearPieceState } from '../../../hooks/useSilencerBattle';
import { BATTLE_ASSETS } from '../../../config/battleAssets';

// TEMPORARY debug harness - isolates SongbeastBattleAvatar so a gear-removal
// cascade animation can be visually inspected without playing through a real
// battle. Delete this file once the animation is confirmed. Cycles legcuffs
// (index 4 - the newest piece) rather than handcuffs, since that's what
// currently needs visual iteration; handcuffs (index 3) stays 'ON'
// throughout, unexercised by this harness. Cycle order for the single
// trigger button below: on -> half off -> fully off -> back to on. Index
// into this array is the only state the button needs to track;
// STAGE_LABELS (same order) describes what the NEXT press will do, so the
// button always previews its own next action.
const STAGE_ORDER: GearPieceState[] = ['ON', 'HALF_ON', 'REMOVED'];
const STAGE_LABELS = [
  'Loosen Legcuffs (half off)',
  'Remove Legcuffs (fully off)',
  'Reset Legcuffs (put back on)',
];

export default function BattleAnimDebugPage() {
  const [gearPieces, setGearPieces] = useState<GearPieceState[]>(['ON', 'ON', 'ON', 'ON', 'ON']);
  const [stageIndex, setStageIndex] = useState(0);
  const [battleTurnRequestId, setBattleTurnRequestId] = useState(0);
  // Separate from battleTurnRequestId on purpose - see resetAll's own
  // comment for why.
  const [silencerTurnRequestId, setSilencerTurnRequestId] = useState(0);
  // Blocks the trigger buttons while a cascade is mid-playback (~4-6s) so a
  // second click - or a Fast Refresh remount landing mid-animation while
  // this file or SongbeastBattleAvatar is being edited - can't start a
  // second overlapping GSAP timeline animating the same refs as the first,
  // which reads as the songbeast jumping/scaling/moving on its own.
  const [isAnimating, setIsAnimating] = useState(false);

  const cycleLegcuffs = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    const nextIndex = (stageIndex + 1) % STAGE_ORDER.length;
    setGearPieces((prev) => {
      const next = [...prev];
      next[4] = STAGE_ORDER[nextIndex];
      return next;
    });
    setStageIndex(nextIndex);
    // The wrap-around step (REMOVED -> ON, i.e. this button's own "Reset
    // Legcuffs" stage) is a restore, not a removal - route it through
    // silencerTurnRequestId/setback() same as resetAll below, instead of
    // battleTurnRequestId/playerTurn(), which has no real case for gear
    // going back ON (see resetAll's comment for the full explanation).
    if (STAGE_ORDER[nextIndex] === 'ON') {
      setSilencerTurnRequestId((n) => n + 1);
    } else {
      setBattleTurnRequestId((n) => n + 1);
    }
  };

  const resetAll = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setGearPieces(['ON', 'ON', 'ON', 'ON', 'ON']);
    setStageIndex(0);
    // Bumps silencerTurnRequestId (-> setback() -> buildSetbackTweens), NOT
    // battleTurnRequestId. battleTurnRequestId only ever drives playerTurn()
    // (buildPlayerTurnTweens), which only has a real branch for gear coming
    // OFF ('half' or fully removed) - anything that isn't 'half' falls into
    // its shared else branch, which unconditionally applies FLOOR_POSE and
    // (for handcuffs) replays the full removal jump. Putting gear back ON
    // has no case there at all, so routing Reset through battleTurnRequestId
    // used to replay the removal jump/drop logic on a restore, which is
    // exactly why the squash never resolved - the crouch/impact squeeze the
    // real removal flow expects to be followed by its own settle was instead
    // landing on gear moving the WRONG direction. The real game only ever
    // restores gear via silencerTurnRequestId (see useSilencerBattle.ts's
    // wrong-answer path), so this now matches that.
    setSilencerTurnRequestId((n) => n + 1);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8 flex flex-col items-center gap-6">
      <h1 className="text-xl font-black">Battle Animation Debug</h1>
      <div className="flex gap-4">
        <button
          onClick={cycleLegcuffs}
          disabled={isAnimating}
          className="bg-amber-500 text-black font-black px-4 py-2 rounded border-2 border-black disabled:opacity-50"
        >
          {isAnimating ? 'Playing...' : STAGE_LABELS[stageIndex]}
        </button>
        <button
          onClick={resetAll}
          disabled={isAnimating}
          className="bg-slate-600 text-white font-black px-4 py-2 rounded border-2 border-black disabled:opacity-50"
        >
          Reset
        </button>
      </div>
      <div className="relative w-full max-w-3xl">
        <SongbeastBattleAvatar
          backgroundSrc={BATTLE_ASSETS.backgrounds.themes[0].zoomedIn}
          gearPieces={gearPieces}
          includesHandcuffs={true}
          includesLegcuffs={true}
          silencerTurnRequestId={silencerTurnRequestId}
          onSilencerTurnComplete={() => {
            console.log('[debug] onSilencerTurnComplete');
            setIsAnimating(false);
          }}
          battleTurnRequestId={battleTurnRequestId}
          onGearRemoved={() => console.log('[debug] onGearRemoved')}
          onGearLanded={() => console.log('[debug] onGearLanded')}
          onReSilenceEffectStart={() => console.log('[debug] onReSilenceEffectStart')}
          onFinalRestorationComplete={() => console.log('[debug] onFinalRestorationComplete')}
          isFinalTurn={false}
          skipReSilence={true}
          onReSilenceBlocked={() => {
            console.log('[debug] onReSilenceBlocked');
            setIsAnimating(false);
          }}
          restorePercent={25}
          restoreBarVisible={true}
          thoughtBubbleText={null}
          thoughtBubbleVisible={false}
          thoughtBubbleBeat={null}
        />
      </div>
    </div>
  );
}
