'use client';

import React, { useEffect, useState } from 'react';
import { useGame } from '@/context/GameContext';
import { getBibleVersionsForLanguage, LANGUAGE_OPTIONS, type BibleVersion } from '@/services/bibleVersionsService';

interface SettingsModalProps {
  onClose: () => void;
}

// Lets the player change their verse language/translation after onboarding -
// same language list and YouVersion-backed version lookup as
// OnboardingFlow.tsx's steps 2-3, just editable anytime instead of once.
// Saving calls GameContext's setBibleLanguage/setBibleVersionId, which
// persist to Supabase and re-trigger every spot that reads bibleVersionId
// (QuestRiddle's verse-chunk fetch, the Silencer battle's verse fetch) - so
// already-collected verse fragments refresh in the player's new choice.
export default function SettingsModal({ onClose }: SettingsModalProps) {
  const { bibleLanguage, bibleVersionId, setBibleLanguage, setBibleVersionId } = useGame();

  const [language, setLanguage] = useState(bibleLanguage ?? 'en');
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(bibleVersionId);
  const [versions, setVersions] = useState<BibleVersion[]>([]);
  const [loading, setLoading] = useState(false);

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

  const handleSave = () => {
    setBibleLanguage(language);
    if (selectedVersionId !== null) setBibleVersionId(selectedVersionId);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 neo-box p-8 w-full max-w-md flex flex-col gap-6 rounded-2xl text-slate-100">
        <h2 className="text-2xl font-black text-center">⚙️ Settings</h2>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Verse language</label>
          <select
            className="bg-slate-950 text-white border-2 border-slate-700 p-3 text-lg outline-none rounded-xl"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            {LANGUAGE_OPTIONS.map((lang) => (
              <option key={lang.code} value={lang.code}>{lang.label}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Translation</label>
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
            disabled={loading || selectedVersionId === null}
            className="neo-btn p-3 px-6 font-bold bg-yellow-400 text-black disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
