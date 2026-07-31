import type { GearPieceInfo, ResponseChoicesResult } from '../config/silencerBattleRounds';
import { SILENCER_BATTLE_CHOICE_THOUGHTS, SILENCER_BATTLE_RESPONSES } from '../config/silencerBattleRounds';
import { generateSilencerResponseChoices } from '../app/actions/gloo';
import { addLog as emitGameLog } from '../utils/gameEvents';
import { truncateWords } from '../utils/truncateWords';

// How long to give Gloo before giving up and using the static fallback lines.
// The other Gloo calls in app/actions/gloo.ts observe 12-15s response times
// as normal, not exceptional, so this needs real headroom - too short and
// the fallback becomes the common case instead of the rare one. Still
// bounded so a genuinely broken call can't hang the CHOICE screen forever.
const GENERATION_TIMEOUT_MS = 11000;

function timeoutAfter(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Response generation timed out after ${ms}ms`)), ms);
  });
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
  verseText: string
): Promise<ResponseChoicesResult> {
  try {
    const result = await Promise.race([
      generateSilencerResponseChoices(gearPiece.name, gearPiece.description, gearPiece.lie, verseReference, verseText),
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
    return { options: SILENCER_BATTLE_RESPONSES, reactions: SILENCER_BATTLE_CHOICE_THOUGHTS };
  }
}
