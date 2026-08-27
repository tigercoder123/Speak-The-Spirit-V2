'use client';

import React, { useEffect, useState } from 'react';
import { useGame } from '@/context/GameContext';
import { getBibleVersionsForLanguage, LANGUAGE_OPTIONS, type BibleVersion } from '@/services/bibleVersionsService';
import { getVerse } from '@/services/scriptureService';
import { SILENCER_BATTLE_VERSE_REFERENCE } from '@/config/silencerBattleRounds';

interface SettingsModalProps {
  onClose: () => void;
}

// Lets the player change their verse language/translation/reference after
// onboarding - same language list and YouVersion-backed version lookup as
// OnboardingFlow.tsx's steps 2-3, just editable anytime instead of once.
// Saving calls GameContext's setBibleLanguage/setBibleVersionId/
// setBibleVerseReference, which persist to Supabase and re-trigger every spot
// that reads those values (QuestRiddle's verse-chunk fetch, the Silencer
// battle's verse fetch) - so already-collected verse fragments and the next
// battle both refresh to match the player's new choice.
export default function SettingsModal({ onClose }: SettingsModalProps) {
  const { bibleLanguage, bibleVersionId, bibleVerseReference, setBibleLanguage, setBibleVersionId, setBibleVerseReference } = useGame();

  const [language, setLanguage] = useState(bibleLanguage ?? 'en');
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(bibleVersionId);
  const [versions, setVersions] = useState<BibleVersion[]>([]);
  const [loading, setLoading] = useState(false);

  const [verseInput, setVerseInput] = useState(bibleVerseReference ?? SILENCER_BATTLE_VERSE_REFERENCE);
  const [versePreview, setVersePreview] = useState<string | null>(null);
  const [verseError, setVerseError] = useState<string | null>(null);
  const [versePreviewLoading, setVersePreviewLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getBibleVersionsForLanguage(language).then((fetched) => {
      if (cancelled) return;
      setVersions(fetched);
      // Keep the current pick if it's still valid for this language, else default to the first option.
      setSelectedVersionId((prev) => (prev && fetched.some((v) => v.id === prev) ? prev : fetched[0]?.id ?? null));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [language]);

  // Live-previews whatever verse reference the player is typing - debounced
  // so it doesn't fire a request on every keystroke. Re-runs when the
  // translation changes too, so the preview always matches what Save would
  // actually persist.
  useEffect(() => {
    const trimmed = verseInput.trim();
    if (!trimmed) {
      setVersePreview(null);
      setVerseError(null);
      setVersePreviewLoading(false);
      return;
    }

    let cancelled = false;
    setVersePreviewLoading(true);
    const timer = setTimeout(() => {
      getVerse(trimmed, selectedVersionId ?? undefined)
        .then((verse) => {
          if (cancelled) return;
          setVersePreview(verse.text);
          setVerseError(null);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setVersePreview(null);
          setVerseError(err instanceof Error ? err.message : 'Could not find that verse.');
        })
        .finally(() => {
          if (!cancelled) setVersePreviewLoading(false);
        });
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [verseInput, selectedVersionId]);

  const handleSave = () => {
    setBibleLanguage(language);
    if (selectedVersionId !== null) setBibleVersionId(selectedVersionId);
    const trimmedVerse = verseInput.trim();
    if (trimmedVerse && !verseError) setBibleVerseReference(trimmedVerse);

    onClose();
  };

  const canSave = !loading && selectedVersionId !== null && !versePreviewLoading && !verseError;

  return (
    <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 neo-box w-full max-w-md flex flex-col rounded-2xl text-slate-100 overflow-hidden">
        <div className="settings-modal-header">
          <h2 className="text-2xl font-black text-center text-black flex items-center justify-center gap-2">
            ⚙️ Settings
          </h2>
          <p className="text-center text-[10px] font-black text-black/70 uppercase tracking-widest mt-1">
            Tune your memory verse journey
          </p>
        </div>

        <div className="p-8 flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label className="settings-label">🌐 Verse language</label>
            <select
              className="settings-input"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              {LANGUAGE_OPTIONS.map((lang) => (
                <option key={lang.code} value={lang.code}>{lang.label}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="settings-label">📖 Translation</label>
            {loading ? (
              <p className="animate-float text-slate-300 text-center py-4">Loading versions...</p>
            ) : (
              <div className="flex flex-col gap-2 max-h-56 overflow-y-auto p-2 bg-slate-950 border-2 border-slate-700 rounded-xl">
                {versions.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setSelectedVersionId(v.id)}
                    className={`p-3 text-left border-2 rounded-lg transition-all ${
                      selectedVersionId === v.id
                        ? 'bg-yellow-400 text-black border-black font-black'
                        : 'border-slate-700 text-slate-300 hover:border-slate-500 hover:bg-slate-900'
                    }`}
                  >
                    {v.title} {v.abbreviation ? `(${v.abbreviation})` : ''}
                  </button>
                ))}
                {versions.length === 0 && <p className="text-slate-300 text-center py-2">No versions found for this language.</p>}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="settings-label">✝️ Memory verse</label>
            <input
              type="text"
              value={verseInput}
              onChange={(e) => setVerseInput(e.target.value)}
              placeholder='e.g. "Hebrews 11:1" or "Hebrews 11:1-3"'
              className="settings-input"
            />
            <div className="settings-preview-box">
              {versePreviewLoading && (
                <p className="text-slate-400 animate-pulse">Looking up verse...</p>
              )}
              {!versePreviewLoading && verseError && (
                <p className="text-red-400 font-bold">⚠️ {verseError}</p>
              )}
              {!versePreviewLoading && !verseError && versePreview && (
                <p className="text-amber-200 italic">&ldquo;{versePreview}&rdquo;</p>
              )}
              {!versePreviewLoading && !verseError && !versePreview && (
                <p className="text-slate-500">Type a verse reference to preview it.</p>
              )}
            </div>
          </div>

          <div className="flex justify-between mt-2">
            <button
              type="button"
              onClick={onClose}
              className="neo-btn p-3 px-6 font-bold bg-slate-700 text-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="neo-btn p-3 px-6 font-bold bg-yellow-400 text-black disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
