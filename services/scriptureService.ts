import { addLog as emitGameLog } from '../utils/gameEvents';

export interface VerseData {
  reference: string;
  passageId: string;
  bibleId: string;
  text: string;
}

/**
 * Fetches verse text for a reference (e.g. "Hebrews 11:1") via our own
 * /api/scripture route, which proxies the YouVersion Platform API server-side
 * so the YOUVERSION_API_KEY secret never reaches the browser. `bibleId` is
 * the player's settings-selected translation (see GameContext's
 * bibleVersionId) - omit it to use the route's own default translation.
 */
export async function getVerse(reference: string, bibleId?: number): Promise<VerseData> {
  try {
    const params = new URLSearchParams({ reference });
    if (bibleId !== undefined) params.set('bibleId', String(bibleId));

    const res = await fetch(`/api/scripture?${params.toString()}`);
    const body = await res.json();

    if (!res.ok) {
      throw new Error(body?.error ?? `Failed to fetch verse (status ${res.status}).`);
    }

    return body as VerseData;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    emitGameLog(`Scripture fetch failed: ${message}`, 'system');
    throw err;
  }
}
