import { generateWordDistractors } from '../app/actions/gloo';
import { addLog as emitGameLog } from '../utils/gameEvents';
import { buildFallbackDistractors, type WordToken } from '../utils/challengeGenerator';

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

export interface DistractorResult {
  distractors: string[];
  /** True when `distractors` is actually `fallback` (the Gloo call errored,
   * timed out, or returned nothing usable) rather than a real generated
   * result. Callers should avoid permanently caching a fallback as if it
   * were a successful translation - that would lock a word into English
   * forever after one transient failure, with no way to ever retry it. */
  usedFallback: boolean;
}

/**
 * Generates `count` wrong-answer options for `word` (in `languageName`,
 * grounded in `verseContext` so they fit this exact verse's vocabulary/theme)
 * via Gloo - used for every language, including English, so word-bank/
 * dropdown distractors are always freshly generated for THIS verse's actual
 * vocabulary rather than a fixed hardcoded set. Falls back to `fallback` if
 * the call errors, returns nothing usable, or doesn't resolve within the
 * timeout - always resolves, never throws or blocks the caller.
 */
export async function getFreshDistractors(
  word: string,
  languageName: string,
  count: number,
  verseContext: string,
  fallback: string[]
): Promise<DistractorResult> {
  try {
    const result = await Promise.race([
      generateWordDistractors(word, languageName, count, verseContext),
      timeoutAfter(GENERATION_TIMEOUT_MS),
    ]);

    if ('error' in result || !result.distractors || result.distractors.length === 0) {
      throw new Error('error' in result ? result.error : 'Gloo returned no distractors.');
    }

    return { distractors: result.distractors, usedFallback: false };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    emitGameLog(`Distractor generation failed for "${word}", using fallback: ${message}`, 'system');
    return { distractors: fallback, usedFallback: true };
  }
}

// Module-level (not per-component) - this cache needs to outlive any single
// round's effect lifecycle, since hooks/useSilencerBattle.ts prefetches the
// NEXT round's words once the CURRENT round's response-choices call
// resolves (see that hook), and reads back from this SAME store whenever a
// later round's challenge is built.
const distractorCache = new Map<string, string[]>();
const pendingDistractorKeys = new Set<string>();

function cacheKeyFor(languageCode: string, word: string): string {
  return `${languageCode}:${word.toLowerCase()}`;
}

/** Synchronous cache read - used by hooks/useSilencerBattle.ts's
 * distractorLookup at whatever moment a challenge happens to be built. */
export function getCachedDistractors(languageCode: string, word: string): string[] | undefined {
  return distractorCache.get(cacheKeyFor(languageCode, word));
}

// At most this many distractor Gloo calls run at once, however many words
// are queued - firing a big batch all at once created a thundering herd
// that competed with (and starved) other concurrent Gloo calls (e.g. the
// CHOICE screen's own response-choices generation), and often caused the
// distractor calls themselves to time out/get rate-limited.
const DISTRACTOR_FETCH_CONCURRENCY = 2;

async function runWithConcurrency<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  let index = 0;
  const lane = async () => {
    while (index < items.length) {
      const item = items[index++];
      await worker(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, lane));
}

/**
 * Fetches (and caches) Gloo distractors for each given word, unless already
 * cached or already in flight - throttled to DISTRACTOR_FETCH_CONCURRENCY at
 * a time. `allWords` is the FULL tokenized verse (not just the words being
 * fetched) - needed so a call that errors/times out can fall back to
 * buildFallbackDistractors (borrowing other real words from this same
 * verse) instead of any hardcoded vocabulary. That fallback result is
 * deliberately left uncached (see DistractorResult.usedFallback above) so a
 * LATER attempt (a Settings save, a fresh battle, a later round needing the
 * same word) can still succeed instead of that one transient failure
 * locking it in for the rest of the session. Fire-and-forget - callers
 * don't need to await this; results simply land in the shared cache
 * whenever they're ready.
 */
export function prefetchDistractors(
  words: string[],
  allWords: WordToken[],
  languageCode: string,
  languageName: string,
  verseText: string
): void {
  const seen = new Set<string>();
  const toFetch: string[] = [];

  words.forEach((word) => {
    const cacheKey = cacheKeyFor(languageCode, word);
    if (distractorCache.has(cacheKey) || pendingDistractorKeys.has(cacheKey) || seen.has(cacheKey)) return;
    seen.add(cacheKey);
    pendingDistractorKeys.add(cacheKey);
    toFetch.push(word);
  });

  runWithConcurrency(toFetch, DISTRACTOR_FETCH_CONCURRENCY, async (word) => {
    const cacheKey = cacheKeyFor(languageCode, word);
    try {
      const { distractors, usedFallback } = await getFreshDistractors(
        word,
        languageName,
        3,
        verseText,
        buildFallbackDistractors(allWords, word, 3)
      );
      if (!usedFallback) distractorCache.set(cacheKey, distractors);
    } finally {
      pendingDistractorKeys.delete(cacheKey);
    }
  });
}
