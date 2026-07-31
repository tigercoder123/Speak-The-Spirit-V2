const DEFAULT_MAX_WORDS = 6;

/**
 * Hard-truncates generated text to at most `maxWords` words, as a guard
 * against the model returning a full sentence despite being prompted for a
 * short, fragmentary thought (see services/responseChoicesService.ts and
 * services/resilenceThoughtService.ts). Appends an ellipsis when truncated so
 * the cut reads as an interrupted thought rather than a clipped word.
 */
export function truncateWords(text: string, maxWords: number = DEFAULT_MAX_WORDS): string {
  const trimmed = text.trim();
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return trimmed;
  return `${words.slice(0, maxWords).join(' ')}...`;
}
