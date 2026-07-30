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

const FALLBACK_VERSIONS: Record<string, BibleVersion[]> = {
  en: [
    { id: 59, abbreviation: 'ESV', title: 'English Standard Version', language_tag: 'en' },
    { id: 111, abbreviation: 'NIV', title: 'New International Version', language_tag: 'en' },
    { id: 116, abbreviation: 'NLT', title: 'New Living Translation', language_tag: 'en' },
    { id: 1, abbreviation: 'KJV', title: 'King James Version', language_tag: 'en' },
  ],
  es: [
    { id: 151, abbreviation: 'RVR1960', title: 'Reina-Valera 1960', language_tag: 'es' },
    { id: 127, abbreviation: 'NVI', title: 'Nueva Versión Internacional', language_tag: 'es' },
    { id: 149, abbreviation: 'NTV', title: 'Nueva Traducción Viviente', language_tag: 'es' },
  ],
  fr: [
    { id: 93, abbreviation: 'LSG', title: 'Louis Segond 1910', language_tag: 'fr' },
    { id: 134, abbreviation: 'PDV', title: 'Parole de Vie', language_tag: 'fr' },
  ],
  pt: [
    { id: 129, abbreviation: 'NVI', title: 'Nova Versão Internacional', language_tag: 'pt' },
    { id: 212, abbreviation: 'NAA', title: 'Nova Almeida Atualizada', language_tag: 'pt' },
  ],
  ko: [
    { id: 88, abbreviation: 'KRV', title: 'Korean Revised Version', language_tag: 'ko' },
    { id: 142, abbreviation: 'KLB', title: 'Korean Living Bible', language_tag: 'ko' },
  ],
  zh: [
    { id: 41, abbreviation: 'RCUVS', title: 'Revised Chinese Union Version Simpl.', language_tag: 'zh' },
    { id: 43, abbreviation: 'CCB', title: 'Chinese Contemporary Bible', language_tag: 'zh' },
  ],
  'zh-TW': [
    { id: 42, abbreviation: 'RCUVT', title: 'Revised Chinese Union Version Trad.', language_tag: 'zh-TW' },
    { id: 44, abbreviation: 'CUNP-T', title: 'Chinese Union Version Trad.', language_tag: 'zh-TW' },
  ],
  de: [
    { id: 10, abbreviation: 'LUTH1545', title: 'Luther Bibel 1545', language_tag: 'de' },
    { id: 73, abbreviation: 'HOF', title: 'Hoffnung für Alle', language_tag: 'de' },
    { id: 51, abbreviation: 'SCH2000', title: 'Schlachter 2000', language_tag: 'de' },
  ],
  tl: [
    { id: 398, abbreviation: 'RTPV05', title: 'Magandang Balita Biblia', language_tag: 'tl' },
    { id: 399, abbreviation: 'ABB', title: 'Ang Biblia', language_tag: 'tl' },
  ],
  vi: [
    { id: 194, abbreviation: 'VI1934', title: '1934 Vietnamese Bible', language_tag: 'vi' },
    { id: 193, abbreviation: 'NVB', title: 'Bản Dịch Mới', language_tag: 'vi' },
  ],
  ja: [
    { id: 81, abbreviation: 'JCB', title: 'Japan Contemporary Bible', language_tag: 'ja' },
    { id: 181, abbreviation: 'JLB', title: 'Japanese Living Bible', language_tag: 'ja' },
  ],
};

const LANGUAGE_TO_YOUVERSION_CODE: Record<string, string> = {
  en: 'eng', es: 'spa', fr: 'fra', pt: 'por', ko: 'kor',
  zh: 'zho', 'zh-TW': 'zho', de: 'deu', tl: 'tgl', vi: 'vie', ja: 'jpn',
};

/** Bible translations available for a given language code - tries the live
 * YouVersion catalog first, falling back to a small known-good static list
 * for that language (or English's) if the API call fails. */
export async function getBibleVersionsForLanguage(language: string): Promise<BibleVersion[]> {
  const fallbacks = FALLBACK_VERSIONS[language] || FALLBACK_VERSIONS['en'];

  try {
    const targetLanguageCode = LANGUAGE_TO_YOUVERSION_CODE[language] || 'eng';
    const queryParams = new URLSearchParams({
      language_ranges: targetLanguageCode,
      page: '1',
      size: '10', // Intentionally small to avoid oversized server payloads.
    });

    const response = await fetch(`https://api.youversion.com/v1/bibles?${queryParams.toString()}`, {
      headers: {
        'X-YVP-App-Key': process.env.NEXT_PUBLIC_YOUVERSION_API_KEY || '',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn(`YouVersion responded with status ${response.status}. Using fallbacks.`);
      return fallbacks;
    }

    const responseJson = await response.json();
    const rawList = Array.isArray(responseJson)
      ? responseJson
      : (Array.isArray(responseJson.data) ? responseJson.data : []);

    if (rawList.length === 0) {
      throw new Error('API returned an empty version set.');
    }

    return rawList.map((item: any) => ({
      id: item.id,
      abbreviation: item.abbreviation || item.abbr || '',
      title: item.title || item.name || 'Unknown Translation',
      language_tag: item.language_tag || item.language || language,
    }));
  } catch (error) {
    console.error('Failed to fetch Bible versions, loading reliable mock fallbacks:', error);
    return fallbacks;
  }
}
