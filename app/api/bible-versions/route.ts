import { NextRequest } from 'next/server';

const YOUVERSION_BASE_URL = 'https://api.youversion.com/v1';

// Runs server-side only so YOUVERSION_API_KEY (no NEXT_PUBLIC_ prefix) never
// reaches the browser bundle - mirrors app/api/scripture/route.ts's own
// reasoning. This route exists specifically so
// services/bibleVersionsService.ts's live catalog lookup (which languages'
// translations are actually available) doesn't need its own separate
// client-exposed key at all; it was previously trying to call YouVersion
// directly from the browser with NEXT_PUBLIC_YOUVERSION_API_KEY, which was
// never configured, so that lookup always failed and silently fell through
// to the hardcoded FALLBACK_VERSIONS list every time.
export async function GET(request: NextRequest) {
  const languageCode = request.nextUrl.searchParams.get('language');
  if (!languageCode) {
    return Response.json({ error: 'Missing "language" query param.' }, { status: 400 });
  }

  const apiKey = process.env.YOUVERSION_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'YouVersion API key is not configured.' }, { status: 500 });
  }

  // language_ranges[] is an array-style query param on YouVersion's side -
  // the bare `language_ranges` key 422s with "Field required". Intentionally
  // small page size to avoid an oversized payload, same as before.
  const queryParams = new URLSearchParams({
    'language_ranges[]': languageCode,
    page: '1',
    size: '20',
  });

  try {
    const upstream = await fetch(`${YOUVERSION_BASE_URL}/bibles?${queryParams.toString()}`, {
      headers: { 'X-YVP-App-Key': apiKey, Accept: 'application/json' },
    });

    if (!upstream.ok) {
      return Response.json({ error: `YouVersion API responded with ${upstream.status}.` }, { status: upstream.status });
    }

    const data = await upstream.json();
    return Response.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: `Failed to reach YouVersion API: ${message}` }, { status: 502 });
  }
}
