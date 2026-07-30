// Maps human-readable Bible references (e.g. "Hebrews 11:1") to the USFM-style
// passage ids the YouVersion Platform API expects (e.g. "HEB.11.1").
const BOOK_USFM_CODES: Record<string, string> = {
  genesis: 'GEN', exodus: 'EXO', leviticus: 'LEV', numbers: 'NUM', deuteronomy: 'DEU',
  joshua: 'JOS', judges: 'JDG', ruth: 'RUT', '1samuel': '1SA', '2samuel': '2SA',
  '1kings': '1KI', '2kings': '2KI', '1chronicles': '1CH', '2chronicles': '2CH',
  ezra: 'EZR', nehemiah: 'NEH', esther: 'EST', job: 'JOB', psalm: 'PSA', psalms: 'PSA',
  proverbs: 'PRO', ecclesiastes: 'ECC', 'songofsolomon': 'SNG', isaiah: 'ISA',
  jeremiah: 'JER', lamentations: 'LAM', ezekiel: 'EZK', daniel: 'DAN', hosea: 'HOS',
  joel: 'JOL', amos: 'AMO', obadiah: 'OBA', jonah: 'JON', micah: 'MIC', nahum: 'NAM',
  habakkuk: 'HAB', zephaniah: 'ZEP', haggai: 'HAG', zechariah: 'ZEC', malachi: 'MAL',
  matthew: 'MAT', mark: 'MRK', luke: 'LUK', john: 'JHN', acts: 'ACT', romans: 'ROM',
  '1corinthians': '1CO', '2corinthians': '2CO', galatians: 'GAL', ephesians: 'EPH',
  philippians: 'PHP', colossians: 'COL', '1thessalonians': '1TH', '2thessalonians': '2TH',
  '1timothy': '1TI', '2timothy': '2TI', titus: 'TIT', philemon: 'PHM', hebrews: 'HEB',
  james: 'JAS', '1peter': '1PE', '2peter': '2PE', '1john': '1JN', '2john': '2JN',
  '3john': '3JN', jude: 'JUD', revelation: 'REV',
};

/**
 * Parses references like "Hebrews 11:1" or "1 John 4:8" into a USFM passage id
 * like "HEB.11.1". Returns null if the reference can't be parsed.
 */
export function referenceToUSFM(reference: string): string | null {
  const match = reference.trim().match(/^(\d?\s?[A-Za-z]+)\s+(\d+):(\d+)(?:-(\d+))?$/);
  if (!match) return null;

  const [, rawBook, chapter, verse, verseEnd] = match;
  const bookKey = rawBook.toLowerCase().replace(/\s+/g, '');
  const bookCode = BOOK_USFM_CODES[bookKey];
  if (!bookCode) return null;

  return verseEnd ? `${bookCode}.${chapter}.${verse}-${bookCode}.${chapter}.${verseEnd}` : `${bookCode}.${chapter}.${verse}`;
}
