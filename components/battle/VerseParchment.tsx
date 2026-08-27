'use client';

import React, { useEffect, useRef } from 'react';
import type { Challenge, ChallengeSegment } from '../../utils/challengeGenerator';

interface VerseParchmentProps {
  verseReference: string;
  challenge: Challenge;
  answers: string[];
  wrongBlanks: number[];
  /** True during the post-wrong-answer review beat - inputs are read-only. */
  disabled: boolean;
  onAnswerChange: (blankIndex: number, value: string) => void;
  onSubmit: () => void;
  /** True while the Hint power-up is armed and waiting on a blank click - every
   * type except WHOLE_VERSE, which uses wholeVerseHintPending instead. */
  hintTargeting?: boolean;
  onBlankClick?: (blankIndex: number) => void;
  /** WORD_BANK's Hint effect - the word-bank entry text to glow gold. */
  hintGlowWord?: string | null;
  /** Check power-up's pre-submit highlight - styled like wrongBlanks (red) but
   * never disables the parchment the way a real wrong answer does. */
  checkHighlightBlanks?: number[];
  /** WHOLE_VERSE's Hint prompt ("This hint fills in the next word.") shown in
   * place of blank-click targeting, since there's only one blank to target. */
  wholeVerseHintPending?: boolean;
  onConfirmWholeVerseHint?: () => void;
}

// Which word-bank words are still available to drag, given which have
// already been placed into a blank. Matched as a multiset (running count, not
// just presence) so a word bank containing the same word twice still hides
// exactly as many tokens as are actually placed.
function computeRemainingBank(wordBank: string[], answers: string[]): string[] {
  const placedCounts = new Map<string, number>();
  answers.forEach((answer) => {
    if (!answer) return;
    placedCounts.set(answer, (placedCounts.get(answer) ?? 0) + 1);
  });

  const consumed = new Map<string, number>();
  return wordBank.filter((word) => {
    const used = consumed.get(word) ?? 0;
    if (used < (placedCounts.get(word) ?? 0)) {
      consumed.set(word, used + 1);
      return false; // this instance is currently placed in a blank
    }
    return true;
  });
}

// Renders whichever challenge type is passed in purely from `segments`/
// `wordBank` - adding a new ChallengeType only requires a new case here, no
// other component needs to change. Answers/submission are fully controlled
// by the caller (useSilencerBattle) - this component holds no state of its own.
export default function VerseParchment({
  verseReference,
  challenge,
  answers,
  wrongBlanks,
  disabled,
  onAnswerChange,
  onSubmit,
  hintTargeting = false,
  onBlankClick,
  hintGlowWord = null,
  checkHighlightBlanks = [],
  wholeVerseHintPending = false,
  onConfirmWholeVerseHint,
}: VerseParchmentProps) {
  const isWholeVerse = challenge.type === 'WHOLE_VERSE';
  const allFilled = isWholeVerse ? (answers[0] ?? '').trim() !== '' : answers.every((a) => a.trim() !== '');

  // Native HTML5 drag-and-drop is unreliable on some trackpads/browsers, so
  // word-bank words can also be placed by clicking - fills the first blank
  // (in reading order) that's still empty.
  const placeWordInNextEmptyBlank = (word: string) => {
    const blankIndices = challenge.segments
      .filter((s): s is Extract<ChallengeSegment, { kind: 'blank' }> => s.kind === 'blank')
      .map((s) => s.blankIndex);
    const target = blankIndices.find((blankIndex) => !(answers[blankIndex] ?? '').trim());
    if (target !== undefined) onAnswerChange(target, word);
  };

  // Typed/select blanks only (word-bank blanks are plain spans with no
  // keyboard focus of their own) - lets the Space shortcut below jump focus
  // instead of the player having to reach for the mouse between blanks.
  const typedBlankRefs = useRef(new Map<number, HTMLInputElement | HTMLSelectElement>());

  const typedBlankIndicesInOrder = () =>
    challenge.segments
      .filter((s): s is Extract<ChallengeSegment, { kind: 'blank' }> => s.kind === 'blank' && challenge.type !== 'WORD_BANK')
      .map((s) => s.blankIndex);

  const focusNextEmptyTypedBlank = (fromBlankIndex: number) => {
    const typedBlankIndices = typedBlankIndicesInOrder();
    const isEmpty = (blankIndex: number) => !(answers[blankIndex] ?? '').trim();
    const fromPos = typedBlankIndices.indexOf(fromBlankIndex);
    const target =
      typedBlankIndices.slice(fromPos + 1).find(isEmpty) ?? typedBlankIndices.find(isEmpty);
    if (target !== undefined) typedBlankRefs.current.get(target)?.focus();
  };

  // Backspace at the very start of a blank (cursor collapsed at position 0,
  // nothing selected - so the keystroke would otherwise delete nothing)
  // jumps focus to the previous typed blank in reading order, cursor placed
  // at ITS end so repeated backspacing can keep walking back through
  // already-typed answers. No-ops (default browser behavior, which deletes
  // nothing at position 0 anyway) on the first blank - there's nothing
  // before it to jump to.
  const focusPreviousTypedBlank = (fromBlankIndex: number): boolean => {
    const typedBlankIndices = typedBlankIndicesInOrder();
    const fromPos = typedBlankIndices.indexOf(fromBlankIndex);
    if (fromPos <= 0) return false;
    const target = typedBlankIndices[fromPos - 1];
    const el = typedBlankRefs.current.get(target);
    if (!el) return false;
    el.focus();
    if (el instanceof HTMLInputElement) {
      const end = el.value.length;
      el.setSelectionRange(end, end);
    }
    return true;
  };

  // Enter submits the challenge exactly like clicking Restore! - regardless
  // of which blank (or nothing) currently has focus. Skipped while a
  // <textarea> is focused so the WHOLE_VERSE mode can still type real
  // newlines instead of submitting early.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      if (disabled || !allFilled) return;
      if (document.activeElement?.tagName === 'TEXTAREA') return;
      e.preventDefault();
      onSubmit();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [disabled, allFilled, onSubmit]);

  return (
    <div className="bg-amber-100 border-4 border-black p-6 rounded-2xl text-black shadow-[4px_4px_0px_#000] relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(#eab308_1px,transparent_1px)] [background-size:16px_16px] opacity-20 pointer-events-none" />
      <p className="relative text-[10px] font-black uppercase tracking-wider text-amber-800 mb-3 text-center">
        📜 {verseReference}
      </p>

      {isWholeVerse ? (
        <div className="relative flex flex-col gap-2">
          <p className="text-xs font-bold text-amber-800/80 text-center">
            Write the whole verse from memory - punctuation matters.
          </p>
          <textarea
            value={answers[0] ?? ''}
            disabled={disabled}
            onChange={(e) => onAnswerChange(0, e.target.value)}
            rows={4}
            autoCorrect="off"
            autoCapitalize="off"
            autoComplete="off"
            spellCheck={false}
            className={`w-full border-2 rounded-lg p-3 bg-white font-bold italic text-sm leading-relaxed disabled:opacity-70 ${
              wrongBlanks.length > 0 ? 'border-red-600 text-red-700' : 'border-black'
            }`}
          />
          {wholeVerseHintPending && (
            <div className="flex flex-col items-center gap-2 bg-yellow-50 border-2 border-yellow-500 rounded-lg p-2">
              <p className="text-xs font-bold text-yellow-800">This hint fills in the next word.</p>
              <button
                onClick={onConfirmWholeVerseHint}
                className="neo-btn neo-btn-restore text-black font-black text-xs px-4 py-1.5 rounded-lg uppercase"
              >
                Continue
              </button>
            </div>
          )}
        </div>
      ) : (
        <p className="relative text-sm font-bold italic leading-relaxed text-center flex flex-wrap items-center justify-center gap-1.5">
          {challenge.segments.map((segment, i) => {
            if (segment.kind === 'text') {
              return <span key={i}>{segment.value}</span>;
            }

            const value = answers[segment.blankIndex] ?? '';
            const isWrong = wrongBlanks.includes(segment.blankIndex) || checkHighlightBlanks.includes(segment.blankIndex);
            const blankBorderClass = isWrong ? 'border-red-600 text-red-700' : 'border-black';

            if (segment.options) {
              // While Hint is targeting, a plain onClick on a native <select>
              // isn't reliable - the browser's own dropdown list opens (and
              // can swallow/precede the click) before React's handler ever
              // fires, so the hint's blank-click almost never actually
              // registers. A transparent button laid over the whole select
              // intercepts the click instead, so it never even reaches the
              // dropdown while targeting is active.
              return (
                <span key={i} className="relative inline-block">
                  <select
                    ref={(el) => {
                      if (el) typedBlankRefs.current.set(segment.blankIndex, el);
                      else typedBlankRefs.current.delete(segment.blankIndex);
                    }}
                    value={value}
                    disabled={disabled}
                    onChange={(e) => onAnswerChange(segment.blankIndex, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== ' ') return;
                      e.preventDefault();
                      focusNextEmptyTypedBlank(segment.blankIndex);
                    }}
                    className={`border-2 rounded px-1 py-0.5 bg-white font-black not-italic text-xs uppercase disabled:opacity-70 ${blankBorderClass} ${
                      hintTargeting && !disabled ? 'hint-click-target' : ''
                    }`}
                  >
                    <option value="" disabled>...</option>
                    {segment.options.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  {hintTargeting && !disabled && (
                    <button
                      type="button"
                      onClick={() => onBlankClick?.(segment.blankIndex)}
                      aria-label="Click to target this blank for Hint"
                      className="absolute inset-0 cursor-pointer"
                    />
                  )}
                </span>
              );
            }

            if (challenge.type === 'WORD_BANK') {
              const filledClass = value ? blankBorderClass : 'border-amber-800/40';
              // While Hint is targeting an unanswered blank, it's otherwise a
              // thin min-w-[64px] strip sitting inline in a wrapped paragraph -
              // easy to miss/misclick. Bumping the padding widens the actual
              // hit area (not just a cosmetic glow), and hint-click-target
              // makes it obvious which spot to click.
              const isHintTarget = hintTargeting && !value && !disabled;
              return (
                <span
                  key={i}
                  onDragOver={(e) => {
                    if (!disabled) e.preventDefault();
                  }}
                  onDrop={(e) => {
                    if (disabled) return;
                    e.preventDefault();
                    const word = e.dataTransfer.getData('text/plain');
                    if (word) onAnswerChange(segment.blankIndex, word);
                  }}
                  onClick={() => {
                    if (disabled) return;
                    if (hintTargeting) {
                      onBlankClick?.(segment.blankIndex);
                      return;
                    }
                    if (value) onAnswerChange(segment.blankIndex, '');
                  }}
                  className={`mx-1 inline-block min-w-[64px] border-b-2 text-center align-middle font-black not-italic text-xs ${filledClass} ${
                    value && !disabled ? 'cursor-pointer' : ''
                  } ${isHintTarget ? 'hint-click-target cursor-pointer px-3 py-1' : 'px-2'}`}
                >
                  {value || ' '}
                </span>
              );
            }

            return (
              <input
                key={i}
                ref={(el) => {
                  if (el) typedBlankRefs.current.set(segment.blankIndex, el);
                  else typedBlankRefs.current.delete(segment.blankIndex);
                }}
                type="text"
                value={value}
                disabled={disabled}
                onChange={(e) => onAnswerChange(segment.blankIndex, e.target.value)}
                onClick={() => {
                  if (hintTargeting) onBlankClick?.(segment.blankIndex);
                }}
                onKeyDown={(e) => {
                  if (e.key === ' ') {
                    e.preventDefault();
                    focusNextEmptyTypedBlank(segment.blankIndex);
                    return;
                  }
                  if (e.key === 'Backspace' && e.currentTarget.selectionStart === 0 && e.currentTarget.selectionEnd === 0) {
                    if (focusPreviousTypedBlank(segment.blankIndex)) e.preventDefault();
                  }
                }}
                className={`border-0 border-b-2 rounded-none px-1 py-0.5 bg-transparent font-black not-italic text-xs w-24 text-center disabled:opacity-70 ${blankBorderClass} ${
                  hintTargeting && !value && !disabled ? 'hint-click-target' : ''
                }`}
              />
            );
          })}
        </p>
      )}

      {challenge.type === 'WORD_BANK' && challenge.wordBank && (
        <div className="relative flex flex-col gap-2 mt-4">
          <p className="text-xs font-bold text-amber-800/80 text-center">Drag each word into its blank, or click it.</p>
          <div className="flex flex-wrap justify-center gap-2">
            {computeRemainingBank(challenge.wordBank, answers).map((word, i) => (
              <span
                key={`${word}-${i}`}
                draggable={!disabled}
                onDragStart={(e) => e.dataTransfer.setData('text/plain', word)}
                onClick={() => {
                  if (!disabled) placeWordInNextEmptyBlank(word);
                }}
                className={`select-none border-2 border-black rounded-full bg-white px-3 py-1 font-black not-italic text-xs uppercase ${
                  disabled ? 'opacity-60' : 'cursor-pointer active:cursor-grabbing'
                } ${word === hintGlowWord ? 'hint-glow' : ''}`}
              >
                {word}
              </span>
            ))}
          </div>
        </div>
      )}

<div className="relative flex justify-center mt-4">
        <button
          onClick={onSubmit}
          disabled={disabled || !allFilled}
          className="neo-btn-restore disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold py-2.5 px-6 rounded-lg neo-btn text-sm uppercase"
        >
          Restore! ✨
        </button>
      </div>
    </div>
  );
}
