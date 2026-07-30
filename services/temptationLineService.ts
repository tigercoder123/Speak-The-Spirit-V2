import type { GearPieceInfo } from '../config/silencerBattleRounds';
import { generateSilencerTemptationLine } from '../app/actions/gloo';
import { addLog as emitGameLog } from '../utils/gameEvents';

// Same headroom as services/responseChoicesService.ts - see that file for why
// 6s was too tight against Gloo's normal ~6-15s response times.
const GENERATION_TIMEOUT_MS = 11000;

function timeoutAfter(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Temptation line generation timed out after ${ms}ms`)), ms);
  });
}

/**
 * Generates a fresh temptation line for the given gear piece via Gloo,
 * falling back to `fallbackLine` (the caller's static per-tier line - see
 * config/silencerBattleRounds.ts) if the call errors, returns an incomplete
 * shape, or doesn't resolve within GENERATION_TIMEOUT_MS. Always resolves -
 * callers never need their own try/catch or timeout handling. The fallback is
 * passed in rather than owned here since it depends on the current round
 * tier, which only the caller knows.
 */
export async function getFreshTemptationLine(gearPiece: GearPieceInfo, fallbackLine: string): Promise<string> {
  try {
    const result = await Promise.race([
      generateSilencerTemptationLine(gearPiece.name, gearPiece.description),
      timeoutAfter(GENERATION_TIMEOUT_MS),
    ]);

    if ('error' in result || !result.line) {
      throw new Error('error' in result ? result.error : 'Gloo returned no line.');
    }

    return `"${result.line.trim()}"`;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    emitGameLog(`Temptation line generation failed, using default line: ${message}`, 'system');
    return fallbackLine;
  }
}
