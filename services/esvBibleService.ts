import type { ParsedScriptureReference } from '../utils/scriptureReference';

// Reserved negative id for the ESV - served directly from api.esv.org rather
// than through YouVersion. Sits alongside the locally-bundled translations'
// own negative ids (see services/localBibleService.ts and
// services/bibleVersionsService.ts's BibleVersion.source).
export const ESV_BIBLE_ID = -3;

export function isEsvBibleId(bibleId: number): boolean {
  return bibleId === ESV_BIBLE_ID;
}

export interface EsvVerseResult {
  text: string;
}
export interface EsvVerseError {
  error: string;
}

/**
 * Looks up verse text from the ESV API (api.esv.org) - never goes through
 * YouVersion. Headings/footnotes/verse numbers/copyright text are all
 * suppressed via query params so the response is just the passage text,
 * matching how every other translation's text renders elsewhere in the app.
 */
export async function getEsvVerseText(parsed: ParsedScriptureReference): Promise<EsvVerseResult | EsvVerseError> {
  const apiKey = process.env.ESV_API_KEY;
  if (!apiKey) {
    return { error: 'ESV API key is not configured.' };
  }

  const { bookInput, chapter, verse, verseEnd, chapterEnd } = parsed;
  const query = verseEnd === undefined
    ? `${bookInput} ${chapter}:${verse}`
    : chapterEnd !== undefined && chapterEnd !== chapter
      ? `${bookInput} ${chapter}:${verse}-${chapterEnd}:${verseEnd}`
      : `${bookInput} ${chapter}:${verse}-${verseEnd}`;

  const params = new URLSearchParams({
    q: query,
    'include-headings': 'false',
    'include-footnotes': 'false',
    'include-verse-numbers': 'false',
    'include-short-copyright': 'false',
    'include-passage-horizontal-lines': 'false',
    'include-passage-references': 'false',
    'include-selahs': 'false',
    'indent-paragraphs': '0',
  });

  try {
    const upstream = await fetch(`https://api.esv.org/v3/passage/text/?${params.toString()}`, {
      headers: { Authorization: `Token ${apiKey}` },
    });

    if (!upstream.ok) {
      return { error: `ESV API responded with ${upstream.status}.` };
    }

    const data = await upstream.json();
    // The API still leaves paragraph-break newlines inside/around each
    // passage even with every include-* flag off - collapse them to single
    // spaces so multi-verse ranges read as one continuous line, same as
    // every other translation's text elsewhere in the app.
    const text = Array.isArray(data.passages)
      ? data.passages.join(' ').replace(/\s+/g, ' ').trim()
      : '';
    if (!text) {
      return { error: `Couldn't find "${bookInput} ${chapter}:${verse}" in the ESV.` };
    }
    return { text };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: `Failed to reach ESV API: ${message}` };
  }
}
