import type { GearPieceInfo, ResponseChoicesResult } from '../config/silencerBattleRounds';
import {
  SILENCER_BATTLE_CHOICE_THOUGHTS,
  SILENCER_BATTLE_CHOICE_THOUGHTS_ZH_HEADPHONES,
  SILENCER_BATTLE_REBUTTALS_ZH_HEADPHONES,
  SILENCER_BATTLE_RESPONSES,
  SILENCER_BATTLE_RESPONSES_ZH_HEADPHONES,
} from '../config/silencerBattleRounds';
import { generateSilencerResponseChoices } from '../app/actions/gloo';
import { LANGUAGE_NAMES } from './bibleVersionsService';
import { addLog as emitGameLog } from '../utils/gameEvents';
import { truncateWords } from '../utils/truncateWords';

// This is now purely a worst-case safety net, NOT the primary "give up and
// use the fallback" trigger - that decision instead lives in
// hooks/useSilencerBattle.ts, tied to the player actually submitting a
// correct answer (wait indefinitely while they're still solving, then only
// a further 3s once they've hit Restore) rather than a fixed clock from
// when this fetch started. This just guards against the call never settling
// at all. Matches generateSilencerResponseChoices's own fetch-level abort
// (app/actions/gloo.ts) so neither one "wins" a race against the other -
// they're independent backstops, not a tuned pair.
const GENERATION_TIMEOUT_MS = 60000;

function timeoutAfter(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Response generation timed out after ${ms}ms`)), ms);
  });
}

/**
 * The static, non-Gloo response options/reactions/rebuttals shown whenever a
 * fresh result isn't ready in time - shared so both this file's own timeout
 * catch AND hooks/useSilencerBattle.ts's submit-triggered "give it 3 more
 * seconds, then commit" fallback (see that hook) pick the exact same content
 * for the exact same situation, rather than duplicating the gear/language
 * selection logic in two places. Headphones is the very first correct answer
 * of a battle - the round most likely to still be mid-generation when a
 * fallback is needed - so it gets its own Chinese fallback (options,
 * reactions, AND rebuttals) instead of falling through to the generic
 * English ones, which would jarringly mix languages. Including rebuttals
 * here also means hooks/useSilencerBattle.ts's selectResponse - which
 * already prefers a real rebuttal over the generic tier-based temptation
 * line whenever one is present - picks this up as the Silencer's RESILENCE-
 * beat comeback with no extra plumbing.
 */
export function getStaticResponseChoicesFallback(gearPiece: GearPieceInfo, languageName: string): ResponseChoicesResult {
  if (gearPiece.name === 'headphones' && languageName === LANGUAGE_NAMES.zh) {
    return {
      options: SILENCER_BATTLE_RESPONSES_ZH_HEADPHONES,
      reactions: SILENCER_BATTLE_CHOICE_THOUGHTS_ZH_HEADPHONES,
      rebuttals: SILENCER_BATTLE_REBUTTALS_ZH_HEADPHONES,
    };
  }
  return { options: SILENCER_BATTLE_RESPONSES, reactions: SILENCER_BATTLE_CHOICE_THOUGHTS };
}

/**
 * Generates 3 fresh, tone-varied response lines for the given gear piece via
 * Gloo, grounded in the verse the player is currently memorizing, along with
 * the Songbeast's own matching thought-bubble reaction to each one (see
 * components/battle/ThoughtBubble.tsx) and the Silencer's own matching
 * comeback line - the RESILENCE beat's temptation line, once the player's
 * tone is known (see hooks/useSilencerBattle.ts's selectResponse) - all
 * generated together in the same Gloo call. Falls back to the static config
 * lines/reactions (SILENCER_BATTLE_RESPONSES / SILENCER_BATTLE_CHOICE_THOUGHTS)
 * with no rebuttals if the call errors, returns an incomplete shape, or
 * doesn't resolve within GENERATION_TIMEOUT_MS. Always resolves - callers
 * never need their own try/catch or timeout handling, and the CHOICE screen
 * is never blocked waiting on this.
 */
export async function getFreshResponseChoices(
  gearPiece: GearPieceInfo,
  verseReference: string,
  verseText: string,
  languageName: string
): Promise<ResponseChoicesResult> {
  try {
    const result = await Promise.race([
      generateSilencerResponseChoices(gearPiece.name, gearPiece.description, gearPiece.lie, verseReference, verseText, languageName),
      timeoutAfter(GENERATION_TIMEOUT_MS),
    ]);

    if ('error' in result || !result.lines || !result.reactions || !result.rebuttals) {
      throw new Error('error' in result ? result.error : 'Gloo returned an incomplete response.');
    }

    return {
      options: [
        { tone: 'gentle', label: 'Gentle & Encouraging', message: result.lines.gentle },
        { tone: 'firm', label: 'Firm & Bold', message: result.lines.firm },
        { tone: 'warm', label: 'Warm & Affirming', message: result.lines.warm },
      ],
      reactions: {
        gentle: truncateWords(result.reactions.gentle),
        firm: truncateWords(result.reactions.firm),
        warm: truncateWords(result.reactions.warm),
      },
      rebuttals: {
        gentle: `"${result.rebuttals.gentle.trim()}"`,
        firm: `"${result.rebuttals.firm.trim()}"`,
        warm: `"${result.rebuttals.warm.trim()}"`,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    emitGameLog(`Response generation failed, using default lines: ${message}`, 'system');
    return getStaticResponseChoicesFallback(gearPiece, languageName);
  }
}
