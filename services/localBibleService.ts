import fs from 'fs';
import path from 'path';
import type { ParsedScriptureReference } from '../utils/scriptureReference';

interface LocalBibleBook {
  index: number;
  code: string;
  name: string;
  chapters: number;
  /** Verse count per chapter, 0-indexed by (chapter - 1). */
  verseCounts: number[];
}

interface LocalBibleFile {
  translation: string;
  abbrev: string;
  bookCount: number;
  verseCount: number;
  keyFormat: string;
  books: LocalBibleBook[];
  /** Flat "BOOKCODE.CHAPTER.VERSE" -> verse text, e.g. "HEB.11.1". */
  verses: Record<string, string>;
}

// Maps the negative bibleIds reserved for locally-bundled translations (see
// services/bibleVersionsService.ts's FALLBACK_VERSIONS/BibleVersion.source)
// to their file under bibles/ at the project root.
const LOCAL_BIBLE_FILES = new Map<number, string>([
  [-1, 'cuv_simplified.json'],
  [-2, 'cuv_traditional.json'],
]);

// Loaded once per server process, not per-request - each file is a few MB,
// so re-reading/re-parsing on every verse lookup would be wasteful. Node's
// module system would do this for us with a static `import`, but a plain
// read+cache here keeps the file path (and therefore which ids exist)
// entirely defined by LOCAL_BIBLE_FILES above, in one place.
const cache = new Map<number, LocalBibleFile>();

function loadLocalBible(bibleId: number): LocalBibleFile | null {
  const cached = cache.get(bibleId);
  if (cached) return cached;

  const fileName = LOCAL_BIBLE_FILES.get(bibleId);
  if (!fileName) return null;

  const filePath = path.join(process.cwd(), 'bibles', fileName);
  const raw = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(raw) as LocalBibleFile;
  cache.set(bibleId, data);
  return data;
}

export function isLocalBibleId(bibleId: number): boolean {
  return LOCAL_BIBLE_FILES.has(bibleId);
}

export interface LocalVerseResult {
  text: string;
}
export interface LocalVerseError {
  error: string;
}

/**
 * Looks up verse text from a locally-bundled translation - never calls
 * YouVersion. Supports a verse range (parsed.verseEnd set), including one
 * that crosses into a later chapter of the same book (parsed.chapterEnd),
 * by concatenating each verse's text with a space, same as how a multi-verse
 * passage reads from the YouVersion path. Walking chapter-by-chapter and
 * bounding every chapter but the last with the book's own verseCounts makes
 * the single-chapter case (chapterEnd === chapter) fall out naturally,
 * without a separate code path. On a miss, uses that same verseCounts table
 * to report a specific "chapter X only has Y verses" message - something the
 * YouVersion path can't do locally, since it has no such table for
 * translations it doesn't bundle itself.
 */
export function getLocalVerseText(bibleId: number, parsed: ParsedScriptureReference): LocalVerseResult | LocalVerseError {
  const data = loadLocalBible(bibleId);
  if (!data) {
    return { error: `No local translation is bundled for bible id ${bibleId}.` };
  }

  const { bookCode, chapter, verse, verseEnd, chapterEnd, bookInput } = parsed;
  const endChapter = chapterEnd ?? chapter;
  const endVerse = verseEnd ?? verse;
  const book = data.books.find((b) => b.code === bookCode);
  const collected: string[] = [];

  for (let c = chapter; c <= endChapter; c++) {
    const startV = c === chapter ? verse : 1;
    const endV = c === endChapter ? endVerse : (book?.verseCounts?.[c - 1] ?? startV);

    for (let v = startV; v <= endV; v++) {
      const key = `${bookCode}.${c}.${v}`;
      const text = data.verses[key];
      if (!text) {
        const maxVerse = book?.verseCounts?.[c - 1];
        const message = maxVerse
          ? `${bookInput} ${c} only has ${maxVerse} verses.`
          : `Couldn't find "${bookInput} ${c}:${v}" in ${data.translation}.`;
        return { error: message };
      }
      collected.push(text);
    }
  }

  return { text: collected.join(' ') };
}
