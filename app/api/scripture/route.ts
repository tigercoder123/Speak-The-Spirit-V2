import { NextRequest } from 'next/server';
import { parseScriptureReference } from '../../../utils/scriptureReference';
import { getLocalVerseText, isLocalBibleId } from '../../../services/localBibleService';
import { getEsvVerseText, isEsvBibleId } from '../../../services/esvBibleService';

// Berean Standard Bible - public domain English translation used as the
// default text source. Override per-request with a ?bibleId= query param.
const DEFAULT_BIBLE_ID = '3034';
const YOUVERSION_BASE_URL = 'https://api.youversion.com/v1';

// Runs server-side only so YOUVERSION_API_KEY (no NEXT_PUBLIC_ prefix) never
// reaches the browser bundle.
export async function GET(request: NextRequest) {
  const reference = request.nextUrl.searchParams.get('reference');
  const bibleId = request.nextUrl.searchParams.get('bibleId') ?? DEFAULT_BIBLE_ID;

  if (!reference) {
    return Response.json({ error: 'Missing "reference" query param.' }, { status: 400 });
  }

  // Book/chapter are validated locally (parseScriptureReference) so those get
  // a specific error message without a round trip. The verse number itself
  // isn't range-checked locally (that'd need a verse-count table for every
  // chapter in the Bible) - a bad verse number instead falls through to
  // YouVersion returning no content below, which we then report as an
  // invalid verse since the book/chapter are already known-good at that point.
  const parsed = parseScriptureReference(reference);
  if (!('usfm' in parsed)) {
    return Response.json({ error: parsed.message }, { status: 400 });
  }
  const { usfm: passageId, bookInput, chapter, verse } = parsed;

  // Negative bibleIds are reserved for locally-bundled translations (see
  // services/bibleVersionsService.ts's BibleVersion.source: 'local') - no
  // YouVersion call at all for these, straight to the bundled JSON lookup.
  const bibleIdNum = Number(bibleId);
  if (isLocalBibleId(bibleIdNum)) {
    const local = getLocalVerseText(bibleIdNum, parsed);
    if ('error' in local) {
      return Response.json({ error: local.error }, { status: 404 });
    }
    return Response.json({
      reference,
      passageId,
      bibleId,
      text: local.text,
    });
  }

  // ESV is served directly from api.esv.org (see services/esvBibleService.ts)
  // rather than through YouVersion, same reasoning as the local branch above.
  if (isEsvBibleId(bibleIdNum)) {
    const esv = await getEsvVerseText(parsed);
    if ('error' in esv) {
      return Response.json({ error: esv.error }, { status: 404 });
    }
    return Response.json({
      reference,
      passageId,
      bibleId,
      text: esv.text,
    });
  }

  // YouVersion's passages endpoint only supports a same-chapter range - a
  // cross-chapter passage id (checked live) 404s no matter how it's
  // formatted. ESV and the local branches above handle it themselves, so
  // only the YouVersion path needs this explicit rejection.
  if (parsed.chapterEnd !== undefined && parsed.chapterEnd !== parsed.chapter) {
    return Response.json(
      { error: `Cross-chapter ranges aren't available for the selected translation — try the ESV translation, or a range within a single chapter.` },
      { status: 400 }
    );
  }

  const apiKey = process.env.YOUVERSION_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'YouVersion API key is not configured.' }, { status: 500 });
  }

  try {
    const upstream = await fetch(
      `${YOUVERSION_BASE_URL}/bibles/${bibleId}/passages/${passageId}?format=text`,
      { headers: { 'X-YVP-App-Key': apiKey } }
    );

    if (!upstream.ok) {
      // A 404 here is ambiguous: it fires both for a genuinely bad verse
      // number AND for a valid reference the selected translation just can't
      // serve (an invalid/inaccessible bibleId, or a translation whose
      // license restricts full-text API delivery) - book/chapter are already
      // known-good at this point, so we can't respond as if a bad verse
      // number were confirmed. Phrased as "couldn't find" rather than
      // "doesn't have" for that reason.
      const message = upstream.status === 404
        ? `Couldn't find "${bookInput} ${chapter}:${verse}" in the selected translation. Double-check the verse number, or try a different translation.`
        : `YouVersion API responded with ${upstream.status}.`;
      return Response.json({ error: message }, { status: upstream.status });
    }

    const data = await upstream.json();
    const text = typeof data.content === 'string' ? data.content.trim() : '';

    if (!text) {
      return Response.json(
        { error: `Couldn't find "${bookInput} ${chapter}:${verse}" in the selected translation. Double-check the verse number, or try a different translation.` },
        { status: 404 }
      );
    }

    return Response.json({
      reference: data.reference ?? reference,
      passageId,
      bibleId,
      text,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: `Failed to reach YouVersion API: ${message}` }, { status: 502 });
  }
}
