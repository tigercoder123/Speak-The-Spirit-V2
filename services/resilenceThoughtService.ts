import { generateSongbeastResilenceThought } from '../app/actions/gloo';
import { addLog as emitGameLog } from '../utils/gameEvents';
import { truncateWords } from '../utils/truncateWords';

// Same headroom as services/responseChoicesService.ts - see that file for why
// 6s was too tight against Gloo's normal ~6-15s response times.
const GENERATION_TIMEOUT_MS = 11000;

function timeoutAfter(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Resilence thought generation timed out after ${ms}ms`)), ms);
  });
}

/**
 * Generates the muted Songbeast's brief interior thought for the re-silence
 * beat, reacting to the Silencer's own (already-resolved, fresh-or-fallback)
 * temptation line content - falling back to `fallbackThought` (the caller's
 * static per-tier line - see SILENCER_BATTLE_RESILENCE_THOUGHTS in
 * config/silencerBattleRounds.ts) if the call errors, returns an incomplete
 * shape, or doesn't resolve within GENERATION_TIMEOUT_MS. Always resolves -
 * callers never need their own try/catch or timeout handling. The fallback is
 * passed in rather than owned here since it depends on the current round
 * tier, which only the caller knows.
 */
export async function getFreshResilenceThought(temptationLineContent: string, fallbackThought: string): Promise<string> {
  try {
    const result = await Promise.race([
      generateSongbeastResilenceThought(temptationLineContent),
      timeoutAfter(GENERATION_TIMEOUT_MS),
    ]);

    if ('error' in result || !result.thought) {
      throw new Error('error' in result ? result.error : 'Gloo returned no thought.');
    }

    return truncateWords(result.thought.trim());
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    emitGameLog(`Songbeast re-silence thought generation failed, using default: ${message}`, 'system');
    return fallbackThought;
  }
}
