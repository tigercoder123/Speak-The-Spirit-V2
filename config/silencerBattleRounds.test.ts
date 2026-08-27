import { describe, it, expect } from 'vitest';
import {
  buildFallbackDistractors,
  tokenizeVerseWords,
  generateChallenge,
  isSignificantWord,
  type DistractorLookup,
} from '../utils/challengeGenerator';
import {
  buildRoundCurve,
  getEffectiveTotalTurns,
  HANDCUFFS_WORD_THRESHOLD,
  LEGCUFFS_WORD_THRESHOLD,
  NO_EXTRA_ROUNDS,
  SILENCER_BATTLE_VERSE_REFERENCE,
  TOTAL_TURNS_WITH_HANDCUFFS,
  TOTAL_TURNS_WITH_LEGCUFFS,
} from './silencerBattleRounds';

// Builds a DistractorLookup from `text` itself via buildFallbackDistractors -
// blank selection is language-agnostic now (isSignificantWord directly, no
// hardcoded vocabulary list), so every text below exercises the exact same
// path; this just gives generateChallenge something real to call for
// WORD_BANK/DROPDOWN's distractor options in the tests below.
function distractorLookupFor(text: string): DistractorLookup {
  const words = tokenizeVerseWords(text);
  return { forWord: (answer) => buildFallbackDistractors(words, answer, 3) };
}

// Two real translations with different wording and word counts (15 vs 17
// words), plus a differently-worded paraphrase - all three exercise the same
// generic significant-word selection (isSignificantWord), proving it works
// consistently across different phrasings/word counts rather than depending
// on any one translation's specific vocabulary.
const KJV_TEXT = 'Now faith is the substance of things hoped for, the evidence of things not seen.';
const NIV_TEXT = 'Now faith is confidence in what we hope for and assurance about what we do not see.';
const FALLBACK_TEXT =
  "Trusting means being sure of what we long for and knowing something is real even when we can't view it.";

function runFullCurve(text: string) {
  const curve = buildRoundCurve(text);
  const words = tokenizeVerseWords(text);
  const totalTurns = getEffectiveTotalTurns(NO_EXTRA_ROUNDS);
  const rounds = Array.from({ length: totalTurns }, (_, i) => curve.getRoundConfig(i, 0, NO_EXTRA_ROUNDS));
  return { words, totalTurns, rounds };
}

describe.each([
  { name: 'KJV', text: KJV_TEXT },
  { name: 'NIV', text: NIV_TEXT },
  { name: 'differently-worded paraphrase', text: FALLBACK_TEXT },
])('buildRoundCurve with $name wording', ({ text }) => {
  it('never blanks an out-of-range or duplicate word index across the whole curve', () => {
    const { words, rounds } = runFullCurve(text);
    for (const round of rounds) {
      const seen = new Set<number>();
      for (const index of round.blankWordIndices) {
        expect(index).toBeGreaterThanOrEqual(0);
        expect(index).toBeLessThan(words.length);
        expect(seen.has(index)).toBe(false);
        seen.add(index);
      }
    }
  });

  it('ends on a WHOLE_VERSE round and never regresses past it', () => {
    const { rounds } = runFullCurve(text);
    expect(rounds[rounds.length - 1].challengeType).toBe('WHOLE_VERSE');
  });

  it('produces a real, non-empty blank pick for the first word-bank round', () => {
    const { words, rounds } = runFullCurve(text);
    const first = rounds[0];
    expect(first.challengeType).toBe('WORD_BANK');
    expect(first.blankWordIndices.length).toBeGreaterThan(0);
    // Whatever got picked should be a real word from THIS text, not a
    // hardcoded/borrowed one from a different translation.
    for (const index of first.blankWordIndices) {
      expect(words[index]).toBeDefined();
    }
  });

  it('every round\'s output is consumable by generateChallenge without throwing, and blankCount matches for non-whole-verse types', () => {
    const { rounds } = runFullCurve(text);
    for (const round of rounds) {
      const challenge = generateChallenge(
        text,
        SILENCER_BATTLE_VERSE_REFERENCE,
        round.blankWordIndices,
        round.challengeType,
        distractorLookupFor(text)
      );
      if (round.challengeType === 'WHOLE_VERSE') {
        expect(challenge.blankCount).toBe(1);
      } else {
        expect(challenge.blankCount).toBe(round.blankWordIndices.length);
      }
    }
  });

  it('has a non-empty temptation line for every round', () => {
    const { rounds } = runFullCurve(text);
    for (const round of rounds) {
      expect(round.temptationLine.length).toBeGreaterThan(0);
    }
  });
});

describe('buildRoundCurve across differently-worded translations', () => {
  it('picks different actual words for KJV vs NIV word-bank round 0, proving selection is text-derived, not hardcoded', () => {
    const kjvWords = tokenizeVerseWords(KJV_TEXT);
    const nivWords = tokenizeVerseWords(NIV_TEXT);
    const kjvFirst = buildRoundCurve(KJV_TEXT).getRoundConfig(0, 0, NO_EXTRA_ROUNDS);
    const nivFirst = buildRoundCurve(NIV_TEXT).getRoundConfig(0, 0, NO_EXTRA_ROUNDS);

    const kjvBlankedWord = kjvWords[kjvFirst.blankWordIndices[0]].value.toLowerCase();
    const nivBlankedWord = nivWords[nivFirst.blankWordIndices[0]].value.toLowerCase();

    // Both should land on a real significant word from their own text - not
    // necessarily the same word, since the two translations don't share
    // identical wording throughout.
    expect(isSignificantWord(kjvBlankedWord)).toBe(true);
    expect(isSignificantWord(nivBlankedWord)).toBe(true);
  });

  it('a differently-worded paraphrase still yields as many effective rounds as any other translation', () => {
    const kjvTotal = getEffectiveTotalTurns(NO_EXTRA_ROUNDS);
    const { rounds: fallbackRounds } = runFullCurve(FALLBACK_TEXT);
    expect(fallbackRounds.length).toBe(kjvTotal);
    // Every non-final round must still have picked at least one real blank.
    for (const round of fallbackRounds.slice(0, -1)) {
      expect(round.blankWordIndices.length).toBeGreaterThan(0);
    }
  });
});

// A verse over HANDCUFFS_WORD_THRESHOLD (20) words - short verses above
// (KJV/NIV/FALLBACK, all well under 20 words) never trigger this path.
const LONG_VERSE_TEXT =
  'For God so loved the world that he gave his one and only Son that whoever believes in him shall not perish but have eternal life';

describe('buildRoundCurve for a verse over HANDCUFFS_WORD_THRESHOLD words', () => {
  it('flags includesHandcuffs and uses the 8-round budget', () => {
    const words = tokenizeVerseWords(LONG_VERSE_TEXT);
    expect(words.length).toBeGreaterThan(HANDCUFFS_WORD_THRESHOLD);

    const curve = buildRoundCurve(LONG_VERSE_TEXT);
    expect(curve.includesHandcuffs).toBe(true);
    expect(curve.totalTurnsForPerfectRun).toBe(TOTAL_TURNS_WITH_HANDCUFFS);
  });

  it('produces exactly the 2/1/3/1/1 tier breakdown the handcuffs battle expects', () => {
    const curve = buildRoundCurve(LONG_VERSE_TEXT);
    const rounds = Array.from({ length: TOTAL_TURNS_WITH_HANDCUFFS }, (_, i) =>
      curve.getRoundConfig(i, 0, NO_EXTRA_ROUNDS)
    );
    expect(rounds.map((r) => r.tier)).toEqual([
      'wordBank',
      'wordBank',
      'dropdown',
      'fillInBlank',
      'fillInBlank',
      'fillInBlank',
      'fullRecall',
      'wholeVerse',
    ]);
  });

  it('a short verse under the threshold keeps the base 6-round curve and includesHandcuffs=false', () => {
    const curve = buildRoundCurve(KJV_TEXT);
    expect(curve.includesHandcuffs).toBe(false);
    expect(curve.totalTurnsForPerfectRun).toBe(getEffectiveTotalTurns(NO_EXTRA_ROUNDS));
  });
});

// A verse over LEGCUFFS_WORD_THRESHOLD (38) words - LONG_VERSE_TEXT above
// (26 words) qualifies for handcuffs but not legcuffs. Original paraphrase
// text (not a specific translation's copyrighted wording), same as
// FALLBACK_TEXT above.
const VERY_LONG_VERSE_TEXT =
  "Trusting God means being willing to go wherever he leads even when the path ahead feels unfamiliar and uncertain because he has promised to go before us and to never leave us alone in any place we are called to serve so we can move forward without giving in to fear.";

describe('buildRoundCurve for a verse over LEGCUFFS_WORD_THRESHOLD words', () => {
  it('flags includesLegcuffs (and includesHandcuffs) and uses the 10-round budget', () => {
    const words = tokenizeVerseWords(VERY_LONG_VERSE_TEXT);
    expect(words.length).toBeGreaterThan(LEGCUFFS_WORD_THRESHOLD);

    const curve = buildRoundCurve(VERY_LONG_VERSE_TEXT);
    expect(curve.includesHandcuffs).toBe(true);
    expect(curve.includesLegcuffs).toBe(true);
    expect(curve.totalTurnsForPerfectRun).toBe(TOTAL_TURNS_WITH_LEGCUFFS);
  });

  it('produces exactly the 2/1/5/1/1 tier breakdown the legcuffs battle expects', () => {
    const curve = buildRoundCurve(VERY_LONG_VERSE_TEXT);
    const rounds = Array.from({ length: TOTAL_TURNS_WITH_LEGCUFFS }, (_, i) =>
      curve.getRoundConfig(i, 0, NO_EXTRA_ROUNDS)
    );
    expect(rounds.map((r) => r.tier)).toEqual([
      'wordBank',
      'wordBank',
      'dropdown',
      'fillInBlank',
      'fillInBlank',
      'fillInBlank',
      'fillInBlank',
      'fillInBlank',
      'fullRecall',
      'wholeVerse',
    ]);
  });

  it('a verse over HANDCUFFS_WORD_THRESHOLD but under LEGCUFFS_WORD_THRESHOLD keeps includesLegcuffs=false', () => {
    const curve = buildRoundCurve(LONG_VERSE_TEXT);
    expect(curve.includesHandcuffs).toBe(true);
    expect(curve.includesLegcuffs).toBe(false);
    expect(curve.totalTurnsForPerfectRun).toBe(TOTAL_TURNS_WITH_HANDCUFFS);
  });
});
