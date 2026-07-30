'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../context/GameContext';
import { addLog } from '../utils/gameEvents';
import { getVerse } from '../services/scriptureService';
import { getFreshResponseChoices } from '../services/responseChoicesService';
import { getFreshTemptationLine } from '../services/temptationLineService';
import { getFreshResilenceThought } from '../services/resilenceThoughtService';
import { getFreshWrongAnswerMoment } from '../services/wrongAnswerMomentService';
import { getFreshDistractors } from '../services/distractorService';
import { LANGUAGE_NAMES } from '../services/bibleVersionsService';
import {
  Challenge,
  ChallengeType,
  checkAnswers,
  DistractorLookup,
  generateChallenge,
  tokenizeVerseWords,
} from '../utils/challengeGenerator';
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
  BATTLE_PROGRESS,
  buildRoundCurve,
  ExtraRoundCounts,
  GEAR_PIECE_INFO,
  GEAR_PIECE_ORDER,
  GearPieceKey,
  NO_EXTRA_ROUNDS,
  ResponseOption,
  ResponseTone,
  SILENCER_BATTLE_CHOICE_THOUGHTS,
  SILENCER_BATTLE_DISTRACTORS,
  SILENCER_BATTLE_FALLBACK_VERSE_TEXT,
  SILENCER_BATTLE_RESILENCE_THOUGHTS,
  SILENCER_BATTLE_RESPONSES,
  SILENCER_BATTLE_VERSE_REFERENCE,
  SILENCER_BATTLE_WRONG_ANSWER_LINES,
  SILENCER_BATTLE_WRONG_ANSWER_THOUGHTS,
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
//     dismissed)--> COMPLETE
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
  | 'COMPLETE';

export type GearPieceState = 'ON' | 'HALF_ON' | 'REMOVED';
// Index order matches the Songbeast battle avatar's own gear layering -
// see config/battleAssets.ts's `songbeast` keys (headphones, glasses, muzzle).
const GEAR_PIECE_COUNT = 3;

const CORRECT_BANNER_HOLD_MS = 1200;
const INCORRECT_BANNER_HOLD_MS = 1200;
const MISTAKE_REVIEW_HOLD_MS = 3000;
const CHOICE_TO_RESTORATION_DELAY_MS = 700;
const POST_SILENCER_PARCHMENT_DELAY_MS = 600;
const RESTORED_BANNER_DELAY_MS = 1000;
const DEBRIEF_HOLD_MS = 1500;

const GEAR_LEVELS: Record<GearPieceState, number> = { ON: 2, HALF_ON: 1, REMOVED: 0 };
const LEVELS_TO_GEAR_STATE: GearPieceState[] = ['REMOVED', 'HALF_ON', 'ON'];

// Both setbacks cost this same amount - always derived from
// BATTLE_PROGRESS.correctAnswerGain via its setbackRatio, never its own
// independently-tuned number, so retuning the gain keeps both setbacks at
// exactly half of it automatically. See BATTLE_PROGRESS's own doc comment
// in config/silencerBattleRounds.ts for how the gain itself is sized.
const PROGRESS_SETBACK_AMOUNT = BATTLE_PROGRESS.correctAnswerGain * BATTLE_PROGRESS.setbackRatio;

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
    pendingBattleSpawn,
    setPendingBattleSpawn,
    pendingBattleSkipToRestored,
    setPendingBattleSkipToRestored,
  } = useGame();

  // Dev cheat (GameHeader.tsx's "Cheat: Restored" button) - captured once on
  // mount, same pattern as initialExplorationSpawnRef below, so clearing the
  // context flag right after doesn't retroactively un-skip THIS mount. When
  // true, the several lazy useState initializers below seed this battle
  // already in its "just won" shape instead of the normal fresh-start one.
  const skipToRestoredRef = useRef(pendingBattleSkipToRestored);

  const [phase, setPhaseState] = useState<BattlePhase>(() => (skipToRestoredRef.current ? 'RESTORED' : 'EXPLORING'));
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
  // Which gear piece responseOptions/choiceReactions above were generated
  // (or are currently generating) for - see the prefetch effect below. Lets
  // that effect tell "already have/are fetching the right thing, do
  // nothing" apart from "gear state just changed, this is now stale, fetch
  // again" without re-deriving it from responseOptions' own content.
  const prefetchedGearKeyRef = useRef<GearPieceKey | null>(null);
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
  // null until a fresh line arrives for this round - the displayed
  // temptationLine falls back to the static per-tier config line until then,
  // so RESILENCE is never left without a caption to show.
  const [freshTemptationLine, setFreshTemptationLine] = useState<string | null>(null);
  const temptationGenerationIdRef = useRef(0);
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
  // TOTAL_TURNS_FOR_PERFECT_RUN (6) already accounts for the Silencer's own
  // comeback: each round's correct answer removes 2 gear levels and the
  // Silencer restores 1 back (a net -1/round) except the final round, which
  // skips the restore - see that constant's own comment in
  // config/silencerBattleRounds.ts for the full 6-level breakdown. Every
  // wrong answer, in turn, hands the Silencer one MORE (otherwise
  // unbudgeted) restore via applyGearRestore in submitAnswer's incorrect
  // branch below, so it pushes this same finish point one round further
  // out - keeping "when everything finishes" in lockstep with the
  // Silencer's actual comeback total instead of a budget that assumes a
  // clean run.
  const totalRoundsForFinish = TOTAL_TURNS_FOR_PERFECT_RUN + totalWrongAnswers;
  const isFinalRound = roundNumber === totalRoundsForFinish - 1;

  // The round-progression curve is a function of the verse's actual text
  // (see config/silencerBattleRounds.ts), which only arrives once the live
  // fetch - or its offline fallback - resolves, so this is memoized per
  // verseText rather than built at module load.
  const roundCurve = useMemo(() => (verseText ? buildRoundCurve(verseText) : null), [verseText]);
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

  // Gloo-generated wrong-answer options for WORD_BANK/DROPDOWN rounds,
  // whenever the player's verse language isn't English - the static
  // SILENCER_BATTLE_DISTRACTORS bank below is English-only vocabulary, so
  // using it as-is for e.g. a Chinese verse would mix English wrong answers
  // into an otherwise-foreign-language word bank/dropdown. Keyed by
  // `${language}:${word.toLowerCase()}` so a repeated word across rounds (or
  // a retried variant) reuses one Gloo call instead of firing a fresh one
  // every time. A plain ref, not state: it's read synchronously inside
  // distractorLookup.forWord below at whatever moment `challenge` happens to
  // compute, so filling it in later never forces THIS round's already-
  // rendered challenge to recompute mid-interaction (which would wipe
  // whatever the player has already dragged/typed/selected) - it just means
  // the round after next naturally has fresh results ready, since
  // `currentRound` (and this prefetch effect) update well before that
  // round's own challenge is ever shown.
  const distractorCacheRef = useRef<Map<string, string[]>>(new Map());
  const pendingDistractorKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!currentRound || !verseText) return;
    if (currentRound.challengeType !== 'WORD_BANK' && currentRound.challengeType !== 'DROPDOWN') return;
    if (!bibleLanguage || bibleLanguage === 'en') return;

    const languageName = LANGUAGE_NAMES[bibleLanguage] ?? bibleLanguage;
    const words = tokenizeVerseWords(verseText);

    currentRound.blankWordIndices.forEach((wordIndex) => {
      const word = words[wordIndex]?.value;
      if (!word) return;

      const cacheKey = `${bibleLanguage}:${word.toLowerCase()}`;
      if (distractorCacheRef.current.has(cacheKey) || pendingDistractorKeysRef.current.has(cacheKey)) return;
      pendingDistractorKeysRef.current.add(cacheKey);

      getFreshDistractors(word, languageName, 3, verseText, SILENCER_BATTLE_DISTRACTORS.forWord(word))
        .then((distractors) => {
          distractorCacheRef.current.set(cacheKey, distractors);
        })
        .finally(() => {
          pendingDistractorKeysRef.current.delete(cacheKey);
        });
    });
  }, [currentRound, verseText, bibleLanguage]);

  const distractorLookup: DistractorLookup = useMemo(
    () => ({
      forWord: (answer: string) => {
        if (bibleLanguage && bibleLanguage !== 'en') {
          const cached = distractorCacheRef.current.get(`${bibleLanguage}:${answer.toLowerCase()}`);
          if (cached) return cached;
        }
        return SILENCER_BATTLE_DISTRACTORS.forWord(answer);
      },
    }),
    [bibleLanguage]
  );

  const challenge: Challenge | null = useMemo(
    () =>
      currentRound && verseText
        ? generateChallenge(
            verseText,
            SILENCER_BATTLE_VERSE_REFERENCE,
            currentRound.blankWordIndices,
            currentRound.challengeType,
            distractorLookup
          )
        : null,
    [currentRound, verseText, distractorLookup]
  );
  // Prefers the fresh, gear-piece-specific line once generated (see
  // services/temptationLineService.ts); falls back to the static per-tier
  // line while it's still generating or if generation ultimately fails.
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
      const verse = await getVerse(SILENCER_BATTLE_VERSE_REFERENCE, bibleVersionId ?? undefined);
      text = verse.text;
    } catch {
      error = 'Could not reach the Scripture archive - continuing with a saved copy of the verse.';
    }

    setVerseText(text);
    setVerseError(error);
    setRoundNumber(0);
    setRoundVisitCounts({ 0: 0 });
    setExtraRounds(NO_EXTRA_ROUNDS);
    setWrongStreak(0);
    setTotalWrongAnswers(0);
    setWrongBlanks([]);
    setGearPieces(Array(GEAR_PIECE_COUNT).fill('ON'));
    setProgressScore(0);
    setSelectedTone(null);
    responseGenerationIdRef.current += 1;
    prefetchedGearKeyRef.current = null;
    setResponseOptions(null);
    setChoiceReactions(null);
    setResponsesLoading(false);
    temptationGenerationIdRef.current += 1;
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
    setPhase('CHALLENGE');
  }, [bibleVersionId]);

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
  }, []);

  const submitAnswer = useCallback(() => {
    if (phase !== 'CHALLENGE' || !challenge || wrongBlanks.length > 0) return;

    const result = checkAnswers(challenge, answers);
    if (!result.correct) {
      setWrongBlanks(result.wrongBlankIndices);
      setWrongStreak((s) => s + 1);
      setTotalWrongAnswers((n) => n + 1);
      missedChallengeTypeRef.current = challenge.type;
      setGearPieces((prev) => applyGearRestore(prev, 1));
      triggerShake();
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
        const wrongAnswerGearKey = GEAR_PIECE_ORDER[wrongAnswerRestoreIndex];
        const fallbackLine = currentRound ? SILENCER_BATTLE_WRONG_ANSWER_LINES[currentRound.tier] : '';
        const fallbackThought = currentRound ? SILENCER_BATTLE_WRONG_ANSWER_THOUGHTS[currentRound.tier] : '';
        const wrongAnswerGenerationId = ++wrongAnswerGenerationIdRef.current;
        setFreshWrongAnswerMoment(null);
        getFreshWrongAnswerMoment(GEAR_PIECE_INFO[wrongAnswerGearKey], fallbackLine, fallbackThought).then((moment) => {
          if (wrongAnswerGenerationIdRef.current !== wrongAnswerGenerationId) return; // a later miss/round already started
          setFreshWrongAnswerMoment(moment);
        });
      }
      return;
    }

    setGearPieces((prev) => applyGearCascade(prev, 2));
    addLog('Correct!', 'battle');
    setPhase('CORRECT');
    // No response-choice kick-off here anymore - see the prefetch effect
    // below, which starts that generation as soon as the CHALLENGE targeting
    // this same gear piece first appears, well before the player even
    // answers. By the time a correct answer lands here, it's usually already
    // resolved (or resolving) rather than starting from zero.

    // Same early kick-off for the Silencer's temptation line, referencing
    // whichever piece it's about to put back on - the post-cascade gear
    // state's restore target (see handleGearRemoved). Skipped on the final
    // round: there's no comeback to narrate, finalRestoration() plays instead.
    if (!isFinalRound) {
      const postCascade = applyGearCascade(gearPieces, 2);
      const restoreIndex = findGearRestoreTargetIndex(postCascade);
      if (restoreIndex !== -1) {
        const restoreKey = GEAR_PIECE_ORDER[restoreIndex];
        const fallbackLine = currentRound?.temptationLine ?? '';
        const fallbackThought = currentRound ? SILENCER_BATTLE_RESILENCE_THOUGHTS[currentRound.tier] : '';
        const temptationId = ++temptationGenerationIdRef.current;
        const resilenceThoughtId = ++resilenceThoughtGenerationIdRef.current;
        setFreshTemptationLine(null);
        setFreshResilenceThought(null);
        getFreshTemptationLine(GEAR_PIECE_INFO[restoreKey], fallbackLine).then((line) => {
          if (temptationGenerationIdRef.current !== temptationId) return; // a later round already started
          setFreshTemptationLine(line);

          // Chained off the Silencer's own resolved line (fresh or its
          // fallback) so the Songbeast's thought always reacts to whatever
          // content actually ends up spoken - never a second, independent
          // guess at what the Silencer said.
          getFreshResilenceThought(line, fallbackThought).then((thought) => {
            if (resilenceThoughtGenerationIdRef.current !== resilenceThoughtId) return; // a later round already started
            setFreshResilenceThought(thought);
          });
        });
      }
    }
  }, [phase, challenge, answers, wrongBlanks, gearPieces, isFinalRound, currentRound, triggerShake]);

  const selectResponse = useCallback((tone: ResponseTone) => {
    setSelectedTone(tone);
    // Captured once, right when the beat's data is picked - see
    // thoughtBubbleContent's declaration for why this isn't derived live.
    const reaction = (choiceReactionsRef.current ?? SILENCER_BATTLE_CHOICE_THOUGHTS)[tone];
    setThoughtBubbleContent({ text: reaction, beat: 'CHOICE' });
    setPhase((prev) => (prev === 'CHOICE' ? 'GEAR_REMOVED' : prev));
  }, []);

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
    setProgressScore((prev) => clampProgress(prev + BATTLE_PROGRESS.correctAnswerGain));
    if (!isFinalRound) {
      setGearPieces((prev) => applyGearRestore(prev, 1));
    }
    setPhase((prev) => (prev === 'GEAR_REMOVED' ? 'RESILENCE' : prev));
  }, [isFinalRound]);

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
      // is needed here the way handleGearRemoved needs one for the gear.
      setProgressScore((prev) => clampProgress(prev - PROGRESS_SETBACK_AMOUNT));
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
    setProgressScore((prev) => clampProgress(prev - PROGRESS_SETBACK_AMOUNT));
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
  }, [schedule, goToRound]);

  // Fired by the avatar once its (rare, full-restore) victory animation
  // finishes - the golden flash/sprite swap/Silencer fade-out has already
  // played out by the time this fires.
  const handleFinalRestorationComplete = useCallback(() => {
    setShowTemptationLine(false);
    setThoughtBubbleVisible(false);
    setPhase((prev) => (prev === 'RESILENCE' ? 'RESTORED' : prev));
  }, []);

  const returnToMap = useCallback(() => {
    setPhase('COMPLETE');
    setCurrentScreen('OVERWORLD');
  }, [setCurrentScreen]);

  // Prefetches the CHOICE screen's response lines + Songbeast reactions as
  // soon as a challenge targeting a given gear piece is actually on screen -
  // not after the player answers it. Which piece is targeted is already
  // fully determined by the CURRENT gearPieces (the first not-yet-REMOVED
  // one), so there's no need to wait for a correct answer to know it. In the
  // common case the player spends several seconds solving the challenge
  // itself, which is usually enough time for this to finish well before
  // submitAnswer's correct branch would otherwise have kicked it off -
  // hiding Gloo's own latency behind that thinking time instead of adding to
  // it. Re-fires whenever gearPieces actually changes (a wrong answer
  // restores a level, shifting the target) - prefetchedGearKeyRef is what
  // lets it tell "already have/are fetching the right one" apart from that.
  useEffect(() => {
    if (phase !== 'CHALLENGE') return;
    const targetIndex = gearPieces.findIndex((p) => p !== 'REMOVED');
    const gearKey = GEAR_PIECE_ORDER[targetIndex === -1 ? GEAR_PIECE_ORDER.length - 1 : targetIndex];
    if (prefetchedGearKeyRef.current === gearKey) return;
    prefetchedGearKeyRef.current = gearKey;

    const generationId = ++responseGenerationIdRef.current;
    setResponseOptions(null);
    setChoiceReactions(null);
    setResponsesLoading(true);
    getFreshResponseChoices(GEAR_PIECE_INFO[gearKey]).then(({ options, reactions }) => {
      if (responseGenerationIdRef.current !== generationId) return; // a later gear change already started its own
      setResponseOptions(options);
      setChoiceReactions(reactions);
      setResponsesLoading(false);
    });
  }, [phase, gearPieces]);

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
    onComplete: returnToMap,
  });

  return {
    phase,
    verseError,
    verseReference: SILENCER_BATTLE_VERSE_REFERENCE,

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

    responses: responseOptions,
    responsesLoading,
    selectedTone,
    selectResponse,
    chosenMessage,

    gearPieces,
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
