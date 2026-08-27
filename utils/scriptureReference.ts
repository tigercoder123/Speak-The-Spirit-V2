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

// Chapter counts for every book, keyed the same way as BOOK_USFM_CODES - used
// to catch an out-of-range chapter (e.g. "Genesis 999:1") locally, without a
// round trip to YouVersion.
const BOOK_CHAPTER_COUNTS: Record<string, number> = {
  genesis: 50, exodus: 40, leviticus: 27, numbers: 36, deuteronomy: 34,
  joshua: 24, judges: 21, ruth: 4, '1samuel': 31, '2samuel': 24,
  '1kings': 22, '2kings': 25, '1chronicles': 29, '2chronicles': 36,
  ezra: 10, nehemiah: 13, esther: 10, job: 42, psalm: 150, psalms: 150,
  proverbs: 31, ecclesiastes: 12, songofsolomon: 8, isaiah: 66,
  jeremiah: 52, lamentations: 5, ezekiel: 48, daniel: 12, hosea: 14,
  joel: 3, amos: 9, obadiah: 1, jonah: 4, micah: 7, nahum: 3,
  habakkuk: 3, zephaniah: 3, haggai: 2, zechariah: 14, malachi: 4,
  matthew: 28, mark: 16, luke: 24, john: 21, acts: 28, romans: 16,
  '1corinthians': 16, '2corinthians': 13, galatians: 6, ephesians: 6,
  philippians: 4, colossians: 4, '1thessalonians': 5, '2thessalonians': 3,
  '1timothy': 6, '2timothy': 4, titus: 3, philemon: 1, hebrews: 13,
  james: 5, '1peter': 5, '2peter': 3, '1john': 5, '2john': 1,
  '3john': 1, jude: 1, revelation: 22,
};

export interface ParsedScriptureReference {
  bookInput: string;
  bookCode: string;
  chapter: number;
  verse: number;
  verseEnd?: number;
  /** Set only when the range crosses into a later chapter of the same book, e.g. "Hebrews 11:1-12:1". */
  chapterEnd?: number;
  usfm: string;
}

export interface ScriptureReferenceError {
  /** `format` = didn't even look like "Book Chapter:Verse"; `book` = book name
   * isn't recognized; `chapter` = chapter number is out of range for that
   * book (verse-number range isn't checked here - see the API route, which
   * treats a YouVersion miss on an otherwise-valid book/chapter as a bad
   * verse number). */
  type: 'format' | 'book' | 'chapter';
  message: string;
}

/**
 * Parses references like "Hebrews 11:1" or "1 John 4:8", validating the book
 * name and chapter number locally. Returns a specific, user-facing error
 * message when the book doesn't exist or the chapter is out of range for
 * that book.
 */
export function parseScriptureReference(reference: string): ParsedScriptureReference | ScriptureReferenceError {
  const trimmed = reference.trim();
  const match = trimmed.match(/^(\d?\s?[A-Za-z]+)\s+(\d+):(\d+)(?:\s*-\s*(?:(\d+):)?(\d+))?$/);
  if (!match) {
    return { type: 'format', message: `"${trimmed}" doesn't look like a Bible verse. Try something like "Hebrews 11:1" or "Hebrews 11:1-3".` };
  }

  const [, rawBook, chapterStr, verseStr, chapterEndStr, verseEndStr] = match;
  const bookInput = rawBook.trim();
  const bookKey = bookInput.toLowerCase().replace(/\s+/g, '');
  const bookCode = BOOK_USFM_CODES[bookKey];
  if (!bookCode) {
    return { type: 'book', message: `The book "${bookInput}" doesn't exist.` };
  }

  const chapter = parseInt(chapterStr, 10);
  const maxChapter = BOOK_CHAPTER_COUNTS[bookKey];
  if (chapter < 1 || (maxChapter !== undefined && chapter > maxChapter)) {
    return { type: 'chapter', message: `${bookInput} doesn't have a chapter ${chapter}.` };
  }

  const verse = parseInt(verseStr, 10);
  const verseEnd = verseEndStr ? parseInt(verseEndStr, 10) : undefined;
  const chapterEnd = chapterEndStr ? parseInt(chapterEndStr, 10) : undefined;

  if (chapterEnd !== undefined) {
    if (chapterEnd < 1 || (maxChapter !== undefined && chapterEnd > maxChapter)) {
      return { type: 'chapter', message: `${bookInput} doesn't have a chapter ${chapterEnd}.` };
    }
    if (chapterEnd < chapter || (chapterEnd === chapter && verseEnd !== undefined && verseEnd <= verse)) {
      return { type: 'format', message: `The end of the range must come after ${bookInput} ${chapter}:${verse}.` };
    }
  }

  // YouVersion's passages endpoint expects a compact end verse for a
  // same-chapter range ("HEB.11.1-3"), not a fully-repeated second reference
  // ("HEB.11.1-HEB.11.3") - the latter 404s even though it's valid USFM range
  // syntax. A cross-chapter range needs the full second reference instead.
  const usfm = verseEnd === undefined
    ? `${bookCode}.${chapter}.${verse}`
    : chapterEnd !== undefined && chapterEnd !== chapter
      ? `${bookCode}.${chapter}.${verse}-${bookCode}.${chapterEnd}.${verseEnd}`
      : `${bookCode}.${chapter}.${verse}-${verseEnd}`;

  return { bookInput, bookCode, chapter, verse, verseEnd, chapterEnd, usfm };
}

/**
 * Parses references like "Hebrews 11:1" or "1 John 4:8" into a USFM passage id
 * like "HEB.11.1". Returns null if the reference can't be parsed.
 */
export function referenceToUSFM(reference: string): string | null {
  const parsed = parseScriptureReference(reference);
  return 'usfm' in parsed ? parsed.usfm : null;
}
