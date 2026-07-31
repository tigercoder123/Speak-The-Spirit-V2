import { generateWordDistractors } from '../app/actions/gloo';
import { addLog as emitGameLog } from '../utils/gameEvents';

// The other Gloo calls in app/actions/gloo.ts observe several-second response
// times as normal - this one's payload is tiny (a couple short words), so it
// doesn't need nearly as much headroom, but still bounded so a genuinely
// stuck call can't hang a WORD_BANK/DROPDOWN round's distractor prefetch.
const GENERATION_TIMEOUT_MS = 9000;

function timeoutAfter(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Distractor generation timed out after ${ms}ms`)), ms);
  });
}

/**
 * Generates `count` wrong-answer options for `word` (in `languageName`,
 * grounded in `verseContext` so they fit this exact verse's vocabulary/theme)
 * via Gloo - used whenever the player's verse language isn't English, since
 * the static DISTRACTOR_BANK (config/silencerBattleRounds.ts) only has
 * English vocabulary and would otherwise mix English wrong answers into an
 * otherwise-foreign-language WORD_BANK/DROPDOWN challenge. Falls back to
 * `fallback` if the call errors, returns nothing usable, or doesn't resolve
 * within the timeout - always resolves, never throws or blocks the caller.
 */
export async function getFreshDistractors(
  word: string,
  languageName: string,
  count: number,
  verseContext: string,
  fallback: string[]
): Promise<string[]> {
  try {
    const result = await Promise.race([
      generateWordDistractors(word, languageName, count, verseContext),
      timeoutAfter(GENERATION_TIMEOUT_MS),
    ]);

    if ('error' in result || !result.distractors || result.distractors.length === 0) {
      throw new Error('error' in result ? result.error : 'Gloo returned no distractors.');
    }

    return result.distractors;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    emitGameLog(`Distractor generation failed for "${word}", using fallback: ${message}`, 'system');
    return fallback;
  }
}
