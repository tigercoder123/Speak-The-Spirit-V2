// Shared between OnboardingFlow.tsx (first-time language/translation pick)
// and SettingsModal.tsx (changing it later) - both need the exact same
// language list and the exact same YouVersion-backed lookup, so the two
// flows can never drift into offering different translations for the same
// language.

export interface BibleVersion {
  id: number;
  abbreviation: string;
  title: string;
  language_tag: string;
  /** Set on translations that don't come from the YouVersion catalog at all:
   * 'local' for bundled data (see bibles/ at the project root -
   * cuv_simplified.json/cuv_traditional.json), 'esv' for the ESV, served
   * live from api.esv.org (see services/esvBibleService.ts). `id` is
   * negative for every such entry, on purpose - real YouVersion ids are
   * always positive, so these ids can never collide with (or be mistaken
   * for) a real catalog one. app/api/scripture/route.ts branches on a
   * negative bibleId before it ever makes a YouVersion call. */
  source?: 'local' | 'esv';
}

export const LANGUAGE_OPTIONS: { code: string; label: string }[] = [
  { code: 'en', label: 'English 🇺🇸' },
  { code: 'es', label: 'Español 🇪🇸' },
  { code: 'fr', label: 'Français 🇫🇷' },
  { code: 'pt', label: 'Português 🇵🇹' },
  { code: 'ko', label: '한국어 🇰🇷' },
  { code: 'zh', label: '简体中文 🇨🇳' },
  { code: 'zh-TW', label: '繁體中文 🇹🇼' },
  { code: 'de', label: 'Deutsch 🇩🇪' },
  { code: 'tl', label: 'Tagalog 🇵🇭' },
  { code: 'vi', label: 'Tiếng Việt 🇻🇳' },
  { code: 'ja', label: '日本語 🇯🇵' },
];

// Plain English language names, keyed the same as LANGUAGE_OPTIONS's codes -
// used when prompting Gloo (see app/actions/gloo.ts's generateWordDistractors)
// rather than that list's flag-emoji/native-script labels, which aren't a
// clean instruction for the model.
export const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  pt: 'Portuguese',
  ko: 'Korean',
  zh: 'Simplified Chinese',
  'zh-TW': 'Traditional Chinese',
  de: 'German',
  tl: 'Tagalog',
  vi: 'Vietnamese',
  ja: 'Japanese',
};

// Every entry below is verified directly against the live YouVersion catalog
// and a live passage fetch (GET /v1/bibles/{id}/passages/HEB.11.4) - the
// PREVIOUS version of this whole list was fabricated/guessed rather than
// checked against the real catalog, and most of it was actually broken:
// only 1 of English's 4 IDs worked (the rest 404'd), Spanish/Korean/
// Tagalog/Vietnamese had ZERO working IDs (100% 404), German's first entry
// returned Filipino text under a "Luther Bibel" label, and French/
// Portuguese/Japanese each had one dead ID alongside one real one. This
// list only has translations this API key can actually serve.
const FALLBACK_VERSIONS: Record<string, BibleVersion[]> = {
  en: [
    { id: 3034, abbreviation: 'BSB', title: 'Berean Standard Bible', language_tag: 'en' },
    { id: 111, abbreviation: 'NIV', title: 'New International Version 2011', language_tag: 'en' },
    { id: 12, abbreviation: 'ASV', title: 'American Standard Version', language_tag: 'en' },
    { id: 206, abbreviation: 'WEB', title: 'World English Bible', language_tag: 'en' },
    // Not in YouVersion's catalog under this API key - served live from
    // api.esv.org instead (see BibleVersion.source above).
    { id: -3, abbreviation: 'ESV', title: 'English Standard Version', language_tag: 'en', source: 'esv' },
  ],
  es: [
    { id: 89, abbreviation: 'LBLA', title: 'La Biblia de las Américas', language_tag: 'es' },
    { id: 103, abbreviation: 'NBLA', title: 'Nueva Biblia de las Américas', language_tag: 'es' },
  ],
  fr: [
    { id: 93, abbreviation: 'LSG', title: 'Bible Segond 1910', language_tag: 'fr' },
    { id: 21, abbreviation: 'BDS', title: 'La Bible du Semeur', language_tag: 'fr' },
  ],
  pt: [
    { id: 129, abbreviation: 'NVI', title: 'Nova Versão Internacional - Português', language_tag: 'pt' },
    { id: 4360, abbreviation: 'NVI2011', title: 'Nova Versão Internacional 2011 (Brazilian Portuguese)', language_tag: 'pt' },
  ],
  // Only one Korean translation is actually available in this API key's
  // catalog - both previous entries here (KRV, "KLB" id 142) 404'd.
  ko: [
    { id: 86, abbreviation: 'KLB', title: 'Korean Living Bible 1985', language_tag: 'ko' },
  ],
  zh: [
    { id: 36, abbreviation: 'CCB', title: 'Chinese Contemporary Bible 2022 (Simplified)', language_tag: 'zh' },
    { id: 43, abbreviation: 'CSBS', title: 'Chinese Standard Bible (Simplified Script)', language_tag: 'zh' },
    // Locally-bundled data (bibles/cuv_simplified.json) - not from
    // YouVersion's catalog, which has no Chinese Union Version available to
    // this API key at all (confirmed live: total_size 3 for the whole
    // language). See BibleVersion.source's own comment.
    { id: -1, abbreviation: 'CUVS', title: 'Chinese Union Version (Simplified)', language_tag: 'zh', source: 'local' },
  ],
  // Traditional Chinese has no YouVersion-catalog translation available to
  // this API key at all (confirmed live: zero results for every Traditional-
  // script language code tried) - this locally-bundled entry
  // (bibles/cuv_traditional.json) is the only option for this language.
  'zh-TW': [
    { id: -2, abbreviation: 'CUVT', title: 'Chinese Union Version (Traditional)', language_tag: 'zh-TW', source: 'local' },
  ],
  de: [
    { id: 73, abbreviation: 'HOF', title: 'Hoffnung für Alle', language_tag: 'de' },
    { id: 51, abbreviation: 'SCH2000', title: 'Schlachter 2000', language_tag: 'de' },
  ],
  tl: [
    { id: 177, abbreviation: 'TLAB', title: 'Ang Biblia', language_tag: 'tl' },
    { id: 1264, abbreviation: 'ASD', title: 'Tagalog Contemporary Bible', language_tag: 'tl' },
  ],
  // Only one Vietnamese translation is actually available in this API key's
  // catalog - both previous entries here 404'd.
  vi: [
    { id: 1638, abbreviation: 'VCB', title: 'Vietnamese Contemporary Bible', language_tag: 'vi' },
  ],
  ja: [
    { id: 83, abbreviation: 'JCB', title: 'Japanese Contemporary Bible', language_tag: 'ja' },
    { id: 81, abbreviation: 'JA1955', title: 'Colloquial Japanese (1955)', language_tag: 'ja' },
  ],
};

const LANGUAGE_TO_YOUVERSION_CODE: Record<string, string> = {
  en: 'eng', es: 'spa', fr: 'fra', pt: 'por', ko: 'kor',
  zh: 'zho', de: 'deu', tl: 'tgl', vi: 'vie', ja: 'jpn',
  // Deliberately NOT 'zho' - confirmed live that returns Simplified-script
  // results (CCB/CSBS/FEB), which would then "succeed" and shadow the
  // locally-bundled CUVT fallback below with the wrong script entirely.
  // 'zh-Hant' reliably returns zero results (confirmed live), so this
  // language always correctly falls through to FALLBACK_VERSIONS['zh-TW'].
  'zh-TW': 'zh-Hant',
};

// Settings/onboarding always want ESV first, then NIV, regardless of which
// order YouVersion's live catalog happens to return (and regardless of ESV
// normally landing last, since it's folded in from `localOnly` after
// `liveVersions` below) - a stable sort on this priority pins those two to
// the front while leaving everything else in its original relative order.
function withEsvAndNivFirst(versions: BibleVersion[]): BibleVersion[] {
  const priority = (v: BibleVersion) => (v.source === 'esv' ? 0 : v.abbreviation === 'NIV' ? 1 : 2);
  return [...versions].sort((a, b) => priority(a) - priority(b));
}

/** Bible translations available for a given language code - tries the live
 * YouVersion catalog first, falling back to a small known-good static list
 * for that language (or English's) if the API call fails. Any `source`-
 * tagged entries in that language's fallback list (locally-bundled
 * translations, or the ESV - see BibleVersion.source) are ALWAYS included on
 * top of whichever list wins, live or fallback - they can never come back
 * from the live YouVersion catalog by definition, so folding them in only on
 * failure would mean they'd disappear the instant the live call started
 * succeeding (which it now reliably does - see app/api/bible-versions). */
export async function getBibleVersionsForLanguage(language: string): Promise<BibleVersion[]> {
  const fallbacks = FALLBACK_VERSIONS[language] || FALLBACK_VERSIONS['en'];
  const localOnly = fallbacks.filter((v) => v.source !== undefined);

  try {
    const targetLanguageCode = LANGUAGE_TO_YOUVERSION_CODE[language] || 'eng';
    // Proxied through our own server route (app/api/bible-versions) instead
    // of calling YouVersion directly from the browser - this used to need
    // NEXT_PUBLIC_YOUVERSION_API_KEY (a client-exposed key that was never
    // actually configured), so this call always failed and silently fell
    // through to the FALLBACK_VERSIONS list below on every single request.
    // The proxy reuses the server-only YOUVERSION_API_KEY that's already
    // configured for verse-fetching, so no new/exposed credential is needed.
    const response = await fetch(`/api/bible-versions?language=${encodeURIComponent(targetLanguageCode)}`);

    if (!response.ok) {
      console.warn(`YouVersion responded with status ${response.status}. Using fallbacks.`);
      return withEsvAndNivFirst(fallbacks);
    }

    const responseJson = await response.json();
    const rawList = Array.isArray(responseJson)
      ? responseJson
      : (Array.isArray(responseJson.data) ? responseJson.data : []);

    if (rawList.length === 0) {
      throw new Error('API returned an empty version set.');
    }

    const liveVersions: BibleVersion[] = rawList.map((item: any) => ({
      id: item.id,
      abbreviation: item.abbreviation || item.abbr || '',
      title: item.title || item.name || 'Unknown Translation',
      language_tag: item.language_tag || item.language || language,
    }));
    return withEsvAndNivFirst([...liveVersions, ...localOnly]);
  } catch (error) {
    console.error('Failed to fetch Bible versions, loading reliable mock fallbacks:', error);
    return withEsvAndNivFirst(fallbacks);
  }
}
