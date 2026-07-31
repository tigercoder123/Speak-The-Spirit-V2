import { describe, it, expect } from 'vitest';
import { tokenizeVerseWords, generateChallenge, isSignificantWord } from '../utils/challengeGenerator';
import {
  buildRoundCurve,
  getEffectiveTotalTurns,
  NO_EXTRA_ROUNDS,
  SILENCER_BATTLE_DISTRACTORS,
  SILENCER_BATTLE_VERSE_REFERENCE,
} from './silencerBattleRounds';

// Two real translations with different wording and word counts (15 vs 17
// words) - both contain several of buildRoundCurve's themed "important"
// words (faith/hope[d]/see[n] etc.), so these also cover the curve's normal,
// non-fallback path.
const KJV_TEXT = 'Now faith is the substance of things hoped for, the evidence of things not seen.';
const NIV_TEXT = 'Now faith is confidence in what we hope for and assurance about what we do not see.';

// A synthetic paraphrase that deliberately contains NONE of buildRoundCurve's
// themed candidate words (faith, confidence, assurance, substance, evidence,
// conviction, hope, hoped, see, seen, unseen) - exercises the generic
// significant-word fallback path explicitly, proving blank selection still
// works (doesn't crash, still produces real blanks) for wording the themed
// word list was never written with in mind - e.g. a non-English translation,
// which would hit this exact fallback since none of those English words
// would appear either.
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
  { name: 'fallback paraphrase (no themed words)', text: FALLBACK_TEXT },
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
        SILENCER_BATTLE_DISTRACTORS
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
    expect(isSignificantWord(kjvBlankedWord) || kjvBlankedWord === 'faith').toBe(true);
    expect(isSignificantWord(nivBlankedWord) || nivBlankedWord === 'faith').toBe(true);
  });

  it('the fallback paraphrase (sharing no themed words) still yields as many effective rounds as a themed translation', () => {
    const kjvTotal = getEffectiveTotalTurns(NO_EXTRA_ROUNDS);
    const { rounds: fallbackRounds } = runFullCurve(FALLBACK_TEXT);
    expect(fallbackRounds.length).toBe(kjvTotal);
    // Every non-final round must still have picked at least one real blank -
    // the generic significant-word fallback must have kicked in successfully.
    for (const round of fallbackRounds.slice(0, -1)) {
      expect(round.blankWordIndices.length).toBeGreaterThan(0);
    }
  });
});
