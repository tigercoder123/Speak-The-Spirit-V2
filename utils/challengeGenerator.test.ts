import { describe, it, expect } from 'vitest';
import {
  tokenizeVerseWords,
  isSignificantWord,
  generateChallenge,
  checkAnswers,
  type ChallengeSegment,
  type DistractorLookup,
} from './challengeGenerator';

// Two real, differently-worded translations of Hebrews 11:1 with different
// word counts (15 vs 17 words) - proves generation never assumes fixed
// wording or a fixed word count for a specific translation.
const KJV_TEXT = 'Now faith is the substance of things hoped for, the evidence of things not seen.';
const NIV_TEXT = 'Now faith is confidence in what we hope for and assurance about what we do not see.';

const NO_DISTRACTORS: DistractorLookup = { forWord: () => [] };

function blanksOf(segments: ChallengeSegment[]) {
  return segments.filter((s): s is Extract<ChallengeSegment, { kind: 'blank' }> => s.kind === 'blank');
}

describe('tokenizeVerseWords', () => {
  it('splits KJV wording into words whose offsets slice back to themselves', () => {
    const tokens = tokenizeVerseWords(KJV_TEXT);
    expect(tokens.length).toBe(15);
    expect(tokens[0].value).toBe('Now');
    expect(tokens[4].value).toBe('substance');
    for (const t of tokens) {
      expect(KJV_TEXT.slice(t.start, t.end)).toBe(t.value);
    }
  });

  it('splits NIV wording (different word count) into words whose offsets slice back to themselves', () => {
    const tokens = tokenizeVerseWords(NIV_TEXT);
    expect(tokens.length).toBe(17);
    for (const t of tokens) {
      expect(NIV_TEXT.slice(t.start, t.end)).toBe(t.value);
    }
  });

  it('splits accented Latin script (Spanish) into real words instead of vanishing', () => {
    const text = 'Ahora bien, la fe es la garantía de lo que se espera.';
    const tokens = tokenizeVerseWords(text);
    expect(tokens.length).toBe(12);
    expect(tokens[3].value).toBe('fe');
    expect(tokens.some((t) => t.value === 'garantía')).toBe(true);
    for (const t of tokens) {
      expect(text.slice(t.start, t.end)).toBe(t.value);
    }
  });

  it('splits Chinese text into one token per character instead of returning nothing', () => {
    const text = '信就是所望之事的实底。';
    const tokens = tokenizeVerseWords(text);
    // No spaces in Chinese - every non-punctuation character is its own token.
    expect(tokens.length).toBe(text.length - 1);
    expect(tokens.every((t) => t.value.length === 1)).toBe(true);
    for (const t of tokens) {
      expect(text.slice(t.start, t.end)).toBe(t.value);
    }
  });
});

describe('isSignificantWord', () => {
  it('rejects short connective words and accepts longer content words', () => {
    expect(isSignificantWord('the')).toBe(false);
    expect(isSignificantWord('of')).toBe(false);
    expect(isSignificantWord('for')).toBe(false);
    expect(isSignificantWord('faith')).toBe(true);
    expect(isSignificantWord('substance')).toBe(true);
    expect(isSignificantWord('confidence')).toBe(true);
  });
});

describe.each([
  { name: 'KJV', text: KJV_TEXT },
  { name: 'NIV', text: NIV_TEXT },
])('generateChallenge with $name wording', ({ text }) => {
  const words = tokenizeVerseWords(text);

  it('FILL_IN_BLANK: segments reconstruct the original text exactly and blankCount matches', () => {
    const blankIndices = [0, 2, words.length - 1];
    const challenge = generateChallenge(text, 'Hebrews 11:1', blankIndices, 'FILL_IN_BLANK', NO_DISTRACTORS);
    expect(challenge.blankCount).toBe(3);

    const reconstructed = challenge.segments
      .map((s) => (s.kind === 'text' ? s.value : s.answer))
      .join('');
    expect(reconstructed).toBe(text);
  });

  it('DROPDOWN: every blank\'s own answer is included among its shuffled options', () => {
    const distractors: DistractorLookup = { forWord: () => ['xx', 'yy', 'zz'] };
    const challenge = generateChallenge(text, 'Hebrews 11:1', [1, 3], 'DROPDOWN', distractors);
    const blanks = blanksOf(challenge.segments);
    expect(blanks.length).toBe(2);
    for (const b of blanks) {
      expect(b.options).toContain(b.answer);
    }
  });

  it('WORD_BANK: the word bank contains every correct answer plus distractors', () => {
    const distractors: DistractorLookup = { forWord: () => ['bogus'] };
    const challenge = generateChallenge(text, 'Hebrews 11:1', [0, 1], 'WORD_BANK', distractors);
    const blanks = blanksOf(challenge.segments);
    expect(challenge.wordBank).toBeDefined();
    for (const b of blanks) {
      expect(challenge.wordBank).toContain(b.answer);
    }
  });

  it('WHOLE_VERSE: a single blank covers the entire text regardless of its length', () => {
    const challenge = generateChallenge(text, 'Hebrews 11:1', [], 'WHOLE_VERSE', NO_DISTRACTORS);
    expect(challenge.blankCount).toBe(1);
    const [only] = challenge.segments;
    expect(only.kind).toBe('blank');
    if (only.kind === 'blank') expect(only.answer).toBe(text);
  });

  it('checkAnswers: the actual blanked words pass, arbitrary wrong words fail', () => {
    const challenge = generateChallenge(text, 'Hebrews 11:1', [0, 2], 'FILL_IN_BLANK', NO_DISTRACTORS);
    const blanks = blanksOf(challenge.segments);

    const correctAnswers = blanks.map((b) => b.answer);
    expect(checkAnswers(challenge, correctAnswers).correct).toBe(true);

    const wrongResult = checkAnswers(challenge, blanks.map(() => 'definitely-wrong'));
    expect(wrongResult.correct).toBe(false);
    expect(wrongResult.wrongBlankIndices.length).toBe(blanks.length);
  });

  it('checkAnswers is case- and whitespace-insensitive', () => {
    const challenge = generateChallenge(text, 'Hebrews 11:1', [0], 'FILL_IN_BLANK', NO_DISTRACTORS);
    const [blank] = blanksOf(challenge.segments);
    const result = checkAnswers(challenge, [`  ${blank.answer.toUpperCase()}  `]);
    expect(result.correct).toBe(true);
  });
});
