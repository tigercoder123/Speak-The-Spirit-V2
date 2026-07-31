import type { GearPieceInfo, WrongAnswerMoment } from '../config/silencerBattleRounds';
import { generateSilencerWrongAnswerMoment } from '../app/actions/gloo';
import { addLog as emitGameLog } from '../utils/gameEvents';
import { truncateWords } from '../utils/truncateWords';

// Same headroom as services/responseChoicesService.ts - see that file for why
// 6s was too tight against Gloo's normal ~6-15s response times.
const GENERATION_TIMEOUT_MS = 11000;

function timeoutAfter(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Wrong-answer moment generation timed out after ${ms}ms`)), ms);
  });
}

/**
 * Generates the Silencer's gloating line for a wrong-answer moment together
 * with the Songbeast's own doubtful thought-bubble reply to it, via Gloo -
 * both in a single call (see app/actions/gloo.ts's
 * generateSilencerWrongAnswerMoment). Falls back to the caller-supplied
 * static per-tier line/thought (see SILENCER_BATTLE_WRONG_ANSWER_LINES /
 * SILENCER_BATTLE_WRONG_ANSWER_THOUGHTS in config/silencerBattleRounds.ts)
 * if the call errors, returns an incomplete shape, or doesn't resolve
 * within GENERATION_TIMEOUT_MS. Always resolves - callers never need their
 * own try/catch or timeout handling, and the setback beat is never blocked
 * waiting on this.
 */
export async function getFreshWrongAnswerMoment(
  gearPiece: GearPieceInfo,
  fallbackLine: string,
  fallbackThought: string
): Promise<WrongAnswerMoment> {
  try {
    const result = await Promise.race([
      generateSilencerWrongAnswerMoment(gearPiece.name, gearPiece.description),
      timeoutAfter(GENERATION_TIMEOUT_MS),
    ]);

    if ('error' in result || !result.silencerLine || !result.songbeastThought) {
      throw new Error('error' in result ? result.error : 'Gloo returned an incomplete response.');
    }

    return {
      line: `"${result.silencerLine.trim()}"`,
      thought: truncateWords(result.songbeastThought.trim()),
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    emitGameLog(`Wrong-answer moment generation failed, using default: ${message}`, 'system');
    return { line: fallbackLine, thought: fallbackThought };
  }
}
