'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../context/GameContext';
import { addLog } from '../utils/gameEvents';
import { getVerse } from '../services/scriptureService';
import { getFreshResponseChoices, getStaticResponseChoicesFallback } from '../services/responseChoicesService';
import { getFreshResilenceThought } from '../services/resilenceThoughtService';
import { getFreshWrongAnswerMoment } from '../services/wrongAnswerMomentService';
import { prefetchDistractors, getCachedDistractors } from '../services/distractorService';
import { LANGUAGE_NAMES } from '../services/bibleVersionsService';
import {
  buildFallbackDistractors,
  Challenge,
  ChallengeSegment,
  ChallengeType,
  checkAnswers,
  DistractorLookup,
  generateChallenge,
  tokenizeVerseWords,
} from '../utils/challengeGenerator';
import type { PowerUpType } from '../config/powerUpConfig';
import { BATTLE_ASSETS } from '../config/battleAssets';
import { usePlayerWalker } from './usePlayerWalker';
import type { Position } from './usePlayerWalker';
import { useSongbeastDebriefDialogue } from './useSongbeastDebriefDialogue';
import {
  EXPLORATION_CANVAS_BOUNDS,
  EXPLORATION_PLAYER_SPAWN,
  EXPLORATION_PLAYER_SPEED,
  INTRO_TO_CHALLENGE_DELAY_MS,
  INTRO_TRANSITION_DURATION_MS,
  PROXIMITY_TRIGGER_DISTANCE,
  SILENCED_PREVIEW_CENTER,
} from '../config/battleApproach';
import {
  buildRoundCurve,
  ExtraRoundCounts,
  GEAR_PIECE_INFO,
  getGearPieceOrder,
  GearPieceKey,
  NO_EXTRA_ROUNDS,
  ResponseOption,
  ResponseTone,
  SILENCER_BATTLE_CHOICE_THOUGHTS,
  SILENCER_BATTLE_FALLBACK_VERSE_TEXT,
  SILENCER_BATTLE_RESILENCE_THOUGHTS,
  SILENCER_BATTLE_RESILENCE_THOUGHTS_ZH_HEADPHONES,
  SILENCER_BATTLE_RESPONSES,
  SILENCER_BATTLE_VERSE_REFERENCE,
  SILENCER_BATTLE_WRONG_ANSWER_LINES,
  SILENCER_BATTLE_WRONG_ANSWER_THOUGHTS,
  SilencerBattleRoundConfig,
  TOTAL_TURNS_FOR_PERFECT_RUN,
  WrongAnswerMoment,
} from '../config/silencerBattleRounds';

// Which of the three thought-bubble beats is currently showing (see
// components/battle/ThoughtBubble.tsx) - CHOICE reacts to the specific line
// the player just picked, RESILENCE reacts to the Silencer's own line as gear
// goes back on after a correct answer, WRONG_ANSWER reacts to the Silencer's
// gloating line as gear goes back on after a miss. Exported so the
// presentational component can type its prop without redeclaring this union.
export type ThoughtBubbleBeat = 'CHOICE' | 'RESILENCE' | 'WRONG_ANSWER';

// Explicit state machine for the restoration battle. Ephemeral, per-attempt
// battle state lives here rather than GameContext, since it resets every
// battle and never needs to persist; only the battle's durable outcome
// (screen nav + the cucumber reward) touches GameContext.
//
//   EXPLORING (walkable zoomed-out background, battle.png - the player
//     walks up to the silenced Songbeast+Silencer preview; a Restore
//     prompt shows/hides based on proximity) --(player confirms prompt)-->
//     INTRO (cinematic scale-up + cross-fade push-in from the zoomed-out
//     background to the zoomed-in one, battle-framed Songbeast/Silencer/
//     player arriving) --(settles, then a held delay)--> LOADING (verse
//     fetch) --> CHALLENGE
//   CHALLENGE --(correct)--> CORRECT (banner) --> CHOICE (three response
//     tones) --(select)--> GEAR_REMOVED (avatar plays the cascade/gear-
//     removal animation) --> RESILENCE (avatar chains into its own re-
//     silence animation + temptation line) --> CHALLENGE (next round)
//   CHALLENGE --(wrong)--> INCORRECT ("Good Try" banner) --> CHALLENGE
//     (parchment again, wrong blanks highlighted red, read-only - a beat,
//     not editable) --> SILENCER_TURN (avatar plays an isolated re-silence
//     animation) --> CHALLENGE (fresh, highlights cleared, editable again -
//     a first miss retries the same round; a second consecutive miss on the
//     same round rolls the difficulty back one tier)
//   RESILENCE --(final round)--> RESTORED (avatar plays its full-restoration
//     animation instead of the usual re-silence comeback, then a held banner
//     beat) --> DEBRIEF_PROMPT (a green Continue button - does NOT
//     auto-advance; see components/battle/DebriefContinueButton.tsx) --(player
//     clicks Continue)--> DIALOGUE (darkened dialogue over the still-visible
//     frozen battle scene - gratitude + cucumber gift + the send-off choice,
//     sequenced by hooks/useSongbeastDebriefDialogue.ts) --(final line
//     dismissed)--> MISSION_COMPLETE (a "Mission Complete!" banner + a green
//     Continue button in the corner - does NOT auto-advance; see
//     components/battle/MissionCompleteButton.tsx) --(player clicks
//     Continue)--> COMPLETE
export type BattlePhase =
  | 'EXPLORING'
  | 'INTRO'
  | 'LOADING'
  | 'CHALLENGE'
  | 'INCORRECT'
  | 'SILENCER_TURN'
  | 'CORRECT'
  | 'CHOICE'
  | 'GEAR_REMOVED'
  | 'RESILENCE'
  | 'RESTORED'
  | 'DEBRIEF_PROMPT'
  | 'DIALOGUE'
  | 'MISSION_COMPLETE'
  | 'COMPLETE';

export type GearPieceState = 'ON' | 'HALF_ON' | 'REMOVED';
// Index order matches the Songbeast battle avatar's own gear layering -
// see config/battleAssets.ts's `songbeast` keys (headphones, glasses, muzzle).
const GEAR_PIECE_COUNT = 3;

const CORRECT_BANNER_HOLD_MS = 1200;
const INCORRECT_BANNER_HOLD_MS = 1200;
// How much longer the CHOICE screen's response-choices Gloo call gets once
// the player actually submits a correct answer, if it hasn't resolved yet -
// see handleCorrectAnswer. There's no cutoff at all before this point (see
// the prefetch effect below): the fetch is allowed to run for however long
// the player takes to solve the challenge. On its own this would shortchange
// a very fast solve (e.g. answering in 2s would only give Gloo 2s + 3s = 5s
// total, less than the old fixed window), so MIN_TOTAL_RESPONSE_WAIT_MS
// below acts as a floor on top of it.
const RESPONSE_SUBMIT_GRACE_MS = 3000;
// The total time from when the fetch STARTED (CHALLENGE-phase-start) to
// when handleCorrectAnswer is allowed to give up is never less than this -
// so a fast solve still gets at least as much room as the old fixed
// timeout did. Only matters when solving took less than this long; a
// slower solve already exceeds it and just gets RESPONSE_SUBMIT_GRACE_MS
// more, uncapped.
const MIN_TOTAL_RESPONSE_WAIT_MS = 11000;
const MISTAKE_REVIEW_HOLD_MS = 3000;
const CHOICE_TO_RESTORATION_DELAY_MS = 700;
const POST_SILENCER_PARCHMENT_DELAY_MS = 600;
const RESTORED_BANNER_DELAY_MS = 1000;
const DEBRIEF_HOLD_MS = 1500;

const GEAR_LEVELS: Record<GearPieceState, number> = { ON: 2, HALF_ON: 1, REMOVED: 0 };
const LEVELS_TO_GEAR_STATE: GearPieceState[] = ['REMOVED', 'HALF_ON', 'ON'];

// Both setbacks cost this same amount - always derived from
// roundCurve.battleProgress.correctAnswerGain via its setbackRatio, never
// its own independently-tuned number, so retuning the gain keeps both
// setbacks at exactly half of it automatically. See BATTLE_PROGRESS's own
// doc comment in config/silencerBattleRounds.ts for how the gain itself is
// sized. This used to be a module-level constant, but the gain now varies
// per-verse (a handcuffs battle's 8-round curve has a different gain than
// the base 6-round one), so it's computed inside the hook instead - see
// progressSetbackAmount below.

// The restore bar's progress score is a gain/loss ledger, not a simple
// cleared-count ratio, since it moves both up (a correct answer) and down
// (either setback) - clamped so a string of setbacks can't drive it
// negative and a string of gains can't overshoot 100.
function clampProgress(value: number): number {
  return Math.min(100, Math.max(0, value));
}

// A correct answer removes 2 gear "levels" total (each piece has 2 levels:
// on=2, half=1, removed=0), consumed in order - draining the current piece
// to 0 before spilling over into the next one. Mirrors the battle avatar's
// own cascade physics 1:1 so this data-only state always matches what plays
// out visually once the avatar diffs its previous gearPieces prop against this.
function applyGearCascade(pieces: GearPieceState[], levelsToRemove: number): GearPieceState[] {
  const next = [...pieces];
  let remaining = levelsToRemove;
  for (let i = 0; i < next.length && remaining > 0; i++) {
    const levels = GEAR_LEVELS[next[i]];
    if (levels <= 0) continue;
    const take = Math.min(levels, remaining);
    next[i] = LEVELS_TO_GEAR_STATE[levels - take];
    remaining -= take;
  }
  return next;
}

// The Silencer restores exactly 1 level per re-silence (both the
// correct-answer setback and a standalone wrong-answer one restore gear) - in
// the OPPOSITE order gear gets removed, repairing whatever was most recently
// stripped first.
function applyGearRestore(pieces: GearPieceState[], levelsToRestore: number): GearPieceState[] {
  const next = [...pieces];
  let remaining = levelsToRestore;
  for (let i = next.length - 1; i >= 0 && remaining > 0; i--) {
    const levels = GEAR_LEVELS[next[i]];
    if (levels >= 2) continue;
    const add = Math.min(2 - levels, remaining);
    next[i] = LEVELS_TO_GEAR_STATE[levels + add];
    remaining -= add;
  }
  return next;
}

// Which single piece applyGearRestore(pieces, 1) would affect - the last
// (highest-index) piece that isn't already fully ON. Used to tell the fresh
// temptation-line generator which gear piece the Silencer is about to put
// back on, without actually applying the restore yet.
function findGearRestoreTargetIndex(pieces: GearPieceState[]): number {
  for (let i = pieces.length - 1; i >= 0; i--) {
    if (GEAR_LEVELS[pieces[i]] < 2) return i;
  }
  return -1;
}

function extraRoundsKeyFor(type: ChallengeType): keyof ExtraRoundCounts | null {
  if (type === 'WORD_BANK') return 'wordBank';
  if (type === 'DROPDOWN') return 'dropdown';
  if (type === 'FILL_IN_BLANK') return 'fillInBlank';
  return null; // WHOLE_VERSE is the curve's last tier - nothing to roll back past it
}

export function useSilencerBattle() {
  const {
    setCurrentScreen,
    setCucumbers,
    triggerShake,
    bibleVersionId,
    bibleLanguage,
    bibleVerseReference,
    pendingBattleSpawn,
    setPendingBattleSpawn,
    pendingBattleSkipToRestored,
    setPendingBattleSkipToRestored,
    pendingBattleDebugRound,
    setPendingBattleDebugRound,
    powerUps,
    setPowerUps,
  } = useGame();

  // Settings-driven verse reference (GameContext, editable via SettingsModal) -
  // falls back to the default battle verse until the player picks their own.
  const activeVerseReference = bibleVerseReference || SILENCER_BATTLE_VERSE_REFERENCE;
  // Human-readable language name fed into every Gloo prompt below (response
  // choices, Songbeast reactions/thoughts, Silencer lines) so the whole
  // battle's generated dialogue - not just the word-bank/dropdown distractors -
  // comes back in the player's chosen verse language.
  const activeLanguageName = bibleLanguage ? (LANGUAGE_NAMES[bibleLanguage] ?? bibleLanguage) : 'English';

  // Dev cheat (GameHeader.tsx's "Cheat: Restored" button) - captured once on
  // mount, same pattern as initialExplorationSpawnRef below, so clearing the
  // context flag right after doesn't retroactively un-skip THIS mount. When
  // true, the several lazy useState initializers below seed this battle
  // already in its "just won" shape instead of the normal fresh-start one.
  const skipToRestoredRef = useRef(pendingBattleSkipToRestored);

  // Dev cheat (GameHeader.tsx's "Round 5" button) - same one-shot-ref
  // pattern as skipToRestoredRef above. When set, the EXPLORING walk-up is
  // skipped entirely (phase seeds straight to 'LOADING', see below) and
  // startBattle() runs immediately on mount instead of waiting for
  // confirmRestore(); once its verse fetch resolves, it jumps roundNumber to
  // this (1-indexed) round instead of leaving it at round 1 - see
  // startBattle's own use of this ref for where that jump actually happens.
  const debugRoundRef = useRef(pendingBattleDebugRound);

  // Randomly picked once per mount (fresh every time the player clicks
  // Battle) - the SAME theme's zoomedOut/zoomedIn pair is used for both the
  // exploration view and the zoomed-in battle view below, so the scenery
  // reads as one consistent place instead of switching mid-battle.
  const [battleTheme] = useState(
    () => BATTLE_ASSETS.backgrounds.themes[Math.floor(Math.random() * BATTLE_ASSETS.backgrounds.themes.length)]
  );

  const [phase, setPhaseState] = useState<BattlePhase>(() =>
    skipToRestoredRef.current ? 'RESTORED' : debugRoundRef.current !== null ? 'LOADING' : 'EXPLORING'
  );
  // phaseRef is updated synchronously inside this wrapper - not via a
  // separate useEffect - because @gsap/react's useGSAP runs its callbacks
  // in a useLayoutEffect, which always fires before any component's own
  // passive useEffect in the same commit (layout effects across the WHOLE
  // tree flush before passive effects across the whole tree, regardless of
  // parent/child nesting). The wrong-answer path bumps silencerTurnRequestId
  // and setPhase('SILENCER_TURN') together with no delay before the
  // avatar's setback() synchronously reads phaseRef inside that same layout
  // effect - a passive-effect-mirrored ref would still hold the previous
  // phase at that point. The correct-answer path happens to mask this same
  // race with an incidental 350ms gsap.delayedCall before its own setback()
  // call, giving a passive effect time to catch up - the wrong-answer path
  // has no such buffer, which is why only that path's dialogue was silently
  // dropped.
  const phaseRef = useRef<BattlePhase>(phase);
  const setPhase = useCallback((update: BattlePhase | ((prev: BattlePhase) => BattlePhase)) => {
    setPhaseState((prev) => {
      const next = typeof update === 'function' ? (update as (p: BattlePhase) => BattlePhase)(prev) : update;
      phaseRef.current = next;
      return next;
    });
  }, []);
  const [verseText, setVerseText] = useState('');
  const [verseError, setVerseError] = useState<string | null>(null);

  // `roundNumber` drives the difficulty tier and can move backward (a wrong
  // answer rolls it back one tier) as well as forward. `roundVisitCounts`
  // tracks how many times each roundNumber has been visited this session (0 =
  // first time) so a repeat visit after a rollback blanks different words
  // instead of the identical selection - see config/silencerBattleRounds.ts.
  const [roundNumber, setRoundNumber] = useState(() => (skipToRestoredRef.current ? TOTAL_TURNS_FOR_PERFECT_RUN - 1 : 0));
  const [roundVisitCounts, setRoundVisitCounts] = useState<Record<number, number>>({ 0: 0 });
  const [extraRounds, setExtraRounds] = useState<ExtraRoundCounts>(NO_EXTRA_ROUNDS);
  const [wrongStreak, setWrongStreak] = useState(0);
  // Every wrong answer, streak or not, restores 1 gear level via
  // applyGearRestore in submitAnswer's incorrect branch below - so every
  // wrong answer, not just a streak's second consecutive miss (which also
  // rolls the difficulty back a tier via extraRounds above, a separate,
  // curve-composition concern), pushes the battle's actual finish one round
  // further out. See isFinalRound below.
  const [totalWrongAnswers, setTotalWrongAnswers] = useState(0);
  const missedChallengeTypeRef = useRef<ChallengeType | null>(null);

  // Battle-scoped power-up state - never persisted (see config/powerUpConfig.ts
  // for the purchased-inventory side, which lives in GameContext instead).
  // Wiped on every startBattle() and again when the battle ends (RESTORED) -
  // see those two spots below. Shield/Hush Silencer linger across challenges
  // within a battle until consumed; Hint/Check/Free Pass never linger here.
  const [activePowerUps, setActivePowerUps] = useState<{ SHIELD: number; HUSH_SILENCER: number }>({
    SHIELD: 0,
    HUSH_SILENCER: 0,
  });
  // True once Hint is selected from the menu and still waiting on its
  // trigger - a valid blank click for every type except WHOLE_VERSE, the
  // Continue button (confirmWholeVerseHint) for WHOLE_VERSE.
  const [hintArmed, setHintArmed] = useState(false);
  // WORD_BANK's hint effect - the word-bank entry to glow, keyed by its text
  // rather than a blank index since VerseParchment's word-bank rendering is
  // per-word, not per-blank.
  const [hintGlowWord, setHintGlowWord] = useState<string | null>(null);
  // Transient "Click on a valid blank!" message shown when a Hint is armed
  // and the player clicks an already-answered blank - self-clears via
  // schedule(). The persistent "click a blank" prompt shown for the rest of
  // targeting mode is derived below (see hintMessage), not stored here.
  const [hintInvalidClickMessage, setHintInvalidClickMessage] = useState<string | null>(null);
  // Check's pre-submit validation result - deliberately separate from the
  // real wrongBlanks (which drives the disabled mistake-review beat): Check
  // only highlights, it never submits or locks the parchment.
  const [checkHighlightBlanks, setCheckHighlightBlanks] = useState<number[]>([]);
  const [checkMessage, setCheckMessage] = useState<string | null>(null);
  const [shieldPopupVisible, setShieldPopupVisible] = useState(false);

  const [answers, setAnswers] = useState<string[]>([]);
  const [wrongBlanks, setWrongBlanks] = useState<number[]>([]);
  const [gearPieces, setGearPieces] = useState<GearPieceState[]>(() =>
    Array(GEAR_PIECE_COUNT).fill(skipToRestoredRef.current ? 'REMOVED' : 'ON')
  );
  // The restore bar's own progress score (0-100, see BATTLE_PROGRESS in
  // config/silencerBattleRounds.ts) - deliberately separate from gearPieces
  // above, which still drives only the Songbeast's gear visuals. Kept
  // unrounded internally so many small gain/loss steps don't accumulate
  // rounding drift; restorePercent below rounds it for display.
  const [progressScore, setProgressScore] = useState(() => (skipToRestoredRef.current ? 100 : 0));
  const [selectedTone, setSelectedTone] = useState<ResponseTone | null>(null);
  // null while a fresh set hasn't arrived yet for this round - the CHOICE
  // screen shows a loading state rather than stale or empty options; see
  // services/responseChoicesService.ts for the generation + fallback policy.
  const [responseOptions, setResponseOptions] = useState<ResponseOption[] | null>(null);
  const [responsesLoading, setResponsesLoading] = useState(false);
  // Guards against a slow generation call from a PREVIOUS round committing its
  // result after a later round has already started its own.
  const responseGenerationIdRef = useRef(0);
  // Which round's config responseOptions/choiceReactions above were generated
  // (or are currently generating) for - see the prefetch effect below. Lets
  // that effect tell "already have/are fetching the right thing, do nothing"
  // apart from "this is a new round, fetch again" - keyed on the round's own
  // config object (a fresh reference every time roundNumber OR
  // challengeVariant changes - see currentRound's useMemo) rather than the
  // targeted gear piece key, since a rollback can revisit the same gear piece
  // across genuinely different rounds and still needs fresh lines each time.
  // ALSO keyed on the language that was actually requested (not just the
  // round) - bibleLanguage often hasn't finished loading from Supabase yet
  // the instant round 0's CHALLENGE phase first mounts, so that round's
  // first fetch can fire in the 'English' default before the player's real
  // language is known; keying on round alone would then permanently skip
  // ever re-fetching once the correct language DOES load a moment later,
  // since currentRound itself wouldn't have changed.
  const prefetchedRoundRef = useRef<{ round: SilencerBattleRoundConfig; language: string } | null>(null);
  // True once the CURRENT round's response/reactions/rebuttals are actually
  // in state - whether from a real Gloo result or a forced fallback (see
  // handleCorrectAnswer's submit-triggered grace timer below). Reset to
  // false every time a new fetch starts (the prefetch effect below), so
  // handleCorrectAnswer can tell "is there already something to show, or do
  // I need to start a grace-period countdown."
  const responseSettledRef = useRef(false);
  // Which gear piece the CURRENT round's response-choices call targeted -
  // needed by handleCorrectAnswer's grace-period timer to build the correct
  // static fallback (gear-specific, e.g. the Chinese headphones fallback) if
  // it ever has to force one, without re-deriving gearKey from gearPieces at
  // that later point (which may have already changed by then).
  const responseGearKeyRef = useRef<GearPieceKey | null>(null);
  // When the CURRENT round's response-choices fetch actually started (epoch
  // ms) - lets handleCorrectAnswer's grace timer enforce
  // MIN_TOTAL_RESPONSE_WAIT_MS as a floor on top of RESPONSE_SUBMIT_GRACE_MS,
  // rather than always waiting only 3s past submit regardless of how little
  // time the fetch has actually had so far.
  const responseFetchStartedAtRef = useRef(0);
  // The Songbeast's thought-bubble reaction to each of the 3 tonal lines
  // above - generated in the SAME Gloo call as responseOptions (see
  // services/responseChoicesService.ts), cached here so the matching one is
  // already in hand the instant the player picks in selectResponse() below.
  // Mirrored into a ref since selectResponse reads it from a stable
  // useCallback closure.
  const [choiceReactions, setChoiceReactions] = useState<Record<ResponseTone, string> | null>(null);
  const choiceReactionsRef = useRef(choiceReactions);
  useEffect(() => {
    choiceReactionsRef.current = choiceReactions;
  }, [choiceReactions]);
  // The Silencer's own tone-keyed comeback line reacting to each of the 3
  // tonal lines above - generated in the SAME Gloo call as responseOptions
  // (see services/responseChoicesService.ts), so whichever one matches the
  // tone the player actually picks is already in hand the instant
  // selectResponse() below needs it as this round's RESILENCE-beat
  // temptation line. Mirrored into a ref for the same reason as
  // choiceReactionsRef above. null (or a tone missing from it) falls back to
  // the static per-tier config line, same as before this existed.
  const [choiceRebuttals, setChoiceRebuttals] = useState<Record<ResponseTone, string> | null>(null);
  const choiceRebuttalsRef = useRef(choiceRebuttals);
  useEffect(() => {
    choiceRebuttalsRef.current = choiceRebuttals;
  }, [choiceRebuttals]);
  // null until a fresh line arrives for this round - the displayed
  // temptationLine falls back to the static per-tier config line until then,
  // so RESILENCE is never left without a caption to show.
  const [freshTemptationLine, setFreshTemptationLine] = useState<string | null>(null);
  // The Songbeast's re-silence-beat thought, generated from the Silencer's
  // own (fresh-or-fallback) temptation line content once that resolves - see
  // services/resilenceThoughtService.ts. Mirrored into a ref so
  // handleReSilenceEffectStart can read whatever's arrived so far without
  // depending on a stale closure.
  const [freshResilenceThought, setFreshResilenceThought] = useState<string | null>(null);
  const freshResilenceThoughtRef = useRef(freshResilenceThought);
  const resilenceThoughtGenerationIdRef = useRef(0);
  useEffect(() => {
    freshResilenceThoughtRef.current = freshResilenceThought;
  }, [freshResilenceThought]);
  // The Silencer's wrong-answer-beat line and the Songbeast's doubtful
  // thought-bubble reply to it - generated together in one Gloo call (see
  // services/wrongAnswerMomentService.ts) as soon as a wrong answer lands.
  // Mirrored into a ref so handleReSilenceEffectStart can read whatever's
  // arrived so far without depending on a stale closure.
  const [freshWrongAnswerMoment, setFreshWrongAnswerMoment] = useState<WrongAnswerMoment | null>(null);
  const freshWrongAnswerMomentRef = useRef(freshWrongAnswerMoment);
  const wrongAnswerGenerationIdRef = useRef(0);
  useEffect(() => {
    freshWrongAnswerMomentRef.current = freshWrongAnswerMoment;
  }, [freshWrongAnswerMoment]);
  const [showTemptationLine, setShowTemptationLine] = useState(false);
  const [showChosenLine, setShowChosenLine] = useState(false);
  // Displayed Silencer caption for the wrong-answer beat - captured once,
  // right when the SILENCER_TURN beat begins (handleReSilenceEffectStart),
  // same "snapshot so it can't flicker mid-beat" reasoning as
  // thoughtBubbleContent below. Kept separate from freshTemptationLine/
  // showTemptationLine above, which stay dedicated to the correct-answer
  // RESILENCE beat exactly as before.
  const [wrongAnswerLine, setWrongAnswerLine] = useState<string | null>(null);
  const [showWrongAnswerLine, setShowWrongAnswerLine] = useState(false);
  // Thought-bubble text is captured once, at the instant each beat begins
  // (in selectResponse for CHOICE, in handleReSilenceEffectStart for
  // RESILENCE) rather than derived live every render - so if generation for
  // the OTHER beat resolves mid-display, or a later round's state starts
  // updating, the currently-shown thought never changes out from under the
  // player. Visibility is a separate flag so ThoughtBubble (a pure,
  // props-driven component) can transition out smoothly instead of the text
  // vanishing the instant the beat ends.
  const [thoughtBubbleContent, setThoughtBubbleContent] = useState<{ text: string; beat: ThoughtBubbleBeat } | null>(
    null
  );
  const [thoughtBubbleVisible, setThoughtBubbleVisible] = useState(false);
  const [showRestoredBanner, setShowRestoredBanner] = useState(false);
  const [silencerTurnRequestId, setSilencerTurnRequestId] = useState(0);
  const [battleTurnRequestId, setBattleTurnRequestId] = useState(0);

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  // Mirrored into refs (via an effect, not during render) so callbacks fired
  // long after this render committed - the avatar's GSAP timeline callbacks -
  // can read the truly-current value instead of whatever was captured in
  // their own stale closure. phase itself is NOT mirrored here - see
  // phaseRef's declaration above the setPhase wrapper for why an effect is
  // too late for it specifically.
  const roundNumberRef = useRef(roundNumber);
  const wrongStreakRef = useRef(wrongStreak);
  useEffect(() => {
    roundNumberRef.current = roundNumber;
    wrongStreakRef.current = wrongStreak;
  }, [roundNumber, wrongStreak]);

  // For one-shot delays fired imperatively from an event/callback (not tied
  // to a render's dependency list) - tracked so they're cleared on unmount.
  // State-triggered auto-transitions instead use their own useEffect+cleanup
  // below, which also guards against React StrictMode's double-invoked effects.
  const schedule = useCallback((fn: () => void, ms: number) => {
    timersRef.current.push(setTimeout(fn, ms));
  }, []);
  useEffect(() => () => { timersRef.current.forEach(clearTimeout); }, []);

  const restorePercent = Math.round(progressScore);

  // The round-progression curve is a function of the verse's actual text
  // (see config/silencerBattleRounds.ts), which only arrives once the live
  // fetch - or its offline fallback - resolves, so this is memoized per
  // verseText rather than built at module load. Its totalTurnsForPerfectRun/
  // battleProgress/includesHandcuffs/includesLegcuffs also vary per-verse (a
  // verse over HANDCUFFS_WORD_THRESHOLD words gets an 8-round curve and a
  // 4th gear piece, and over LEGCUFFS_WORD_THRESHOLD a 10-round curve and a
  // 5th, instead of the base 6-round/3-piece one) - see that function's own
  // comments for the derivation.
  const roundCurve = useMemo(() => (verseText ? buildRoundCurve(verseText) : null), [verseText]);
  // Which gear pieces THIS battle actually tracks, in order - the base 3
  // plus 'handcuffs'/'legcuffs' when the verse qualifies. Falls back to the
  // base-3 order before verseText/roundCurve are ready (mirrors
  // GEAR_PIECE_COUNT's old always-3 assumption for that brief pre-fetch
  // window).
  const gearPieceOrder = useMemo(
    () => getGearPieceOrder(roundCurve?.includesHandcuffs ?? false, roundCurve?.includesLegcuffs ?? false),
    [roundCurve]
  );
  // See PROGRESS_SETBACK_AMOUNT's old comment above (GEAR_LEVELS block) -
  // both setbacks cost this same amount, derived from this verse's own
  // battleProgress rather than a fixed module constant now that the gain
  // varies with the round curve.
  const progressSetbackAmount = useMemo(
    () => (roundCurve ? roundCurve.battleProgress.correctAnswerGain * roundCurve.battleProgress.setbackRatio : 0),
    [roundCurve]
  );
  // TOTAL_TURNS_FOR_PERFECT_RUN (6, or 8 with handcuffs) already accounts
  // for the Silencer's own comeback: each round's correct answer removes 2
  // gear levels and the Silencer restores 1 back (a net -1/round) except
  // the final round, which skips the restore - see
  // config/silencerBattleRounds.ts's own comments for the full breakdown.
  // Every wrong answer, in turn, hands the Silencer one MORE (otherwise
  // unbudgeted) restore via applyGearRestore in submitAnswer's incorrect
  // branch below, so it pushes this same finish point one round further
  // out - keeping "when everything finishes" in lockstep with the
  // Silencer's actual comeback total instead of a budget that assumes a
  // clean run.
  const totalRoundsForFinish = (roundCurve?.totalTurnsForPerfectRun ?? TOTAL_TURNS_FOR_PERFECT_RUN) + totalWrongAnswers;
  const isFinalRound = roundNumber === totalRoundsForFinish - 1;

  const challengeVariant = roundVisitCounts[roundNumber] ?? 0;
  const currentRound = useMemo(
    () => (roundCurve ? roundCurve.getRoundConfig(roundNumber, challengeVariant, extraRounds) : null),
    [roundCurve, roundNumber, challengeVariant, extraRounds]
  );
  // Mirrored for handleReSilenceEffectStart, which - like the other avatar
  // callbacks - has empty deps and reads current values via refs rather than
  // a closure captured however many renders ago the timeline was kicked off.
  const currentRoundTierRef = useRef(currentRound?.tier);
  useEffect(() => {
    currentRoundTierRef.current = currentRound?.tier;
  }, [currentRound]);

  // Gloo-generated wrong-answer options for WORD_BANK/DROPDOWN rounds, for
  // every language including English - grounds the wrong answers in THIS
  // verse's actual wording instead of a fixed hardcoded set. Keyed by
  // `${language}:${word.toLowerCase()}` so a repeated word across rounds (or
  // a retried variant) reuses one Gloo call instead of firing a fresh one
  // every time. The cache itself lives in services/distractorService.ts (not
  // a local ref), read synchronously inside distractorLookup.forWord below
  // at whatever moment `challenge` happens to compute.
  //
  // There is NO upfront/whole-curve prefetch anymore - the very first round
  // a battle needs (round 0) always uses the instant, zero-dependency
  // buildFallbackDistractors below (there's nothing to have prefetched yet).
  // Every round AFTER that gets its distractors prefetched by the response-
  // choices effect further down, once THIS round's response-choices Gloo
  // call finishes - deliberately sequenced (not concurrent) so distractor
  // fetching and response-choices generation never compete for the same
  // Gloo capacity at the same time. See that effect for where this actually
  // gets kicked off.

  // Last-resort fallback (no cached/fresh Gloo result yet) borrows other
  // real, significant words already present in THIS verse instead of any
  // hardcoded vocabulary - works identically regardless of language/script,
  // and is always instantly available (see buildFallbackDistractors).
  const distractorLookup: DistractorLookup = useMemo(() => {
    const words = verseText ? tokenizeVerseWords(verseText) : [];
    return {
      forWord: (answer: string) => {
        if (bibleLanguage) {
          const cached = getCachedDistractors(bibleLanguage, answer);
          if (cached) return cached;
        }
        return buildFallbackDistractors(words, answer, 3);
      },
    };
  }, [bibleLanguage, verseText]);

  const challenge: Challenge | null = useMemo(
    () =>
      currentRound && verseText
        ? generateChallenge(
            verseText,
            activeVerseReference,
            currentRound.blankWordIndices,
            currentRound.challengeType,
            distractorLookup
          )
        : null,
    [currentRound, verseText, distractorLookup, activeVerseReference]
  );
  // Prefers the fresh, tone-specific Silencer rebuttal resolved in
  // selectResponse below (see services/responseChoicesService.ts); falls
  // back to the static per-tier line if that tone's rebuttal never arrived.
  const temptationLine = freshTemptationLine ?? currentRound?.temptationLine ?? '';
  const isReviewingMistake = phase === 'CHALLENGE' && wrongBlanks.length > 0;
  // Looks up against whichever options were actually shown on CHOICE (fresh
  // or fallback) - selectedTone was picked from that exact set.
  const chosenMessage = (responseOptions ?? SILENCER_BATTLE_RESPONSES).find((r) => r.tone === selectedTone)?.message;

  // A fresh round should never start with the previous round's leftover
  // text. Only fires when `challenge` actually gets a new reference (a real
  // round change) - a first wrong-answer retry on the SAME round leaves
  // `currentRound`/`challenge` referentially stable, so whatever the player
  // already typed stays put for them to fix instead of being wiped. Adjusting
  // state during render (guarded by comparing against a mirrored previous
  // value) rather than in an effect avoids an extra commit.
  const [prevChallenge, setPrevChallenge] = useState<Challenge | null>(null);
  if (challenge !== prevChallenge) {
    setPrevChallenge(challenge);
    setAnswers(challenge ? Array(challenge.blankCount).fill('') : []);
    // A fresh challenge invalidates any in-progress Hint targeting or stale
    // Check result from the previous round - Shield/Hush Silencer are
    // untouched here since they're meant to carry over across challenges.
    setHintArmed(false);
    setHintGlowWord(null);
    setHintInvalidClickMessage(null);
    setCheckHighlightBlanks([]);
    setCheckMessage(null);
  }

  const goToRound = useCallback((newRoundNumber: number) => {
    setRoundNumber(newRoundNumber);
    setRoundVisitCounts((prev) => ({ ...prev, [newRoundNumber]: (prev[newRoundNumber] ?? -1) + 1 }));
  }, []);

  const startBattle = useCallback(async () => {
    setPhase('LOADING');
    addLog('Initiating restoration ritual against the Silencer...', 'battle');

    let text = SILENCER_BATTLE_FALLBACK_VERSE_TEXT;
    let error: string | null = null;
    try {
      // bibleVersionId comes from the player's settings (GameContext, sourced
      // from their onboarding choice) - omitted (undefined) falls through to
      // the /api/scripture route's own default translation if the player
      // hasn't set one yet.
      const verse = await getVerse(activeVerseReference, bibleVersionId ?? undefined);
      text = verse.text;
    } catch {
      error = 'Could not reach the Scripture archive - continuing with a saved copy of the verse.';
    }

    setVerseText(text);
    setVerseError(error);
    // Dev cheat (see debugRoundRef's own comment) - one-shot, so it only
    // ever redirects the very first startBattle() call this mount makes.
    if (debugRoundRef.current !== null) {
      const targetRound = Math.max(0, debugRoundRef.current - 1);
      setRoundNumber(targetRound);
      setRoundVisitCounts({ [targetRound]: 0 });
      debugRoundRef.current = null;
    } else {
      setRoundNumber(0);
      setRoundVisitCounts({ 0: 0 });
    }
    setExtraRounds(NO_EXTRA_ROUNDS);
    setWrongStreak(0);
    setTotalWrongAnswers(0);
    setWrongBlanks([]);
    // roundCurve/gearPieceOrder (the memoized ones above) are still stale
    // here - verseText's setter above won't re-render until after this
    // callback returns - so this battle's actual gear-piece count is worked
    // out fresh from `text` directly, the same way roundCurve itself will be
    // once the render catches up.
    const freshCurve = buildRoundCurve(text);
    const freshGearPieceOrder = getGearPieceOrder(freshCurve.includesHandcuffs, freshCurve.includesLegcuffs);
    setGearPieces(Array(freshGearPieceOrder.length).fill('ON'));
    setProgressScore(0);
    setSelectedTone(null);
    responseGenerationIdRef.current += 1;
    prefetchedRoundRef.current = null;
    responseSettledRef.current = false;
    responseGearKeyRef.current = null;
    responseFetchStartedAtRef.current = 0;
    setResponseOptions(null);
    setChoiceReactions(null);
    setChoiceRebuttals(null);
    setResponsesLoading(false);
    setFreshTemptationLine(null);
    resilenceThoughtGenerationIdRef.current += 1;
    setFreshResilenceThought(null);
    wrongAnswerGenerationIdRef.current += 1;
    setFreshWrongAnswerMoment(null);
    setWrongAnswerLine(null);
    setShowWrongAnswerLine(false);
    setThoughtBubbleContent(null);
    setThoughtBubbleVisible(false);
    setShowTemptationLine(false);
    setShowChosenLine(false);
    setShowRestoredBanner(false);
    setActivePowerUps({ SHIELD: 0, HUSH_SILENCER: 0 });
    setHintArmed(false);
    setHintGlowWord(null);
    setHintInvalidClickMessage(null);
    setCheckHighlightBlanks([]);
    setCheckMessage(null);
    setShieldPopupVisible(false);
    setPhase('CHALLENGE');
  }, [bibleVersionId, activeVerseReference]);

  // Normally the exploration walker spawns at EXPLORATION_PLAYER_SPAWN, but
  // ChestReturnScene's left-edge transition sets pendingBattleSpawn first so
  // the player instead lands on this scene's right edge, continuing the same
  // walk. Captured once in a ref (usePlayerWalker only reads its
  // initialPosition on this mount) and cleared right away so a later,
  // unrelated re-entry into BATTLE doesn't reuse a stale spawn.
  const initialExplorationSpawnRef = useRef<Position>(pendingBattleSpawn ?? EXPLORATION_PLAYER_SPAWN);
  useEffect(() => {
    if (pendingBattleSpawn) setPendingBattleSpawn(null);
    if (pendingBattleSkipToRestored) setPendingBattleSkipToRestored(false);
    if (pendingBattleDebugRound !== null) {
      setPendingBattleDebugRound(null);
      // phase already seeded to 'LOADING' above (skipping EXPLORING/INTRO
      // entirely) - kick off the real verse fetch immediately instead of
      // waiting for confirmRestore(), which never fires here since there's
      // no walk-up. startBattle() itself reads debugRoundRef to land on the
      // requested round once that fetch resolves.
      startBattle();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 🚶 Exploration walker for the EXPLORING phase's zoomed-out approach view -
  // reuses the same shared walking mechanics as the overworld quest maps
  // (see hooks/usePlayerWalker.ts): free movement (no waypoints) within the
  // scene's own canvas bounds, since this is an open approach shot, not a
  // traced path.
  const exploration = usePlayerWalker({
    initialPosition: initialExplorationSpawnRef.current,
    speed: EXPLORATION_PLAYER_SPEED,
    bounds: EXPLORATION_CANVAS_BOUNDS,
    enabled: phase === 'EXPLORING',
  });

  // Restore prompt shows once the player is close enough to the silenced
  // Songbeast+Silencer preview (see config/battleApproach.ts for the
  // distance) - hides again if they walk away, since both directions are
  // driven by this same live distance check. Measured against the
  // Songbeast's own visual CENTER (SILENCED_PREVIEW_CENTER), not its
  // bottom-left placement anchor - centering on the anchor corner reads as
  // noticeably off from the Songbeast itself once its box is large enough
  // to matter.
  const distanceToSongbeast = Math.hypot(
    exploration.position.x - SILENCED_PREVIEW_CENTER.x,
    exploration.position.y - SILENCED_PREVIEW_CENTER.y
  );
  const showRestorePrompt = phase === 'EXPLORING' && distanceToSongbeast <= PROXIMITY_TRIGGER_DISTANCE;

  // Fired when the player confirms the Restore prompt - plays the INTRO
  // cinematic (the scene component cross-fades/scales the two backgrounds
  // based on this phase change), holds for the configured settle delay,
  // then hands off to the existing startBattle() verse-fetch/CHALLENGE flow
  // completely unchanged.
  const confirmRestore = useCallback(() => {
    if (phase !== 'EXPLORING') return;
    setPhase('INTRO');
    schedule(() => {
      startBattle();
    }, INTRO_TRANSITION_DURATION_MS + INTRO_TO_CHALLENGE_DELAY_MS);
  }, [phase, schedule, startBattle]);

  const setAnswer = useCallback((blankIndex: number, value: string) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[blankIndex] = value;
      return next;
    });
    setWrongBlanks((prev) => prev.filter((i) => i !== blankIndex));
    setCheckHighlightBlanks((prev) => prev.filter((i) => i !== blankIndex));
  }, []);

  // Shared by a real correct submission and Free Pass's instant "auto-
  // complete as correct" - see activateFreePass below. No response-choice
  // kick-off here - see the prefetch effect below, which starts that
  // generation as soon as the CHALLENGE targeting this same gear piece first
  // appears, well before the player even answers. By the time a correct
  // answer lands here, it's usually already resolved (or resolving) rather
  // than starting from zero. The Silencer's RESILENCE-beat comeback line is
  // prefetched right along with it (one per tone, in that same call) - see
  // selectResponse below for where the matching one is picked out once the
  // player's actual tone is known.
  const handleCorrectAnswer = useCallback(() => {
    setGearPieces((prev) => applyGearCascade(prev, 2));
    addLog('Correct!', 'battle');
    setPhase('CORRECT');

    // If this round's response-choices call hasn't resolved yet, it was
    // never cut off while the player was still solving (see the prefetch
    // effect below) - this is the only deadline that applies, and only now
    // that they're actually waiting on the result. Waits at least
    // RESPONSE_SUBMIT_GRACE_MS from right now, but never lets the TOTAL time
    // since the fetch started fall below MIN_TOTAL_RESPONSE_WAIT_MS either -
    // otherwise a very fast solve (e.g. 2s) would only give Gloo 2s + grace,
    // less room than the old fixed timeout ever gave it.
    if (!responseSettledRef.current) {
      const generationId = responseGenerationIdRef.current;
      const elapsedSinceFetchStart = Date.now() - responseFetchStartedAtRef.current;
      const delay = Math.max(RESPONSE_SUBMIT_GRACE_MS, MIN_TOTAL_RESPONSE_WAIT_MS - elapsedSinceFetchStart);
      schedule(() => {
        if (responseSettledRef.current) return; // resolved for real in the meantime
        if (responseGenerationIdRef.current !== generationId) return; // a later round already moved on
        const gearKey = responseGearKeyRef.current ?? gearPieceOrder[0];
        const fallback = getStaticResponseChoicesFallback(GEAR_PIECE_INFO[gearKey], activeLanguageName);
        setResponseOptions(fallback.options);
        setChoiceReactions(fallback.reactions);
        setChoiceRebuttals(fallback.rebuttals ?? null);
        setResponsesLoading(false);
        responseSettledRef.current = true;
        responseGenerationIdRef.current += 1; // invalidate the still-pending original fetch
      }, delay);
    }
  }, [schedule, activeLanguageName, gearPieceOrder]);

  const submitAnswer = useCallback(() => {
    if (phase !== 'CHALLENGE' || !challenge || wrongBlanks.length > 0) return;

    const result = checkAnswers(challenge, answers);
    if (!result.correct) {
      triggerShake();

      // An active Shield fully absorbs the miss - same round, fresh and
      // editable again (no red review beat, no streak/rollback tracking, no
      // gear/progress change, no Silencer turn) once the "Good Try" banner
      // clears. Only the "Shield activated" popup marks that anything
      // happened. wrongBlanks is deliberately left untouched (not set) so
      // the generic mistake-review effect below never fires for this path.
      if (activePowerUps.SHIELD > 0) {
        setActivePowerUps((prev) => ({ ...prev, SHIELD: prev.SHIELD - 1 }));
        addLog('Shield absorbed the wrong answer.', 'battle');
        setPhase('INCORRECT');
        schedule(() => setShieldPopupVisible(true), INCORRECT_BANNER_HOLD_MS);
        schedule(() => setShieldPopupVisible(false), INCORRECT_BANNER_HOLD_MS + 1200);
        return;
      }

      setWrongBlanks(result.wrongBlankIndices);
      setWrongStreak((s) => s + 1);
      setTotalWrongAnswers((n) => n + 1);
      missedChallengeTypeRef.current = challenge.type;
      setGearPieces((prev) => applyGearRestore(prev, 1));
      addLog('Incorrect answer - those words did not match the verse.', 'battle');
      setPhase('INCORRECT');

      // Kick off the Silencer's gloating line and the Songbeast's doubtful
      // reply now, in the background, so both are ready well before the
      // SILENCER_TURN beat needs them (see handleReSilenceEffectStart) -
      // referencing whichever gear piece this restore is about to affect,
      // the same target-finding the correct-answer path uses for its own
      // comeback line. Skipped if there's nothing to restore yet (the very
      // first question missed before any gear has come off) - nothing for
      // either line to reference.
      const wrongAnswerRestoreIndex = findGearRestoreTargetIndex(gearPieces);
      if (wrongAnswerRestoreIndex !== -1) {
        const wrongAnswerGearKey = gearPieceOrder[wrongAnswerRestoreIndex];
        const fallbackLine = currentRound ? SILENCER_BATTLE_WRONG_ANSWER_LINES[currentRound.tier] : '';
        const fallbackThought = currentRound ? SILENCER_BATTLE_WRONG_ANSWER_THOUGHTS[currentRound.tier] : '';
        const wrongAnswerGenerationId = ++wrongAnswerGenerationIdRef.current;
        setFreshWrongAnswerMoment(null);
        getFreshWrongAnswerMoment(GEAR_PIECE_INFO[wrongAnswerGearKey], fallbackLine, fallbackThought, activeLanguageName).then((moment) => {
          if (wrongAnswerGenerationIdRef.current !== wrongAnswerGenerationId) return; // a later miss/round already started
          setFreshWrongAnswerMoment(moment);
        });
      }
      return;
    }

    handleCorrectAnswer();
  }, [phase, challenge, answers, wrongBlanks, gearPieces, triggerShake, activePowerUps, schedule, handleCorrectAnswer, activeLanguageName, gearPieceOrder]);

  // Only activatable while an editable challenge is actually showing - not
  // during the read-only mistake-review beat (wrongBlanks.length > 0), which
  // is still technically phase CHALLENGE.
  const canActivatePowerUp = phase === 'CHALLENGE' && !!challenge && wrongBlanks.length === 0;

  // Free Pass - fires instantly: decrements, then runs the exact same
  // correct-answer flow a real submission would (see handleCorrectAnswer).
  // Never enters activePowerUps - there's nothing to show in the banner for
  // an instantaneous effect.
  const activateFreePass = useCallback(() => {
    if (!canActivatePowerUp || powerUps.FREE_PASS < 1) return;
    setPowerUps((prev) => ({ ...prev, FREE_PASS: prev.FREE_PASS - 1 }));
    handleCorrectAnswer();
  }, [canActivatePowerUp, powerUps, setPowerUps, handleCorrectAnswer]);

  // Shield/Hush Silencer - decrement the purchased count immediately and add
  // to the battle-scoped active count; both linger until consumed (see
  // submitAnswer's Shield branch and handleGearRemoved's Hush Silencer branch).
  const activateShield = useCallback(() => {
    if (!canActivatePowerUp || powerUps.SHIELD < 1) return;
    setPowerUps((prev) => ({ ...prev, SHIELD: prev.SHIELD - 1 }));
    setActivePowerUps((prev) => ({ ...prev, SHIELD: prev.SHIELD + 1 }));
  }, [canActivatePowerUp, powerUps, setPowerUps]);

  const activateHushSilencer = useCallback(() => {
    if (!canActivatePowerUp || powerUps.HUSH_SILENCER < 1) return;
    setPowerUps((prev) => ({ ...prev, HUSH_SILENCER: prev.HUSH_SILENCER - 1 }));
    setActivePowerUps((prev) => ({ ...prev, HUSH_SILENCER: prev.HUSH_SILENCER + 1 }));
  }, [canActivatePowerUp, powerUps, setPowerUps]);

  // Check - activates immediately, reusable repeatedly, never lingers. Red-
  // highlights whichever blanks are currently wrong without submitting,
  // penalizing, or locking the parchment.
  const activateCheck = useCallback(() => {
    if (!canActivatePowerUp || !challenge || powerUps.CHECK < 1) return;
    const result = checkAnswers(challenge, answers);
    setPowerUps((prev) => ({ ...prev, CHECK: prev.CHECK - 1 }));
    setCheckHighlightBlanks(result.wrongBlankIndices);
    setCheckMessage(result.correct ? 'Everything is correct ✅' : 'Something is wrong ❌');
  }, [canActivatePowerUp, challenge, answers, powerUps, setPowerUps]);

  // Hint only arms here - see handleHintBlankClick/confirmWholeVerseHint
  // below for where it actually decrements and fires, per the per-challenge-
  // type rules in the design doc.
  const activateHint = useCallback(() => {
    if (!canActivatePowerUp || powerUps.HINT < 1) return;
    setHintInvalidClickMessage(null);
    setHintArmed(true);
  }, [canActivatePowerUp, powerUps]);

  // Persistent instructional prompt shown for the whole time Hint is armed -
  // WHOLE_VERSE gets its own dedicated "This hint fills in the next word."
  // prompt inside VerseParchment instead (there's no individual blank to
  // click there), so this only applies to the other types. Derived rather
  // than stored so it never goes stale and automatically reappears once
  // hintInvalidClickMessage's transient override clears (see hintMessage below).
  const hintTargetPrompt =
    hintArmed && challenge && challenge.type !== 'WHOLE_VERSE' ? 'Click on a blank to reveal its answer!' : null;
  const hintMessage = hintInvalidClickMessage ?? hintTargetPrompt;

  // Fired by VerseParchment when the player clicks a blank while Hint is
  // armed, for every challenge type except WHOLE_VERSE (which has no
  // individual blanks to click - see confirmWholeVerseHint instead). An
  // already-answered blank is invalid: shows a transient message and leaves
  // the Hint armed/unconsumed.
  const handleHintBlankClick = useCallback(
    (blankIndex: number) => {
      if (!hintArmed || !challenge) return;
      const alreadyAnswered = (answers[blankIndex] ?? '').trim() !== '';
      if (alreadyAnswered) {
        setHintInvalidClickMessage('Click on a valid blank!');
        schedule(() => setHintInvalidClickMessage(null), 2000);
        return;
      }
      const blank = challenge.segments.find(
        (s): s is Extract<ChallengeSegment, { kind: 'blank' }> => s.kind === 'blank' && s.blankIndex === blankIndex
      );
      if (!blank) return;

      setPowerUps((prev) => ({ ...prev, HINT: prev.HINT - 1 }));
      setHintArmed(false);
      if (challenge.type === 'WORD_BANK') {
        setHintGlowWord(blank.answer);
      } else {
        setAnswer(blankIndex, blank.answer);
      }
    },
    [hintArmed, challenge, answers, schedule, setPowerUps, setAnswer]
  );

  // WHOLE_VERSE's Hint fires on Continue, not on menu selection - fills the
  // word at the position immediately after however many whitespace-separated
  // words are already in the box (an empty box fills word #1), keyed off
  // word count/position rather than what the player actually typed there.
  const confirmWholeVerseHint = useCallback(() => {
    if (!hintArmed || !challenge || challenge.type !== 'WHOLE_VERSE') return;
    const current = answers[0] ?? '';
    const typedWordCount = current.split(/\s+/).filter(Boolean).length;
    const verseWords = tokenizeVerseWords(verseText);
    const nextWord = verseWords[typedWordCount]?.value;
    if (nextWord === undefined) {
      setHintArmed(false);
      return;
    }
    const separator = current.length === 0 || /\s$/.test(current) ? '' : ' ';
    setPowerUps((prev) => ({ ...prev, HINT: prev.HINT - 1 }));
    setHintArmed(false);
    setAnswer(0, `${current}${separator}${nextWord}`);
  }, [hintArmed, challenge, answers, verseText, setPowerUps, setAnswer]);

  const activatePowerUp = useCallback(
    (type: PowerUpType) => {
      if (type === 'HINT') return activateHint();
      if (type === 'FREE_PASS') return activateFreePass();
      if (type === 'SHIELD') return activateShield();
      if (type === 'HUSH_SILENCER') return activateHushSilencer();
      if (type === 'CHECK') return activateCheck();
    },
    [activateHint, activateFreePass, activateShield, activateHushSilencer, activateCheck]
  );

  const selectResponse = useCallback((tone: ResponseTone) => {
    setSelectedTone(tone);
    // Captured once, right when the beat's data is picked - see
    // thoughtBubbleContent's declaration for why this isn't derived live.
    const reaction = (choiceReactionsRef.current ?? SILENCER_BATTLE_CHOICE_THOUGHTS)[tone];
    setThoughtBubbleContent({ text: reaction, beat: 'CHOICE' });
    setPhase((prev) => (prev === 'CHOICE' ? 'GEAR_REMOVED' : prev));

    // Resolves the Silencer's RESILENCE-beat comeback now that the player's
    // actual tone is known - the tone-keyed rebuttal generated alongside the
    // response choices themselves (see services/responseChoicesService.ts),
    // so the Silencer's re-silence taunt always answers what the player
    // actually just said, not an independent guess made before the pick.
    // Skipped on the final round: there's no comeback to narrate,
    // finalRestoration() plays instead.
    if (!isFinalRound) {
      // Same headphones+Chinese special case as the CHOICE-beat reaction
      // above, and for the same reason: the generic SILENCER_BATTLE_
      // RESILENCE_THOUGHTS fallback is English and tier-keyed, so it would
      // jarringly mix languages if this round's response-choices call
      // (which IS already using the Chinese headphones fallback - see
      // choiceReactionsRef above) fell through to it instead.
      const usingZhHeadphonesFallback =
        responseGearKeyRef.current === 'headphones' && activeLanguageName === LANGUAGE_NAMES.zh;
      const fallbackThought = usingZhHeadphonesFallback
        ? SILENCER_BATTLE_RESILENCE_THOUGHTS_ZH_HEADPHONES[tone]
        : currentRound
        ? SILENCER_BATTLE_RESILENCE_THOUGHTS[currentRound.tier]
        : '';
      const rebuttal = choiceRebuttalsRef.current?.[tone] ?? null;
      const line = rebuttal ?? currentRound?.temptationLine ?? '';
      setFreshTemptationLine(rebuttal);
      setFreshResilenceThought(null);
      const resilenceThoughtId = ++resilenceThoughtGenerationIdRef.current;
      getFreshResilenceThought(line, fallbackThought, activeLanguageName).then((thought) => {
        if (resilenceThoughtGenerationIdRef.current !== resilenceThoughtId) return; // a later round already started
        setFreshResilenceThought(thought);
      });
    }
  }, [isFinalRound, currentRound, activeLanguageName]);

  // Fired by the avatar the instant its removed gear item actually lands mid-
  // sequence - the chosen-response caption's (and paired thought bubble's)
  // cue to disappear. thoughtBubbleContent itself is left untouched so the
  // bubble's own exit transition still has real text to fade out, rather
  // than instantly going blank - see thoughtBubbleContent's declaration.
  const handleGearLanded = useCallback(() => {
    setShowChosenLine(false);
    setThoughtBubbleVisible(false);
  }, []);

  // Fired by the avatar once the gear-removal cascade's own timeline
  // completes - the Silencer's re-silence beat is up next. The avatar chains
  // straight into its own re-silence (or, on the final round, full
  // restoration) animation without any further trigger from here.
  //
  // The Silencer restores 1 of the 2 levels just removed - the freed piece
  // only goes HALF_ON, not back to fully ON, so progress is a net step
  // forward despite the setback. This is what the avatar's setback() diffs
  // against to know what to visually restore; skipping it left nothing for
  // that animation to do, so it completed almost instantly instead of
  // playing its restore beat. Skipped entirely on the final round - "3 gear
  // items all hit off" plays finalRestoration() instead, with no comeback.
  const handleGearRemoved = useCallback(() => {
    // A full gain for clearing the challenge - applied now, once the gear-
    // removal cascade animation has actually finished playing, rather than
    // the instant the correct answer was submitted (well before the player
    // even sees any gear move). Unconditional - this happens on the final
    // round too, which is what lands the bar at exactly 100%. The re-
    // silence dip that usually follows is applied separately, in
    // handleSilencerTurnComplete, once THAT animation likewise finishes.
    setProgressScore((prev) => clampProgress(prev + (roundCurve?.battleProgress.correctAnswerGain ?? 0)));
    // Hush Silencer blocks the whole re-silence beat, not just this gear
    // restore - see skipReSilence/onReSilenceBlocked below, which tell the
    // avatar to skip its setback() animation entirely instead of playing it
    // with nothing to show. Reading activePowerUps here (rather than only in
    // the avatar) keeps the gear-state decision and the "does the animation
    // play" decision looking at the exact same value at the exact same
    // synchronous moment - no race between the two.
    if (!isFinalRound && activePowerUps.HUSH_SILENCER === 0) {
      setGearPieces((prev) => applyGearRestore(prev, 1));
    }
    setPhase((prev) => (prev === 'GEAR_REMOVED' ? 'RESILENCE' : prev));
  }, [isFinalRound, activePowerUps, roundCurve]);

  // Fired by the avatar INSTEAD of ever calling setback() (see
  // skipReSilence/onReSilenceBlocked passed to SongbeastBattleAvatar), when a
  // Hush Silencer was active for this correct answer's turn - handleGearRemoved
  // above already skipped the gear restore, so this only needs to do the
  // matching bookkeeping handleSilencerTurnComplete would otherwise have done
  // (minus the progress dip, since no re-silence actually happened) and move
  // on to the next round after the same pacing delay the real beat would use.
  const handleReSilenceBlocked = useCallback(() => {
    setActivePowerUps((prev) => ({ ...prev, HUSH_SILENCER: prev.HUSH_SILENCER - 1 }));
    addLog('Hush Silencer blocked the re-silence.', 'battle');
    schedule(() => {
      setWrongStreak(0);
      setSelectedTone(null);
      goToRound(roundNumberRef.current + 1);
      setPhase('CHALLENGE');
    }, POST_SILENCER_PARCHMENT_DELAY_MS);
  }, [schedule, goToRound]);

  // Fired by the avatar the instant its re-silence animation begins - covers
  // both the correct-path chain (phase is RESILENCE) and the isolated
  // wrong-answer turn (phase is SILENCER_TURN). Both now show a Silencer
  // caption + Songbeast thought bubble; the wrong-answer one's just react to
  // the miss itself rather than the correct-answer comeback, layered on top
  // of the "Good Try" banner it already got.
  const handleReSilenceEffectStart = useCallback(() => {
    if (phaseRef.current === 'RESILENCE') {
      setShowTemptationLine(true);
      // Snapshot whatever's available right now (generated, if it landed in
      // time; otherwise the typed per-tier fallback) and hold it for the rest
      // of this beat - see thoughtBubbleContent's declaration for why this
      // isn't derived live from freshResilenceThought.
      const tier = currentRoundTierRef.current;
      const thought = freshResilenceThoughtRef.current ?? (tier ? SILENCER_BATTLE_RESILENCE_THOUGHTS[tier] : null);
      if (thought) setThoughtBubbleContent({ text: thought, beat: 'RESILENCE' });
      setThoughtBubbleVisible(true);
    } else if (phaseRef.current === 'SILENCER_TURN') {
      // Same snapshot-once reasoning as the RESILENCE branch above, just
      // sourced from freshWrongAnswerMoment/SILENCER_BATTLE_WRONG_ANSWER_*
      // instead - kept as fully separate state from the RESILENCE beat's own
      // (untouched) caption/thought so neither beat's behavior leaks into
      // the other's.
      const tier = currentRoundTierRef.current;
      const moment = freshWrongAnswerMomentRef.current;
      const line = moment?.line ?? (tier ? SILENCER_BATTLE_WRONG_ANSWER_LINES[tier] : null);
      const thought = moment?.thought ?? (tier ? SILENCER_BATTLE_WRONG_ANSWER_THOUGHTS[tier] : null);
      setWrongAnswerLine(line);
      setShowWrongAnswerLine(true);
      if (thought) setThoughtBubbleContent({ text: thought, beat: 'WRONG_ANSWER' });
      setThoughtBubbleVisible(true);
    }
  }, []);

  // Fired by the avatar once its re-silence animation's timeline completes -
  // covers both branches above.
  const handleSilencerTurnComplete = useCallback(() => {
    if (phaseRef.current === 'RESILENCE') {
      // The bar dips at re-silence too - the setback still happens, so the
      // bar must still visibly drop - applied now that the re-silence
      // comeback animation has actually finished, at exactly half a
      // correct-answer gain (same amount as the wrong-answer dip below).
      // This branch only ever runs on non-final rounds (the final round
      // plays finalRestoration() instead of setback(), which fires
      // handleFinalRestorationComplete, not this), so no isFinalRound guard
      // is needed here the way handleGearRemoved needs one for the gear. Also
      // never runs when Hush Silencer is active - the avatar calls
      // onReSilenceBlocked instead of ever playing setback() in that case
      // (see handleReSilenceBlocked above), so this whole branch only fires
      // for a real re-silence.
      setProgressScore((prev) => clampProgress(prev - progressSetbackAmount));
      setShowTemptationLine(false);
      setThoughtBubbleVisible(false);
      schedule(() => {
        setWrongStreak(0);
        setSelectedTone(null);
        goToRound(roundNumberRef.current + 1);
        setPhase('CHALLENGE');
      }, POST_SILENCER_PARCHMENT_DELAY_MS);
      return;
    }

    // Wrong-answer path: a first miss on this round retries the exact same
    // challenge - round/variant untouched, so nothing wipes whatever the
    // player already typed. Only a SECOND consecutive miss on the same round
    // rolls the difficulty back one tier (floored at 0).
    //
    // Progress setback already exists in the game (gear comes back on) - the
    // bar must reflect it too, at exactly half a correct-answer gain, same
    // as the re-silence dip above - applied now that the Silencer's isolated
    // re-silence turn has actually finished playing, not the instant the
    // wrong answer was submitted.
    setProgressScore((prev) => clampProgress(prev - progressSetbackAmount));
    setShowWrongAnswerLine(false);
    setThoughtBubbleVisible(false);
    schedule(() => {
      setWrongBlanks([]);
      if (wrongStreakRef.current >= 2) {
        setWrongStreak(0);
        const target = Math.max(0, roundNumberRef.current - 1);
        if (target !== roundNumberRef.current) {
          const key = missedChallengeTypeRef.current && extraRoundsKeyFor(missedChallengeTypeRef.current);
          if (key) setExtraRounds((e) => ({ ...e, [key]: e[key] + 1 }));
        }
        goToRound(target);
      }
      setPhase('CHALLENGE');
    }, POST_SILENCER_PARCHMENT_DELAY_MS);
  }, [schedule, goToRound, progressSetbackAmount]);

  // Fired by the avatar once its (rare, full-restore) victory animation
  // finishes - the golden flash/sprite swap/Silencer fade-out has already
  // played out by the time this fires.
  const handleFinalRestorationComplete = useCallback(() => {
    setShowTemptationLine(false);
    setThoughtBubbleVisible(false);
    setPhase((prev) => (prev === 'RESILENCE' ? 'RESTORED' : prev));
  }, []);

  // Fired by useSongbeastDebriefDialogue once its final scripted line is
  // dismissed - shows the "Mission Complete!" banner + corner Continue
  // button (see components/battle/MissionCompleteButton.tsx) rather than
  // jumping straight back to the map, so the player gets a deliberate closing
  // beat instead of the screen changing out from under their last click.
  const finishDialogue = useCallback(() => {
    setPhase((prev) => (prev === 'DIALOGUE' ? 'MISSION_COMPLETE' : prev));
  }, []);

  const returnToMap = useCallback(() => {
    setPhase('COMPLETE');
    setCurrentScreen('OVERWORLD');
  }, [setCurrentScreen]);

  // Prefetches the CHOICE screen's response lines + Songbeast reactions +
  // Silencer rebuttals as soon as a challenge for a new round is actually on
  // screen - not after the player answers it. Which piece is targeted is
  // already fully determined by the CURRENT gearPieces (the first
  // not-yet-REMOVED one), so there's no need to wait for a correct answer to
  // know it. In the common case the player spends several seconds solving the
  // challenge itself, which is usually enough time for this to finish well
  // before submitAnswer's correct branch would otherwise have kicked it off -
  // hiding Gloo's own latency behind that thinking time instead of adding to
  // it. Deduped on currentRound's own object reference (prefetchedRoundRef),
  // NOT on the targeted gear key - a rollback can send a later, genuinely
  // different round back to the SAME gear piece (e.g. a repeat pass at
  // headphones), and that still needs freshly generated lines rather than
  // silently reusing the earlier round's, which keying on gear key alone
  // would have skipped. Needs verseText (already resolved by the time phase
  // is CHALLENGE - see startBattle) so the lines can be grounded in this
  // battle's actual verse.
  useEffect(() => {
    if (phase !== 'CHALLENGE' || !verseText || !currentRound) return;
    if (
      prefetchedRoundRef.current?.round === currentRound &&
      prefetchedRoundRef.current?.language === activeLanguageName
    ) {
      return;
    }
    prefetchedRoundRef.current = { round: currentRound, language: activeLanguageName };
    const targetIndex = gearPieces.findIndex((p) => p !== 'REMOVED');
    const gearKey = gearPieceOrder[targetIndex === -1 ? gearPieceOrder.length - 1 : targetIndex];
    responseGearKeyRef.current = gearKey;
    responseSettledRef.current = false;
    responseFetchStartedAtRef.current = Date.now();

    const generationId = ++responseGenerationIdRef.current;
    setResponseOptions(null);
    setChoiceReactions(null);
    setChoiceRebuttals(null);
    setResponsesLoading(true);
    const currentVerseText = verseText;
    getFreshResponseChoices(GEAR_PIECE_INFO[gearKey], activeVerseReference, currentVerseText, activeLanguageName).then(
      ({ options, reactions, rebuttals }) => {
        if (responseGenerationIdRef.current === generationId) {
          setResponseOptions(options);
          setChoiceReactions(reactions);
          setChoiceRebuttals(rebuttals ?? null);
          setResponsesLoading(false);
          responseSettledRef.current = true;
        }

        // Only now that THIS round's response-choices Gloo call has
        // actually finished (a real result, or its own internal safety-net
        // fallback) do we start fetching the NEXT round's distractor words -
        // deliberately sequenced rather than concurrent, so distractor
        // fetching and response-choices generation never compete for the
        // same Gloo capacity at the same time. Uses this round's own
        // solve-time as the head start for the round after it; round 0 has
        // no such head start, so it always falls through to
        // buildFallbackDistractors instead (see distractorLookup below).
        if (roundCurve && bibleLanguage) {
          const nextRound = roundCurve.getRoundConfig(roundNumber + 1, 0, extraRounds);
          if (nextRound.challengeType === 'WORD_BANK' || nextRound.challengeType === 'DROPDOWN') {
            const nextLanguageName = LANGUAGE_NAMES[bibleLanguage] ?? bibleLanguage;
            const words = tokenizeVerseWords(currentVerseText);
            const neededWords = nextRound.blankWordIndices
              .map((idx) => words[idx]?.value)
              .filter((word): word is string => !!word);
            prefetchDistractors(neededWords, words, bibleLanguage, nextLanguageName, currentVerseText);
          }
        }
      }
    );
  }, [phase, gearPieces, verseText, currentRound, activeVerseReference, activeLanguageName, roundCurve, roundNumber, extraRounds, bibleLanguage, gearPieceOrder]);

  // CORRECT -> CHOICE: timed hold, not a user action.
  useEffect(() => {
    if (phase !== 'CORRECT') return;
    const id = setTimeout(() => setPhase((prev) => (prev === 'CORRECT' ? 'CHOICE' : prev)), CORRECT_BANNER_HOLD_MS);
    return () => clearTimeout(id);
  }, [phase]);

  // INCORRECT -> CHALLENGE (mistake review): timed hold.
  useEffect(() => {
    if (phase !== 'INCORRECT') return;
    const id = setTimeout(() => setPhase((prev) => (prev === 'INCORRECT' ? 'CHALLENGE' : prev)), INCORRECT_BANNER_HOLD_MS);
    return () => clearTimeout(id);
  }, [phase]);

  // Back on CHALLENGE with something highlighted is the mistake-review beat,
  // not a fresh attempt - hold briefly, then hand off to the Silencer instead
  // of letting the player retry immediately.
  useEffect(() => {
    if (phase !== 'CHALLENGE' || wrongBlanks.length === 0) return;
    const id = setTimeout(() => {
      setSilencerTurnRequestId((n) => n + 1);
      setPhase((prev) => (prev === 'CHALLENGE' ? 'SILENCER_TURN' : prev));
    }, MISTAKE_REVIEW_HOLD_MS);
    return () => clearTimeout(id);
  }, [phase, wrongBlanks]);

  // Player's restoration only begins once the choice has had its own beat -
  // the chosen-response caption comes on right as that animation starts.
  useEffect(() => {
    if (phase !== 'GEAR_REMOVED') return;
    const id = setTimeout(() => {
      setBattleTurnRequestId((n) => n + 1);
      setShowChosenLine(true);
      setThoughtBubbleVisible(true);
    }, CHOICE_TO_RESTORATION_DELAY_MS);
    return () => clearTimeout(id);
  }, [phase]);

  // RESTORED: hold on the restored creature alone for a beat, then show the
  // "Restored!" banner, then move on to DEBRIEF_PROMPT - which, unlike every
  // other timed transition in this file, does NOT itself auto-advance any
  // further. DEBRIEF_PROMPT holds until the player clicks the Continue
  // button (see beginDialogue below) before the darkened DIALOGUE sequence starts.
  useEffect(() => {
    if (phase !== 'RESTORED') return;
    // Battle end wipes all active power-up state - purchased counts (in
    // GameContext) are untouched, only this battle-scoped state resets.
    setActivePowerUps({ SHIELD: 0, HUSH_SILENCER: 0 });
    setHintArmed(false);
    setHintGlowWord(null);
    setHintInvalidClickMessage(null);
    setCheckHighlightBlanks([]);
    setCheckMessage(null);
    setShieldPopupVisible(false);
    const bannerTimer = setTimeout(() => setShowRestoredBanner(true), RESTORED_BANNER_DELAY_MS);
    const promptTimer = setTimeout(
      () => setPhase((prev) => (prev === 'RESTORED' ? 'DEBRIEF_PROMPT' : prev)),
      RESTORED_BANNER_DELAY_MS + DEBRIEF_HOLD_MS
    );
    return () => {
      clearTimeout(bannerTimer);
      clearTimeout(promptTimer);
    };
  }, [phase]);

  const beginDialogue = useCallback(() => {
    setPhase((prev) => (prev === 'DEBRIEF_PROMPT' ? 'DIALOGUE' : prev));
  }, []);

  // Writes the dialogue's cucumber gift to the player's existing GameContext
  // balance (context/GameContext.tsx) - called once, from
  // useSongbeastDebriefDialogue's acceptGift, when the player taps the
  // cucumber icon. No separate reward-granted ref needed here anymore - that
  // hook's own giftAccepted state already guards against a double-grant, and
  // resets itself every time DIALOGUE is (re-)entered.
  const grantCucumberGift = useCallback(
    (amount: number) => {
      setCucumbers((prev) => prev + amount);
      addLog(`The Songbeast gives you ${amount} cucumbers it grew in the garden before the silence came!`, 'songbeast');
    },
    [setCucumbers]
  );

  const {
    display: debriefDisplay,
    activeSpeaker: debriefActiveSpeaker,
    advance: advanceDialogue,
    acceptGift: acceptCucumberGift,
    choose: chooseDialogueResponse,
  } = useSongbeastDebriefDialogue({
    active: phase === 'DIALOGUE',
    grantCucumbers: grantCucumberGift,
    onComplete: finishDialogue,
  });

  return {
    phase,
    verseError,
    verseReference: activeVerseReference,
    zoomedOutBackground: battleTheme.zoomedOut,
    zoomedInBackground: battleTheme.zoomedIn,

    explorationPlayerPosition: exploration.position,
    explorationPlayerFacing: exploration.facing,
    startExplorationMove: exploration.startMove,
    stopExplorationMove: exploration.stopMove,
    showRestorePrompt,
    confirmRestore,

    challenge,
    answers,
    wrongBlanks,
    isReviewingMistake,
    setAnswer,
    submitAnswer,

    powerUps,
    activePowerUps,
    activatePowerUp,
    hintArmed,
    hintGlowWord,
    hintMessage,
    onHintBlankClick: handleHintBlankClick,
    onConfirmWholeVerseHint: confirmWholeVerseHint,
    checkHighlightBlanks,
    checkMessage,
    shieldPopupVisible,

    responses: responseOptions,
    responsesLoading,
    selectedTone,
    selectResponse,
    chosenMessage,

    gearPieces,
    // Whether THIS battle's verse qualified for the 4th gear piece
    // (handcuffs) - see config/silencerBattleRounds.ts's
    // HANDCUFFS_WORD_THRESHOLD. The avatar components only render the
    // handcuffs art/refs when this is true.
    includesHandcuffs: roundCurve?.includesHandcuffs ?? false,
    // Same, for the 5th gear piece (legcuffs) - see
    // LEGCUFFS_WORD_THRESHOLD. Implies includesHandcuffs above.
    includesLegcuffs: roundCurve?.includesLegcuffs ?? false,
    restorePercent,
    temptationLine,
    showTemptationLine,
    showChosenLine,
    showRestoredBanner,
    isFinalRound,
    silencerTurnRequestId,
    battleTurnRequestId,
    // Dev cheat (GameHeader.tsx) - tells SongbeastBattleAvatar to render
    // already in its restored form/pose on mount instead of playing the
    // usual gear-on idle + full-restoration animation.
    avatarStartsRestored: skipToRestoredRef.current,

    wrongAnswerLine,
    showWrongAnswerLine,

    thoughtBubbleText: thoughtBubbleContent?.text ?? null,
    thoughtBubbleVisible,
    thoughtBubbleBeat: thoughtBubbleContent?.beat ?? null,

    handleGearRemoved,
    handleGearLanded,
    handleReSilenceEffectStart,
    handleSilencerTurnComplete,
    handleFinalRestorationComplete,
    // Tells the avatar to skip its setback() re-silence animation entirely
    // (no arm swing, no dark wave, no taunt line) for the upcoming correct-
    // answer turn, and to call onReSilenceBlocked instead once the gear-
    // removal cascade finishes - see handleGearRemoved/handleReSilenceBlocked above.
    skipReSilence: activePowerUps.HUSH_SILENCER > 0,
    onReSilenceBlocked: handleReSilenceBlocked,

    roundNumber,
    totalRounds: totalRoundsForFinish,

    beginDialogue,
    debriefDisplay,
    debriefActiveSpeaker,
    advanceDialogue,
    acceptCucumberGift,
    chooseDialogueResponse,

    returnToMap,
  };
}
