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

  const focusNextEmptyTypedBlank = (fromBlankIndex: number) => {
    const typedBlankIndices = challenge.segments
      .filter((s): s is Extract<ChallengeSegment, { kind: 'blank' }> => s.kind === 'blank' && challenge.type !== 'WORD_BANK')
      .map((s) => s.blankIndex);
    const isEmpty = (blankIndex: number) => !(answers[blankIndex] ?? '').trim();
    const fromPos = typedBlankIndices.indexOf(fromBlankIndex);
    const target =
      typedBlankIndices.slice(fromPos + 1).find(isEmpty) ?? typedBlankIndices.find(isEmpty);
    if (target !== undefined) typedBlankRefs.current.get(target)?.focus();
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
            className={`w-full border-2 rounded-lg p-3 bg-white font-bold italic text-sm leading-relaxed disabled:opacity-70 ${
              wrongBlanks.length > 0 ? 'border-red-600 text-red-700' : 'border-black'
            }`}
          />
        </div>
      ) : (
        <p className="relative text-sm font-bold italic leading-relaxed text-center flex flex-wrap items-center justify-center gap-1.5">
          {challenge.segments.map((segment, i) => {
            if (segment.kind === 'text') {
              return <span key={i}>{segment.value}</span>;
            }

            const value = answers[segment.blankIndex] ?? '';
            const isWrong = wrongBlanks.includes(segment.blankIndex);
            const blankBorderClass = isWrong ? 'border-red-600 text-red-700' : 'border-black';

            if (segment.options) {
              return (
                <select
                  key={i}
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
                  className={`border-2 rounded px-1 py-0.5 bg-white font-black not-italic text-xs uppercase disabled:opacity-70 ${blankBorderClass}`}
                >
                  <option value="" disabled>...</option>
                  {segment.options.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              );
            }

            if (challenge.type === 'WORD_BANK') {
              const filledClass = value ? blankBorderClass : 'border-amber-800/40';
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
                    if (!disabled && value) onAnswerChange(segment.blankIndex, '');
                  }}
                  className={`mx-1 inline-block min-w-[64px] border-b-2 px-2 text-center align-middle font-black not-italic text-xs ${filledClass} ${
                    value && !disabled ? 'cursor-pointer' : ''
                  }`}
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
                onKeyDown={(e) => {
                  if (e.key !== ' ') return;
                  e.preventDefault();
                  focusNextEmptyTypedBlank(segment.blankIndex);
                }}
                className={`border-0 border-b-2 rounded-none px-1 py-0.5 bg-transparent font-black not-italic text-xs w-24 text-center disabled:opacity-70 ${blankBorderClass}`}
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
                }`}
              >
                {word}
              </span>
            ))}
          </div>
        </div>
      )}

      {wrongBlanks.length > 0 && (
        <p className="relative text-xs font-black text-red-700 uppercase text-center mt-3 animate-shake-box">
          Static interference! Try again.
        </p>
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
