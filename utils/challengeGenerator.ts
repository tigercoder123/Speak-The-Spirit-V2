// Challenge types are behind a common interface so new types can be added
// later without touching the generator's callers or the rendering
// components - they only ever look at `segments`/`blanks`/`wordBank`.
//
// Which word POSITIONS get blanked (the difficulty curve) is decided by
// config/silencerBattleRounds.ts, not here - this file only turns an
// already-chosen list of blank word-indices into a renderable Challenge, and
// validates submitted answers against it. Keeping that split means retuning
// the difficulty curve never touches this file, and adding a new challenge
// type never touches the round config.
export type ChallengeType = 'FILL_IN_BLANK' | 'DROPDOWN' | 'WORD_BANK' | 'WHOLE_VERSE';

export type ChallengeSegment =
  | { kind: 'text'; value: string }
  | { kind: 'blank'; blankIndex: number; answer: string; options?: string[] };

export interface Challenge {
  type: ChallengeType;
  reference: string;
  segments: ChallengeSegment[];
  blankCount: number;
  /** Present only for WORD_BANK challenges - every draggable word (correct answers + distractors), shuffled. */
  wordBank?: string[];
}

export interface WordToken {
  value: string;
  start: number;
  end: number;
}

const STOPWORDS = new Set([
  'the', 'and', 'that', 'which', 'for', 'are', 'was', 'were', 'with', 'this',
  'but', 'not', 'shall', 'have', 'has', 'had', 'will', 'would', 'could',
  'should', 'from', 'they', 'them', 'their', 'his', 'her', 'you', 'your',
  'unto', 'upon', 'into', 'than',
]);

/** Splits verse text into words with their exact character offsets - position-
 * based (not string-based) so repeated words can be blanked independently per
 * occurrence instead of every instance of a word sharing one blank.
 *
 * Unicode-aware (not ASCII-only) so accented Latin scripts (Spanish, French,
 * German, Vietnamese, Tagalog, ...) and Hangul (Korean) - all space-delimited
 * like English - tokenize into real words instead of vanishing entirely.
 * Han ideographs (Chinese, and Japanese Kanji) have no spaces between
 * "words" at all, so each character is matched as its own token - the first
 * alternative below (a lone Han char) is tried before the general run-of-
 * letters alternative, otherwise the run would just swallow a whole Han
 * sentence as one unbreakable "word". */
export function tokenizeVerseWords(text: string): WordToken[] {
  const tokens: WordToken[] = [];
  const regex = /\p{Script=Han}|[\p{L}'-]+/gu;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    tokens.push({ value: match[0], start: match.index, end: match.index + match[0].length });
  }
  return tokens;
}

/** A word worth blanking: long enough to be meaningful and not a common
 * connective. Exported so the round config's important-word selection (see
 * config/silencerBattleRounds.ts's buildRoundCurve) and this file's own
 * buildFallbackDistractors below share the same bar - language-agnostic, so
 * it works the same for every verse/translation instead of relying on a
 * hardcoded, verse-specific vocabulary list. */
export function isSignificantWord(word: string): boolean {
  // A single Han ideograph (Chinese, Kanji) already carries independent
  // meaning, unlike a single Latin letter - the length>=4 bar below is tuned
  // for space-delimited Latin words and would reject every Han token
  // (tokenizeVerseWords splits Han text one character at a time).
  if (/^\p{Script=Han}+$/u.test(word)) return true;
  return word.length >= 4 && !STOPWORDS.has(word.toLowerCase());
}

function shuffle<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

/**
 * Builds plausible-but-wrong distractor options for `answer` by borrowing
 * OTHER significant words already present in the SAME verse - works
 * identically regardless of language/script, needs no hardcoded vocabulary
 * or translation, and is always instantly available (no network call). Used
 * as the last-resort fallback (see services/distractorService.ts and
 * hooks/useSilencerBattle.ts) whenever a fresh Gloo-generated distractor
 * isn't ready in time, now that WORD_BANK/DROPDOWN distractors are
 * Gloo-generated for every language, including English.
 *
 * Prefers other SIGNIFICANT words first (closer in "weight" to a real
 * answer than a stray "the"/"and"), padding with any other word in the
 * verse if there simply aren't enough significant ones (a very short verse) -
 * returns fewer than `count` rather than erroring if the verse still can't
 * supply enough distinct options.
 */
export function buildFallbackDistractors(words: WordToken[], answer: string, count: number): string[] {
  const answerLower = answer.toLowerCase();
  const seen = new Set<string>([answerLower]);

  const uniqueOtherWords = (predicate: (value: string) => boolean): string[] =>
    words
      .map((w) => w.value)
      .filter((value) => {
        const lower = value.toLowerCase();
        if (seen.has(lower) || !predicate(value)) return false;
        seen.add(lower);
        return true;
      });

  const significantOthers = shuffle(uniqueOtherWords(isSignificantWord));
  if (significantOthers.length >= count) return significantOthers.slice(0, count);

  const anyOthers = shuffle(uniqueOtherWords(() => true));
  return [...significantOthers, ...anyOthers].slice(0, count);
}

/** Looks up plausible wrong options for a blanked word. Implemented by the
 * round config (which owns the actual word/distractor data) and handed in
 * here so this file never needs to know which verse or translation is active. */
export interface DistractorLookup {
  forWord: (answer: string) => string[];
}

function buildSegments(
  words: WordToken[],
  verseText: string,
  blankWordIndices: number[]
): { segments: ChallengeSegment[]; answers: string[] } {
  const blankSet = new Set(blankWordIndices);
  // blankIndex (used for answers[]/challenge segment ordering) is assigned by
  // READING ORDER of the blanked words, not the order blankWordIndices was
  // given in - keeps answers stable and easy to reason about.
  const orderedBlankWordIndices = [...blankSet].sort((a, b) => a - b);
  const blankIndexForWordIndex = new Map<number, number>();
  orderedBlankWordIndices.forEach((wordIndex, i) => blankIndexForWordIndex.set(wordIndex, i));

  const segments: ChallengeSegment[] = [];
  const answers: string[] = [];
  let cursor = 0;

  words.forEach((word, wordIndex) => {
    if (word.start > cursor) {
      segments.push({ kind: 'text', value: verseText.slice(cursor, word.start) });
    }
    if (blankSet.has(wordIndex)) {
      const blankIndex = blankIndexForWordIndex.get(wordIndex)!;
      answers[blankIndex] = word.value;
      segments.push({ kind: 'blank', blankIndex, answer: word.value });
    } else {
      segments.push({ kind: 'text', value: word.value });
    }
    cursor = word.end;
  });
  if (cursor < verseText.length) {
    segments.push({ kind: 'text', value: verseText.slice(cursor) });
  }

  return { segments, answers };
}

/** Picks `count` misleading words for a word-bank round: pooled from every
 * blanked answer's distractor list, filtered so a distractor never
 * accidentally equals one of this round's own correct answers, deduped, then
 * shuffled. Falls back to fewer than `count` rather than repeating a word if
 * the distractor pool runs dry. */
function pickWordBankDistractors(answers: string[], distractors: DistractorLookup, count: number): string[] {
  const correctLower = new Set(answers.map((a) => a.toLowerCase()));
  const pool = answers
    .flatMap((answer) => distractors.forWord(answer))
    .filter((word) => !correctLower.has(word.toLowerCase()));
  const deduped = [...new Set(pool)];
  return shuffle(deduped).slice(0, count);
}

/** Transforms verse text + which word positions to blank + which challenge
 * type into a fully-formed Challenge. Pure aside from distractor/word-bank
 * shuffling, so it's independent of the UI and easy to unit test. */
export function generateChallenge(
  verseText: string,
  reference: string,
  blankWordIndices: number[],
  type: ChallengeType,
  distractors: DistractorLookup
): Challenge {
  if (type === 'WHOLE_VERSE') {
    // The entire verse is one blank - no per-word segments, since the whole
    // point is that nothing of the verse is shown. VerseParchment renders
    // this as a single textarea rather than laying out segments/inputs inline.
    return {
      type,
      reference,
      segments: [{ kind: 'blank', blankIndex: 0, answer: verseText }],
      blankCount: 1,
    };
  }

  const words = tokenizeVerseWords(verseText);
  const { segments, answers } = buildSegments(words, verseText, blankWordIndices);

  const finalSegments: ChallengeSegment[] = segments.map((segment) => {
    if (segment.kind !== 'blank') return segment;
    if (type !== 'DROPDOWN') return segment;
    const options = shuffle([segment.answer, ...distractors.forWord(segment.answer).slice(0, 3)]);
    return { ...segment, options };
  });

  const challenge: Challenge = { type, reference, segments: finalSegments, blankCount: answers.length };

  if (type === 'WORD_BANK') {
    // One misleading word for a single-blank round, two once there are
    // multiple blanks to fill.
    const distractorCount = answers.length <= 1 ? 1 : 2;
    const wordBankDistractors = pickWordBankDistractors(answers, distractors, distractorCount);
    challenge.wordBank = shuffle([...answers, ...wordBankDistractors]);
  }

  return challenge;
}

export interface ValidationResult {
  correct: boolean;
  /** blankIndex values that didn't match - empty when correct. */
  wrongBlankIndices: number[];
}

/** Canonicalizes quote/apostrophe/dash variants to their plain ASCII form
 * before comparing - browser/OS autocorrect on a typed textarea silently
 * swaps straight quotes/hyphens for curly/typographic ones (and the source
 * verse text from YouVersion may already contain the typographic form), so
 * without this a typed answer can look byte-for-byte identical on screen to
 * a pasted one yet fail the match. */
function normalizeAnswer(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ');
}

/** Exact-match-after-normalize: trim, lowercase, collapse whitespace runs (a
 * whole-verse textarea can pick up stray newlines/double spaces that
 * shouldn't fail the match), and canonicalize quote/dash variants - no fuzzy
 * typo tolerance. Punctuation is otherwise deliberately left untouched: for
 * WHOLE_VERSE challenges it must match exactly. */
export function checkAnswers(challenge: Challenge, answers: string[]): ValidationResult {
  const blanks = challenge.segments.filter(
    (s): s is Extract<ChallengeSegment, { kind: 'blank' }> => s.kind === 'blank'
  );
  const wrongBlankIndices = blanks
    .filter((blank) => normalizeAnswer(answers[blank.blankIndex] ?? '') !== normalizeAnswer(blank.answer))
    .map((blank) => blank.blankIndex);

  return { correct: wrongBlankIndices.length === 0, wrongBlankIndices };
}
