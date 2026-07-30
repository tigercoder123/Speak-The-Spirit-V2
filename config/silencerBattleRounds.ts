import type { ChallengeType, DistractorLookup } from '../utils/challengeGenerator';
import { isSignificantWord, tokenizeVerseWords } from '../utils/challengeGenerator';

export const SILENCER_BATTLE_VERSE_REFERENCE = 'Hebrews 11:1';

// Used if the live YouVersion fetch fails, so the battle stays playable
// offline. KJV wording (public domain) to avoid depending on a licensed
// translation for the fallback text.
export const SILENCER_BATTLE_FALLBACK_VERSE_TEXT =
  'Now faith is the substance of things hoped for, the evidence of things not seen.';

export type ResponseTone = 'gentle' | 'firm' | 'warm';

export interface ResponseOption {
  tone: ResponseTone;
  /** Short label shown above the message, e.g. "Gentle & Encouraging". */
  label: string;
  message: string;
}

/**
 * Result shape for services/responseChoicesService.ts's `getFreshResponseChoices` -
 * the 3 tonal player lines for the CHOICE screen, plus the muted Songbeast's
 * own short thought-bubble reaction to each one (see components/battle/ThoughtBubble.tsx),
 * generated together in a single Gloo call so the matching reaction is
 * already in hand the instant the player picks a line.
 */
export interface ResponseChoicesResult {
  options: ResponseOption[];
  reactions: Record<ResponseTone, string>;
}

// Fallback shown on the CHOICE screen whenever the fresh, gear-piece-specific
// lines from services/responseChoicesService.ts aren't available in time
// (Gloo errors or is slow) - see that service for the primary, generated path.
export const SILENCER_BATTLE_RESPONSES: ResponseOption[] = [
  {
    tone: 'gentle',
    label: 'Gentle & Encouraging',
    message: "You don't need what the Silencer gave you. You were always enough.",
  },
  {
    tone: 'firm',
    label: 'Firm & Bold',
    message: "You don't need the Silencer's gear. Take it off - you never needed its permission.",
  },
  {
    tone: 'warm',
    label: 'Warm & Affirming',
    message: "You don't need the Silencer's gear, dear one. You are loved exactly as you are.",
  },
];

// Fallback for the Songbeast's CHOICE-beat thought bubble (see
// components/battle/ThoughtBubble.tsx), used whenever the fresh, per-line
// reaction from services/responseChoicesService.ts isn't available in time -
// tone-keyed since that's all a static fallback can key off of (the fresh
// path reacts to the actual chosen line's content, not just its tone).
export const SILENCER_BATTLE_CHOICE_THOUGHTS: Record<ResponseTone, string> = {
  gentle: '...maybe I am enough...',
  firm: 'Take it off... really?',
  warm: 'Loved, just as I am?',
};

// Index order matches GearPieceState[] from useSilencerBattle (headphones,
// glasses, muzzle) - used to tell the fresh-response generator which piece is
// being removed this round, so its lines can reference it specifically.
export type GearPieceKey = 'headphones' | 'glasses' | 'muzzle';

export interface GearPieceInfo {
  name: string;
  description: string;
}

export const GEAR_PIECE_INFO: Record<GearPieceKey, GearPieceInfo> = {
  headphones: { name: 'headphones', description: 'headphones that drown out anything true' },
  glasses: { name: 'glasses', description: "glasses that distort what's real" },
  muzzle: { name: 'muzzle', description: "a muzzle that silences its voice" },
};

export const GEAR_PIECE_ORDER: GearPieceKey[] = ['headphones', 'glasses', 'muzzle'];

export type RoundTier = 'wordBank' | 'dropdown' | 'fillInBlank' | 'fullRecall' | 'wholeVerse';

// What the Silencer says during the RESILENCE re-silence effect, trying to
// lure the Songbeast back into wearing its gear - one per difficulty tier so
// the line varies as the battle escalates instead of repeating verbatim
// across all ~7 rounds.
const SILENCER_BATTLE_TEMPTATION_LINES: Record<RoundTier, string> = {
  wordBank: '"You look better with this on. Just stay quiet."',
  dropdown: '"You\'re not good enough to be heard anyway."',
  fillInBlank: '"You should be like everyone else. Stay silenced."',
  fullRecall: '"Give up now - you\'ll never remember it all."',
  wholeVerse: '"Let me back in. It\'s so much easier that way."',
};

// Fallback for the Songbeast's re-silence-beat thought bubble (see
// components/battle/ThoughtBubble.tsx), used whenever the fresh thought from
// services/resilenceThoughtService.ts isn't available in time - keyed by the
// same per-tier Silencer "theme" as SILENCER_BATTLE_TEMPTATION_LINES above,
// since the fresh path reacts to that exact line's content rather than a tone.
export const SILENCER_BATTLE_RESILENCE_THOUGHTS: Record<RoundTier, string> = {
  wordBank: "...maybe it's safer quiet.",
  dropdown: 'Not... good enough, though?',
  fillInBlank: 'Just... blend in, then?',
  fullRecall: "I'll never remember it...",
  wholeVerse: '...maybe easier to stop.',
};

/**
 * Result shape for services/wrongAnswerMomentService.ts's
 * `getFreshWrongAnswerMoment` - the Silencer's gloating line for the
 * wrong-answer beat, plus the muted Songbeast's own doubtful thought-bubble
 * reply to it (see components/battle/ThoughtBubble.tsx), generated together
 * in a single Gloo call.
 */
export interface WrongAnswerMoment {
  line: string;
  thought: string;
}

// Fallback for the Silencer's wrong-answer-beat line (see
// services/wrongAnswerMomentService.ts) - said as it puts a piece of gear
// back on because the player just missed a question, gloating over the
// mistake. Keyed by the same per-round "theme" as
// SILENCER_BATTLE_TEMPTATION_LINES above.
export const SILENCER_BATTLE_WRONG_ANSWER_LINES: Record<RoundTier, string> = {
  wordBank: '"Wrong answer. Back it goes."',
  dropdown: '"See? You still need me."',
  fillInBlank: '"Too hard for you, isn\'t it?"',
  fullRecall: '"You\'ll never hold onto it all."',
  wholeVerse: '"One slip, and I\'m back."',
};

// Fallback for the Songbeast's wrong-answer-beat thought bubble (see
// components/battle/ThoughtBubble.tsx) - wavering toward doubt since the
// miss went the Silencer's way, not an upbeat reaction. Keyed the same way
// as the line above.
export const SILENCER_BATTLE_WRONG_ANSWER_THOUGHTS: Record<RoundTier, string> = {
  wordBank: 'Maybe I got it wrong.',
  dropdown: "...maybe he's right.",
  fillInBlank: 'Too hard for me...',
  fullRecall: "I'll never hold it all.",
  wholeVerse: '...so close, yet not.',
};

// Thematic words likely to appear across common English translations of this
// verse (KJV, BSB, NIV, etc. each phrase it differently) - used to pick
// "important" word-bank/dropdown blanks when the live-fetched translation
// actually contains them, with a plain significant-word fallback below for
// whichever ones it doesn't. Keeps the round curve translation-agnostic
// instead of assuming one specific wording.
const CANDIDATE_IMPORTANT_WORDS = [
  'faith', 'confidence', 'assurance', 'substance', 'evidence', 'conviction',
  'hope', 'hoped', 'see', 'seen', 'unseen',
];

const DISTRACTOR_BANK: Record<string, string[]> = {
  faith: ['doubt', 'belief', 'religion'],
  confidence: ['worry', 'belief', 'doubt'],
  assurance: ['doubt', 'worry', 'proof'],
  substance: ['illusion', 'shadow', 'proof'],
  evidence: ['proof', 'illusion', 'shadow'],
  conviction: ['doubt', 'denial', 'hesitation'],
  hope: ['wish', 'desire', 'fear'],
  hoped: ['wished', 'desired', 'feared'],
  see: ['hear', 'know', 'feel'],
  seen: ['hidden', 'known', 'felt'],
  unseen: ['visible', 'known', 'plain'],
};

// Plausible wrong options for any other significant word the fallback picks
// (i.e. one not in DISTRACTOR_BANK above, because the live translation didn't
// contain enough of the themed CANDIDATE_IMPORTANT_WORDS).
const FALLBACK_DISTRACTOR_POOL = [
  'doubt', 'fear', 'sight', 'proof', 'illusion', 'silence', 'noise', 'shadow', 'comfort', 'riches',
];

export const SILENCER_BATTLE_DISTRACTORS: DistractorLookup = {
  forWord: (answer) => {
    const key = answer.toLowerCase();
    return DISTRACTOR_BANK[key] ?? FALLBACK_DISTRACTOR_POOL.filter((w) => w !== key);
  },
};

// Every wrong answer restores 1 gear level via the Silencer's re-silence
// regardless of which round it happened on - an "untracked" restore the
// curve's turn budget never accounts for. To keep the battle's actual ending
// (full restoration) lined up with gear ACTUALLY running out for the
// Silencer to give back, every wrong answer appends one extra round onto the
// end of whichever phase it happened in.
export interface ExtraRoundCounts {
  wordBank: number;
  dropdown: number;
  fillInBlank: number;
}

export const NO_EXTRA_ROUNDS: ExtraRoundCounts = { wordBank: 0, dropdown: 0, fillInBlank: 0 };

export interface SilencerBattleRoundConfig {
  challengeType: ChallengeType;
  blankWordIndices: number[];
  temptationLine: string;
  /** Silencer "theme" for this round - same granularity as
   * SILENCER_BATTLE_TEMPTATION_LINES's keys (finer than challengeType, since
   * fullRecall and fillInBlank share a challengeType but not a theme). Used to
   * key the re-silence-beat thought bubble's typed fallback - see
   * SILENCER_BATTLE_RESILENCE_THOUGHTS and hooks/useSilencerBattle.ts. */
  tier: RoundTier;
}

// The whole curve is sized to fit a "clean" (no wrong answers) turn budget:
// 2 word-bank rounds, 1 dropdown round, N growing fill-in-blank rounds, 1
// full-recall round (every word blanked, still one input per word), and
// finally 1 whole-verse round - N is whatever's left after the other fixed
// pieces. This budget is derived from the actual gear math the hook plays
// out (see useSilencerBattle.ts's isFinalRound): each round's correct
// answer removes 2 gear "levels" and the Silencer's comeback restores 1 -
// a net -1/round - except the final round, which skips the comeback. 6
// total levels (3 pieces x 2 levels each) means 4 net-(-1) rounds bring it
// down to exactly 2 remaining, and a 6th, final round's cascade removes
// those last 2 with nothing left for the Silencer to restore.
const WORD_BANK_ROUND_COUNT = 2;
const WORD_BANK_START_COUNT = 1;
const DROPDOWN_ROUND_COUNT = 1;
const DROPDOWN_START_COUNT = 4;
export const TOTAL_TURNS_FOR_PERFECT_RUN = 6;

/**
 * Point values driving the restore bar's progress score (see
 * hooks/useSilencerBattle.ts and components/battle/RestoreBar.tsx). This is
 * a SEPARATE concept from GearPieceState/gearPieces above, which still
 * drives the Songbeast's own gear visuals unchanged - the bar tracks
 * challenge-clear progress, not gear.
 *
 * `setbackRatio` is how both setbacks (the re-silence comeback after a
 * correct answer, and a wrong answer) are defined - as a fraction of
 * `correctAnswerGain`, never as their own independently-tuned numbers - so
 * retuning the gain keeps both setbacks at exactly half of it.
 *
 * `correctAnswerGain` is sized so a clean run (no wrong answers) lands the
 * bar at exactly 100% once every required challenge is cleared: every
 * correct answer scores a full gain, and every one of those EXCEPT the
 * final round's is immediately followed by the re-silence comeback costing
 * half a gain back (the final round has no comeback - see isFinalRound in
 * the hook). Across TOTAL_TURNS_FOR_PERFECT_RUN clears, that's
 * TOTAL_TURNS_FOR_PERFECT_RUN full gains minus (TOTAL_TURNS_FOR_PERFECT_RUN
 * - 1) half-gains; solving for the gain that makes that total exactly 100
 * gives 200 / (TOTAL_TURNS_FOR_PERFECT_RUN + 1). Computed from that
 * constant here, rather than a hand-tuned literal, so it can't silently
 * drift out of sync if TOTAL_TURNS_FOR_PERFECT_RUN is ever retuned.
 */
export interface BattleProgressConfig {
  correctAnswerGain: number;
  setbackRatio: number;
}

export const BATTLE_PROGRESS: BattleProgressConfig = {
  correctAnswerGain: 200 / (TOTAL_TURNS_FOR_PERFECT_RUN + 1),
  setbackRatio: 0.5,
};

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Picks `count` word-indices from `pool`, starting at a rotating position
// (wrapping around) determined by `offsetSeed`. At offsetSeed 0 this is just
// `pool`'s own leading prefix. A nonzero offsetSeed (a repeat visit to a
// round after a wrong-answer rollback) shifts the window so the retry blanks
// different words than the previous visit did.
function selectWindow(pool: number[], count: number, offsetSeed: number): number[] {
  const n = pool.length;
  if (n === 0) return [];
  const clampedCount = Math.min(count, n);
  const offset = ((offsetSeed % n) + n) % n;
  return Array.from({ length: clampedCount }, (_, i) => pool[(offset + i) % n]);
}

/**
 * Total turns a run through this session's curve actually takes, given how
 * many extra rounds wrong answers have appended so far - the hook uses this
 * (not the fixed TOTAL_TURNS_FOR_PERFECT_RUN) to know which round is really
 * the last one.
 */
export function getEffectiveTotalTurns(extra: ExtraRoundCounts): number {
  return TOTAL_TURNS_FOR_PERFECT_RUN + extra.wordBank + extra.dropdown + extra.fillInBlank;
}

/**
 * Builds the round-progression curve for a specific verse's text. Verse text
 * arrives from the live YouVersion fetch (or its offline fallback), so this
 * is a function of that text rather than a module-level constant - callers
 * (the battle hook) should memoize the result per verseText, not call this
 * on every render.
 */
export function buildRoundCurve(verseText: string) {
  const words = tokenizeVerseWords(verseText);
  const verseWordCount = words.length;
  const verseLetterCount = words.reduce((sum, w) => sum + w.value.length, 0);

  const candidateSet = new Set(CANDIDATE_IMPORTANT_WORDS);
  const importantIndices: number[] = [];
  words.forEach((w, i) => {
    if (candidateSet.has(w.value.toLowerCase())) importantIndices.push(i);
  });

  // If this translation's wording doesn't contain enough of the themed
  // candidate words, pad with other significant words so word-bank/dropdown
  // rounds always have enough to work with.
  const minImportantNeeded = Math.max(DROPDOWN_START_COUNT, WORD_BANK_START_COUNT + WORD_BANK_ROUND_COUNT - 1);
  const importantSet = new Set(importantIndices);
  if (importantIndices.length < minImportantNeeded) {
    words.forEach((w, i) => {
      if (importantIndices.length >= minImportantNeeded) return;
      if (importantSet.has(i)) return;
      if (isSignificantWord(w.value)) {
        importantIndices.push(i);
        importantSet.add(i);
      }
    });
  }
  // Last resort (a very short fallback verse): any word counts as "important".
  if (importantIndices.length === 0) {
    words.forEach((_, i) => importantIndices.push(i));
  }

  const dropdownStartCount = Math.min(DROPDOWN_START_COUNT, importantIndices.length);

  function selectImportantWords(roundIndexInPhase: number, startCount: number, variant: number): number[] {
    const count = roundIndexInPhase + startCount;
    return selectWindow(importantIndices, count, roundIndexInPhase + variant);
  }

  // Fill-in-blank phase's growth order: important words first (shuffled),
  // then every remaining word (also shuffled) once the important pool runs
  // out. Computed once per verse text, not re-shuffled per round.
  const remainingWords = words.map((_, i) => i).filter((i) => !importantSet.has(i));
  const priorityOrder = [...shuffle(importantIndices), ...shuffle(remainingWords)];

  function selectFillInBlankWords(count: number, variant: number): number[] {
    return selectWindow(priorityOrder, count, variant);
  }

  // Smallest word count (from the front of priorityOrder) whose cumulative
  // letters exceed half the verse's total letters - the fill-in-blank growth
  // phase aims to land as close to this as it can before jumping to full recall.
  function computeFullRecallCount(): number {
    const half = verseLetterCount / 2;
    let cumulative = 0;
    for (let n = 1; n <= verseWordCount; n++) {
      cumulative += words[priorityOrder[n - 1]].value.length;
      if (cumulative > half) return n;
    }
    return verseWordCount;
  }
  const fullRecallCrossingCount = computeFullRecallCount();

  const fillInBlankStartCount = dropdownStartCount + (DROPDOWN_ROUND_COUNT - 1);
  const fillInBlankGrowthRoundCount = Math.max(
    1,
    TOTAL_TURNS_FOR_PERFECT_RUN - WORD_BANK_ROUND_COUNT - DROPDOWN_ROUND_COUNT - 2
  );

  // The fill-in-blank count for growth-phase index `index` (0-based within
  // that phase) - steps by 2 words each round until doing so would land past
  // the full-recall crossing count, then by 1 the rest of the way.
  function fillInBlankCountForIndex(index: number): number {
    let count = fillInBlankStartCount;
    for (let i = 0; i <= index; i++) {
      const remainingGap = fullRecallCrossingCount - count;
      const step = Math.max(1, Math.min(2, remainingGap));
      count += step;
    }
    return Math.min(count, verseWordCount);
  }

  /**
   * `roundNumber` is 0-indexed and drives the difficulty TIER (word-bank ->
   * dropdown -> fill-in-blank -> full-recall -> whole-verse) and blank COUNT
   * within a tier - it can both increase (normal progression) and decrease (a
   * wrong answer steps back to the previous tier's difficulty).
   *
   * `variant` is how many times this exact `roundNumber` has been visited
   * before (0 = first time) - the hook bumps it whenever a wrong answer rolls
   * the difficulty back to a `roundNumber` already seen this session, so the
   * retry blanks different words instead of repeating the identical selection.
   *
   * `extra` is how many bonus rounds wrong answers have appended onto each
   * phase so far - defaults to none for a perfect run.
   */
  function getRoundConfig(
    roundNumber: number,
    variant = 0,
    extra: ExtraRoundCounts = NO_EXTRA_ROUNDS
  ): SilencerBattleRoundConfig {
    const wordBankRoundCount = WORD_BANK_ROUND_COUNT + extra.wordBank;
    const dropdownRoundCount = DROPDOWN_ROUND_COUNT + extra.dropdown;
    const fillInBlankGrowthCount = fillInBlankGrowthRoundCount + extra.fillInBlank;

    if (roundNumber < wordBankRoundCount) {
      return {
        challengeType: 'WORD_BANK',
        blankWordIndices: selectImportantWords(roundNumber, WORD_BANK_START_COUNT, variant),
        temptationLine: SILENCER_BATTLE_TEMPTATION_LINES.wordBank,
        tier: 'wordBank',
      };
    }

    const dropdownRoundIndex = roundNumber - wordBankRoundCount;
    if (dropdownRoundIndex < dropdownRoundCount) {
      return {
        challengeType: 'DROPDOWN',
        blankWordIndices: selectImportantWords(dropdownRoundIndex, dropdownStartCount, variant),
        temptationLine: SILENCER_BATTLE_TEMPTATION_LINES.dropdown,
        tier: 'dropdown',
      };
    }

    const roundIndexInPhase = dropdownRoundIndex - dropdownRoundCount;
    if (roundIndexInPhase < fillInBlankGrowthCount) {
      return {
        challengeType: 'FILL_IN_BLANK',
        blankWordIndices: selectFillInBlankWords(fillInBlankCountForIndex(roundIndexInPhase), variant),
        temptationLine: SILENCER_BATTLE_TEMPTATION_LINES.fillInBlank,
        tier: 'fillInBlank',
      };
    }

    if (roundIndexInPhase === fillInBlankGrowthCount) {
      // Threshold crossed: blank every word this round - still one input per
      // word, not a single textarea yet.
      return {
        challengeType: 'FILL_IN_BLANK',
        blankWordIndices: words.map((_, i) => i),
        temptationLine: SILENCER_BATTLE_TEMPTATION_LINES.fullRecall,
        tier: 'fullRecall',
      };
    }

    // The first round after full-recall: one textarea for the whole verse -
    // also, per getEffectiveTotalTurns, the last round of this curve.
    return {
      challengeType: 'WHOLE_VERSE',
      blankWordIndices: [],
      temptationLine: SILENCER_BATTLE_TEMPTATION_LINES.wholeVerse,
      tier: 'wholeVerse',
    };
  }

  return { getRoundConfig };
}
