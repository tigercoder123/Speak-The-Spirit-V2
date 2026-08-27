import type { ChallengeType } from '../utils/challengeGenerator';
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
 * the 3 tonal player lines for the CHOICE screen, the muted Songbeast's own
 * short thought-bubble reaction to each one, and the Silencer's own tone-keyed
 * comeback line reacting to that exact line (see
 * components/battle/ThoughtBubble.tsx and components/battle/TemptationLine.tsx),
 * all generated together in a single Gloo call so the matching reaction/comeback
 * is already in hand the instant the player picks a line. `rebuttals` is
 * omitted entirely on the static fallback path (Gloo unavailable) - callers
 * fall back to the tier-based SILENCER_BATTLE_TEMPTATION_LINES instead, same
 * as before this existed.
 */
export interface ResponseChoicesResult {
  options: ResponseOption[];
  reactions: Record<ResponseTone, string>;
  rebuttals?: Record<ResponseTone, string>;
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

// Simplified-Chinese fallback for the CHOICE screen, used specifically when
// the round targets the headphones AND the player's verse language is
// Chinese, whenever the fresh Gloo call isn't ready in time (see
// services/responseChoicesService.ts) - the headphones round is the very
// first correct answer of a battle, so it's the one most likely to still be
// mid-generation when a wrong-language/no-fallback timeout would otherwise
// show. Unlike the generic English fallback above, these dismantle
// headphones' own specific lie (GEAR_PIECE_INFO.headphones.lie - "if I
// actually hear what people really think of me, it will hurt too much, so
// it's safer to never truly listen") rather than a generic "you don't need
// the gear" line, and are written directly in Chinese rather than reusing
// the English fallback (which would jarringly mix languages).
export const SILENCER_BATTLE_RESPONSES_ZH_HEADPHONES: ResponseOption[] = [
  {
    tone: 'gentle',
    label: '温柔而鼓励',
    message: '你不需要那副耳机了。听见真话也许会痛,但你值得被人真心以待。',
  },
  {
    tone: 'firm',
    label: '坚定而勇敢',
    message: '摘下耳机吧——你不必再害怕听见真相,你比自己以为的更坚强。',
  },
  {
    tone: 'warm',
    label: '温暖而肯定',
    message: '亲爱的,你可以放心地去听。真正爱你的人,说的话不会伤害你。',
  },
];

export const SILENCER_BATTLE_CHOICE_THOUGHTS_ZH_HEADPHONES: Record<ResponseTone, string> = {
  gentle: '也许...我值得被听见?',
  firm: '摘下耳机...真的可以吗?',
  warm: '有人...真心爱我吗?',
};

// The Silencer's RESILENCE-beat comeback (see SILENCER_BATTLE_TEMPTATION_LINES
// below, its generic tier-based counterpart) as it puts the headphones back
// on - one per tone, each directly rebutting/twisting that exact
// SILENCER_BATTLE_RESPONSES_ZH_HEADPHONES line rather than a generic taunt,
// trying to pull the Songbeast back toward headphones' own lie (it's safer
// to never truly listen). Slots into ResponseChoicesResult.rebuttals the
// same way the fresh Gloo path's rebuttals do (see
// services/responseChoicesService.ts's getStaticResponseChoicesFallback),
// so hooks/useSilencerBattle.ts's selectResponse picks these up with no
// extra plumbing - it already prefers choiceRebuttalsRef over the generic
// tier-based temptation line whenever a rebuttal is present.
export const SILENCER_BATTLE_REBUTTALS_ZH_HEADPHONES: Record<ResponseTone, string> = {
  gentle: '"别傻了,真话才是最伤人的东西——戴上耳机,谁也伤不了你。"',
  firm: '"坚强?等真相扑面而来的时候,你就知道自己有多脆弱了。"',
  warm: '"爱?哼,等他们说出真心话,你就会发现那些话有多锋利。"',
};

// The Songbeast's RESILENCE-beat thought bubble (see
// SILENCER_BATTLE_RESILENCE_THOUGHTS below, its generic tier-based
// counterpart), reacting to the matching SILENCER_BATTLE_REBUTTALS_ZH_HEADPHONES
// line above as that gear goes back on - tone-keyed to match whichever
// rebuttal it's wavering in response to, the same way
// SILENCER_BATTLE_CHOICE_THOUGHTS_ZH_HEADPHONES matches the CHOICE-beat line.
export const SILENCER_BATTLE_RESILENCE_THOUGHTS_ZH_HEADPHONES: Record<ResponseTone, string> = {
  gentle: '也许...戴上比较安全?',
  firm: '我真的...足够坚强吗?',
  warm: '那些话...会伤人吗?',
};

// Index order matches GearPieceState[] from useSilencerBattle (headphones,
// glasses, muzzle, plus handcuffs and legcuffs when the battle includes them
// - see getGearPieceOrder below) - used to tell the fresh-response generator
// which piece is being removed this round, so its lines can reference it
// specifically.
export type GearPieceKey = 'headphones' | 'glasses' | 'muzzle' | 'handcuffs' | 'legcuffs';

export interface GearPieceInfo {
  name: string;
  description: string;
  /** The specific false belief the Silencer convinced the Songbeast of, which
   * is WHY it's still wearing this piece - not just "it looks nice." Fed into
   * generateSilencerResponseChoices (see app/actions/gloo.ts) so each of the
   * 3 response lines dismantles THIS exact lie using the verse, instead of a
   * generic "you don't need the gear" line. */
  lie: string;
}

export const GEAR_PIECE_INFO: Record<GearPieceKey, GearPieceInfo> = {
  headphones: {
    name: 'headphones',
    description: 'headphones that drown out anything true',
    lie: "If I actually hear what people really think of me, it will hurt too much - so it's safer to never truly listen to anyone at all.",
  },
  glasses: {
    name: 'glasses',
    description: "glasses that distort what's real",
    lie: "The world looks too broken and scary exactly as it is - so it's safer to see everything through a warped, distorted lens instead of clearly.",
  },
  muzzle: {
    name: 'muzzle',
    description: "a muzzle that silences its voice",
    lie: "If I ever really use my true voice, people will judge it and turn away - so it's safer to stay silent.",
  },
  handcuffs: {
    name: 'handcuffs',
    description: 'handcuffs that keep its hands from ever being used',
    lie: "If I actually use my hands to act for God, I might get it wrong or it won't be enough - so it's safer to never act at all.",
  },
  legcuffs: {
    name: 'legcuffs',
    description: "legcuffs that keep it from ever stepping out to where it's needed",
    lie: "If I actually go where God is sending me, it won't be safe, I won't belong there, and it will be too much to face - so it's safer to stay right where I am.",
  },
};

// The base 3 pieces every battle tracks. Only 3 (not 4) so short verses -
// the common case - keep the original 6-round battle unchanged; see
// getGearPieceOrder below for when 'handcuffs' joins this order.
export const GEAR_PIECE_ORDER: GearPieceKey[] = ['headphones', 'glasses', 'muzzle'];

// Verses longer than this many words also get a 4th gear piece, handcuffs -
// see buildRoundCurve's `includesHandcuffs` below, which is what actually
// decides this per-verse (this constant is just the threshold it compares
// against).
export const HANDCUFFS_WORD_THRESHOLD = 20;

// Verses longer than this many words also get a 5th gear piece, legcuffs -
// this threshold is nested above HANDCUFFS_WORD_THRESHOLD, so any verse
// long enough for legcuffs is automatically long enough for handcuffs too.
// See buildRoundCurve's `includesLegcuffs` below.
export const LEGCUFFS_WORD_THRESHOLD = 38;

/** The gear pieces THIS battle tracks, in order - the base 3, plus
 * 'handcuffs' and 'legcuffs' appended as the verse qualifies for each (see
 * HANDCUFFS_WORD_THRESHOLD/LEGCUFFS_WORD_THRESHOLD and buildRoundCurve's
 * `includesHandcuffs`/`includesLegcuffs`). Callers (hooks/useSilencerBattle.ts)
 * use this instead of the bare GEAR_PIECE_ORDER wherever they need to know
 * how many pieces or which ones this specific battle has. `includesLegcuffs`
 * implies `includesHandcuffs` given the nested thresholds, but this builds
 * the order defensively (legcuffs never appended without handcuffs) rather
 * than assuming callers always pass consistent flags. */
export function getGearPieceOrder(includesHandcuffs: boolean, includesLegcuffs: boolean): GearPieceKey[] {
  const order: GearPieceKey[] = [...GEAR_PIECE_ORDER];
  if (includesHandcuffs || includesLegcuffs) order.push('handcuffs');
  if (includesLegcuffs) order.push('legcuffs');
  return order;
}

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
const WORD_BANK_START_COUNT = 2;
const DROPDOWN_ROUND_COUNT = 1;
const DROPDOWN_START_COUNT = 5;
export const TOTAL_TURNS_FOR_PERFECT_RUN = 6;
// A verse over HANDCUFFS_WORD_THRESHOLD words gets a 4th gear piece
// (handcuffs) and 2 more fill-in-blank rounds to go with it - the growth
// formula below (`TOTAL_TURNS_FOR_PERFECT_RUN - WORD_BANK_ROUND_COUNT -
// DROPDOWN_ROUND_COUNT - 2`) already turns this single extra total into
// exactly the desired 8-round curve (2 word-bank + 1 dropdown + 3 growing
// fill-in-blank + 1 full-recall + 1 whole-verse) with no other changes.
export const TOTAL_TURNS_WITH_HANDCUFFS = 8;
// A verse over LEGCUFFS_WORD_THRESHOLD words gets a 5th gear piece
// (legcuffs) on top of handcuffs, and 2 more fill-in-blank rounds beyond
// the 8-round handcuffs curve - same growth formula as handcuffs above, just
// one more total turn increment (4 pieces x 2 levels = 8 -> 5 pieces x 2
// levels = 10).
export const TOTAL_TURNS_WITH_LEGCUFFS = 10;

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

// No more than this many verse-position-consecutive words are ever blanked
// together in one round - keeps blanks scattered through the verse instead
// of clumping into one run, however many are needed for a given round. Only
// relaxed (see selectScatteredPositions below) when a round needs more
// blanks than the verse can fit while honoring this cap - unavoidable once a
// round's count gets close to the full word count.
const MAX_CONSECUTIVE_BLANKS = 2;

// Rotates `pool` (a full permutation, same length back out) starting at a
// rotating position determined by `offsetSeed`. At offsetSeed 0 this is just
// `pool` unchanged. A nonzero offsetSeed (a repeat visit to a round after a
// wrong-answer rollback) shifts the starting point so the retry prioritizes
// different words than the previous visit did.
function rotateArray(pool: number[], offsetSeed: number): number[] {
  const n = pool.length;
  if (n === 0) return [];
  const offset = ((offsetSeed % n) + n) % n;
  return Array.from({ length: n }, (_, i) => pool[(offset + i) % n]);
}

// Splits `count` into groups of at most `groupSize` each - every group but
// possibly the last is exactly `groupSize`.
function splitIntoGroups(count: number, groupSize: number): number[] {
  const groups: number[] = [];
  let remaining = count;
  while (remaining > 0) {
    const size = Math.min(groupSize, remaining);
    groups.push(size);
    remaining -= size;
  }
  return groups;
}

// Selects exactly `count` distinct indices from [0, verseWordCount), spread
// across the whole range with no more than `maxConsecutive` ever
// consecutive - GUARANTEED whenever mathematically possible, by
// construction: `count` is split into groups of at most `maxConsecutive`,
// each group separated from the next by at least one unselected word, with
// any left-over slack distributed across the gaps (rotated by
// `rotationSeed`, so different rounds/retries land the groups in different
// places) rather than piled up in one spot. Falls back to simple even
// spacing (still spread out, just no longer cap-guaranteed) only once
// `count` is high enough relative to `verseWordCount` that honoring the cap
// is mathematically impossible.
function selectScatteredPositions(
  verseWordCount: number,
  count: number,
  maxConsecutive: number,
  rotationSeed: number
): number[] {
  if (count >= verseWordCount) return Array.from({ length: verseWordCount }, (_, i) => i);
  if (count <= 0) return [];

  const groupSizes = splitIntoGroups(count, maxConsecutive);
  const numGroups = groupSizes.length;
  const minGaps = numGroups - 1; // at least 1 separator between every pair of adjacent groups
  const totalGapSlots = verseWordCount - count;
  const extraSlack = totalGapSlots - minGaps;

  if (extraSlack < 0) {
    return Array.from({ length: count }, (_, i) => Math.floor((i * verseWordCount) / count));
  }

  // Distributes extraSlack across numGroups+1 "gap buckets" (before the
  // first group, between each pair, after the last) as evenly as possible,
  // rotating which buckets get the +1 remainder by rotationSeed.
  const numBuckets = numGroups + 1;
  const bucketBase = Math.floor(extraSlack / numBuckets);
  const bucketRemainder = extraSlack % numBuckets;
  const bucketOrder = rotateArray(
    Array.from({ length: numBuckets }, (_, i) => i),
    rotationSeed
  );
  const bucketExtra = new Array(numBuckets).fill(0);
  for (let i = 0; i < bucketRemainder; i++) bucketExtra[bucketOrder[i]] = 1;

  const positions: number[] = [];
  let cursor = bucketBase + bucketExtra[0];
  for (let g = 0; g < numGroups; g++) {
    for (let k = 0; k < groupSizes[g]; k++) {
      positions.push(cursor);
      cursor += 1;
    }
    if (g < numGroups - 1) {
      cursor += 1 + bucketBase + bucketExtra[g + 1];
    }
  }
  return positions;
}

// Greedily selects up to `count` indices from `candidates` (already
// rotated/ordered by caller), skipping any candidate that would push a
// verse-position run past `maxConsecutive` selected words in a row - so
// higher-priority candidates are preferred while the chosen set still reads
// as scattered rather than clustered. `seedChosen` primes the chosen set (and
// its own consecutive-run accounting) before the pass starts, so a second
// call can keep filling where an earlier one left off without re-violating
// the cap against those earlier picks (see selectPreferringFresh below). May
// return fewer than `count` if `candidates` legally can't supply that many -
// callers decide how to handle a shortfall.
function greedyScatter(
  candidates: number[],
  count: number,
  maxConsecutive: number,
  seedChosen: Iterable<number> = []
): number[] {
  const chosen = new Set<number>(seedChosen);

  const wouldViolate = (index: number): boolean => {
    let runLength = 1;
    for (let step = 1; chosen.has(index - step); step++) runLength++;
    for (let step = 1; chosen.has(index + step); step++) runLength++;
    return runLength > maxConsecutive;
  };

  for (const candidate of candidates) {
    if (chosen.size >= count) break;
    if (chosen.has(candidate) || wouldViolate(candidate)) continue;
    chosen.add(candidate);
  }

  return [...chosen];
}

// Greedily selects `count` indices from `priorityCandidates` (already
// rotated/ordered by caller). If an unlucky priority order leaves the greedy
// pass short of `count` (it can legally reach one arrangement but not
// others), falls back to the GUARANTEED positional construction above
// instead of ever silently violating the cap when avoiding it was still
// possible.
function selectScattered(
  priorityCandidates: number[],
  count: number,
  maxConsecutive: number,
  verseWordCount: number,
  rotationSeed: number
): number[] {
  const chosen = greedyScatter(priorityCandidates, count, maxConsecutive);
  if (chosen.length >= count) return chosen;
  return selectScatteredPositions(verseWordCount, count, maxConsecutive, rotationSeed);
}

// Same guarantee as selectScattered, but tries EVERY never-blanked candidate
// first before letting any already-blanked candidate in - so a repeat only
// happens once fresh candidates genuinely can't fill the round, never
// merely because of where a fresh word happened to land in a single shared
// priority list. Falls back the same way selectScattered does if even
// fresh+used together can't reach `count`.
//
// When there's slack (more fresh candidates than `count` needs), the normal
// spacing-respecting greedy pass picks among them. But when the round needs
// EVERY remaining fresh word just to reach `count` (fresh candidates <=
// count), the scattering cap is skipped entirely and all of them are taken
// as-is - preferring a genuinely fresh word over scattering polish whenever
// the two conflict. This matters because the cap can make a subset
// mathematically un-fillable even though every remaining word is available
// (e.g. 3 of the only remaining fresh words sit at consecutive verse
// positions - at most 2 of them could ever be chosen together while
// honoring the cap, so without this, an avoidable repeat would be forced
// even though nothing was actually scarce).
function selectPreferringFresh(
  freshCandidates: number[],
  usedCandidates: number[],
  count: number,
  maxConsecutive: number,
  verseWordCount: number,
  rotationSeed: number
): number[] {
  const fromFresh =
    freshCandidates.length <= count ? freshCandidates : greedyScatter(freshCandidates, count, maxConsecutive);
  if (fromFresh.length >= count) return fromFresh;

  const withRepeats = greedyScatter(usedCandidates, count, maxConsecutive, fromFresh);
  if (withRepeats.length >= count) return withRepeats;

  return selectScatteredPositions(verseWordCount, count, maxConsecutive, rotationSeed);
}

/**
 * Total turns a run through this session's curve actually takes, given how
 * many extra rounds wrong answers have appended so far - the hook uses this
 * (not the fixed TOTAL_TURNS_FOR_PERFECT_RUN) to know which round is really
 * the last one. `baseTotalTurns` defaults to the non-handcuffs 6-round
 * budget; pass TOTAL_TURNS_WITH_HANDCUFFS for an 8-round curve.
 */
export function getEffectiveTotalTurns(extra: ExtraRoundCounts, baseTotalTurns: number = TOTAL_TURNS_FOR_PERFECT_RUN): number {
  return baseTotalTurns + extra.wordBank + extra.dropdown + extra.fillInBlank;
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

  // See HANDCUFFS_WORD_THRESHOLD/LEGCUFFS_WORD_THRESHOLD and
  // TOTAL_TURNS_WITH_HANDCUFFS/TOTAL_TURNS_WITH_LEGCUFFS's own comments - a
  // longer verse gets a 4th (handcuffs) or 5th (legcuffs) gear piece plus 2
  // more fill-in-blank rounds per tier. Every derivation below
  // (fillInBlankGrowthRoundCount, battleProgress) uses this LOCAL total, not
  // the module-level TOTAL_TURNS_FOR_PERFECT_RUN, so it varies correctly per
  // verse. `includesLegcuffs` implies `includesHandcuffs` since
  // LEGCUFFS_WORD_THRESHOLD > HANDCUFFS_WORD_THRESHOLD.
  const includesHandcuffs = verseWordCount > HANDCUFFS_WORD_THRESHOLD;
  const includesLegcuffs = verseWordCount > LEGCUFFS_WORD_THRESHOLD;
  const totalTurnsForPerfectRun = includesLegcuffs
    ? TOTAL_TURNS_WITH_LEGCUFFS
    : includesHandcuffs
      ? TOTAL_TURNS_WITH_HANDCUFFS
      : TOTAL_TURNS_FOR_PERFECT_RUN;
  // See BATTLE_PROGRESS's own doc comment for the full derivation - this is
  // the same formula, just computed against this verse's own total turns
  // instead of the fixed 6-round default.
  const battleProgress: BattleProgressConfig = {
    correctAnswerGain: 200 / (totalTurnsForPerfectRun + 1),
    setbackRatio: 0.5,
  };

  // Every significant word (language-agnostic - see isSignificantWord) is a
  // candidate for word-bank/dropdown/fill-in-blank blanks, for every verse
  // and every language alike - no hardcoded, verse-specific vocabulary list.
  // If a round needs more than this pool has (rare - a very short verse),
  // selectImportantWords/selectFillInBlankWords below already fall back to
  // pulling from the FULL word range via selectScatteredPositions.
  const importantIndices: number[] = [];
  words.forEach((w, i) => {
    if (isSignificantWord(w.value)) importantIndices.push(i);
  });
  const importantSet = new Set(importantIndices);
  // Last resort (a very short verse with no significant words at all): any
  // word counts as "important".
  if (importantIndices.length === 0) {
    words.forEach((_, i) => importantIndices.push(i));
  }

  const dropdownStartCount = Math.min(DROPDOWN_START_COUNT, importantIndices.length);

  // Every word NOT already counted as significant - the "rest of the verse"
  // tier that a round only reaches once it's used up every never-blanked
  // significant word.
  const remainingWords = words.map((_, i) => i).filter((i) => !importantSet.has(i));

  // Builds a round's blank candidates as two pools, each internally ordered
  // significant-first then the rest (shuffled/rotated by `seed`, so retries
  // still vary within a pool, same purpose as the old per-function rotation
  // this replaces): `fresh` (never blanked this battle) and `used` (already
  // blanked). Handed to selectPreferringFresh, which exhausts `fresh`
  // entirely - respecting the scattering cap - before ever touching `used`,
  // so significant words never repeat before non-significant ones have had
  // their first use (fresh always covers both significant and
  // non-significant before used is even considered).
  function buildBlankCandidates(
    seed: number,
    usedWordIndices: ReadonlySet<number>
  ): { fresh: number[]; used: number[] } {
    const tier = (pool: number[], used: boolean) =>
      rotateArray(shuffle(pool.filter((i) => usedWordIndices.has(i) === used)), seed);
    return {
      fresh: [...tier(importantIndices, false), ...tier(remainingWords, false)],
      used: [...tier(importantIndices, true), ...tier(remainingWords, true)],
    };
  }

  function selectImportantWords(
    roundIndexInPhase: number,
    startCount: number,
    variant: number,
    usedWordIndices: ReadonlySet<number> = new Set()
  ): number[] {
    const count = roundIndexInPhase + startCount;
    const seed = roundIndexInPhase + variant;
    const { fresh, used } = buildBlankCandidates(seed, usedWordIndices);
    return selectPreferringFresh(fresh, used, count, MAX_CONSECUTIVE_BLANKS, verseWordCount, seed);
  }

  function selectFillInBlankWords(
    count: number,
    roundIndexInPhase: number,
    variant: number,
    usedWordIndices: ReadonlySet<number> = new Set()
  ): number[] {
    const seed = roundIndexInPhase + variant;
    const { fresh, used } = buildBlankCandidates(seed, usedWordIndices);
    return selectPreferringFresh(fresh, used, count, MAX_CONSECUTIVE_BLANKS, verseWordCount, seed);
  }

  const fillInBlankStartCount = dropdownStartCount + (DROPDOWN_ROUND_COUNT - 1);
  const fillInBlankGrowthRoundCount = Math.max(
    1,
    totalTurnsForPerfectRun - WORD_BANK_ROUND_COUNT - DROPDOWN_ROUND_COUNT - 2
  );

  // The fill-in-blank count for growth-phase index `index` (0-based within
  // that phase) - steps by 2 words every round, uncapped, right up to the
  // last growth round; the round after that blanks every remaining word at
  // once (full recall) regardless of where this count left off.
  function fillInBlankCountForIndex(index: number): number {
    const count = fillInBlankStartCount + 2 * (index + 1);
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
   *
   * `usedWordIndices` is every word index blanked in an earlier challenge
   * this battle - WORD_BANK/DROPDOWN/FILL_IN_BLANK prefer words not in this
   * set (see buildBlankCandidates), only repeating one once every word in
   * the verse has been blanked at least once. Defaults to empty so existing
   * callers (tests, the next-round prefetch peek) are unaffected.
   */
  function getRoundConfig(
    roundNumber: number,
    variant = 0,
    extra: ExtraRoundCounts = NO_EXTRA_ROUNDS,
    usedWordIndices: ReadonlySet<number> = new Set()
  ): SilencerBattleRoundConfig {
    const wordBankRoundCount = WORD_BANK_ROUND_COUNT + extra.wordBank;
    const dropdownRoundCount = DROPDOWN_ROUND_COUNT + extra.dropdown;
    const fillInBlankGrowthCount = fillInBlankGrowthRoundCount + extra.fillInBlank;

    if (roundNumber < wordBankRoundCount) {
      return {
        challengeType: 'WORD_BANK',
        blankWordIndices: selectImportantWords(roundNumber, WORD_BANK_START_COUNT, variant, usedWordIndices),
        temptationLine: SILENCER_BATTLE_TEMPTATION_LINES.wordBank,
        tier: 'wordBank',
      };
    }

    const dropdownRoundIndex = roundNumber - wordBankRoundCount;
    if (dropdownRoundIndex < dropdownRoundCount) {
      return {
        challengeType: 'DROPDOWN',
        blankWordIndices: selectImportantWords(dropdownRoundIndex, dropdownStartCount, variant, usedWordIndices),
        temptationLine: SILENCER_BATTLE_TEMPTATION_LINES.dropdown,
        tier: 'dropdown',
      };
    }

    const roundIndexInPhase = dropdownRoundIndex - dropdownRoundCount;
    if (roundIndexInPhase < fillInBlankGrowthCount) {
      return {
        challengeType: 'FILL_IN_BLANK',
        blankWordIndices: selectFillInBlankWords(
          fillInBlankCountForIndex(roundIndexInPhase),
          roundIndexInPhase,
          variant,
          usedWordIndices
        ),
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

  return { getRoundConfig, totalTurnsForPerfectRun, battleProgress, includesHandcuffs, includesLegcuffs };
}
