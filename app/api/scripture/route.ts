import { NextRequest } from 'next/server';
import { referenceToUSFM } from '../../../utils/scriptureReference';

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

  const passageId = referenceToUSFM(reference);
  if (!passageId) {
    return Response.json({ error: `Could not parse reference "${reference}".` }, { status: 400 });
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
      return Response.json(
        { error: `YouVersion API responded with ${upstream.status}.` },
        { status: upstream.status }
      );
    }

    const data = await upstream.json();
    const text = typeof data.content === 'string' ? data.content.trim() : '';

    if (!text) {
      return Response.json({ error: 'YouVersion API returned no verse content.' }, { status: 502 });
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
