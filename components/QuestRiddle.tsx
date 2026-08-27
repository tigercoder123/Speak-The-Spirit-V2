'use client';

import React, { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import CrossroadsScene from './quests/Crossroads/CrossroadsScene';
import HungerTrialScene from './quests/HungerTrial/HungerTrialScene';
import RushingWatersScene from './quests/RushingWaters/RushingWatersScene';

import { getVerse } from '@/services/scriptureService';
import { chunkVerseWithGloo } from '@/app/actions/gloo';
import { SILENCER_BATTLE_VERSE_REFERENCE } from '@/config/silencerBattleRounds';

export default function QuestRiddle() {
  // 1. Fixed: Grab 'userId', 'verseChunks', and 'setVerseChunks' from context
  const { setCurrentScreen, setFeedback, userId, bibleVersionId, bibleVerseReference, verseChunks, setVerseChunks } = useGame();

  const [currentScene, setCurrentScene] = useState<'CROSSROADS' | 'HUNGER' | 'RIVER' | 'BATTLE_READY'>('CROSSROADS');

  // Settings-driven verse reference - falls back to the default battle verse
  // until the player picks their own (see SettingsModal.tsx).
  const activeVerseReference = bibleVerseReference || SILENCER_BATTLE_VERSE_REFERENCE;

  // 2. Fetch and chunk the verse on load, and again whenever the player
  // changes their translation/language/verse setting mid-quest - so the
  // fragments they're collecting always reflect their current choice.
  useEffect(() => {
    async function loadVerse() {
      // Don't try to fetch if we don't have a user loaded yet!
      if (!userId) return;

      try {
        const verse = await getVerse(activeVerseReference, bibleVersionId ?? undefined);
        const chunks = await chunkVerseWithGloo(verse.text);
        setVerseChunks(chunks);
      } catch {
        // getVerse already logs a game-log message on failure.
      }
    }

    if (userId) {
      loadVerse();
    }
  }, [userId, bibleVersionId, activeVerseReference, setVerseChunks]);

  return (
    <div className="flex-1 flex flex-col w-full h-full">
      {/* Top Navigation Bar - Keeps the player oriented */}
      <div className="flex justify-between items-center border-b-4 border-black pb-3 mb-4 shrink-0 bg-slate-900 p-4 rounded-xl shadow-[4px_4px_0px_#000]">
        <span className="text-cyan-400 font-black tracking-widest uppercase text-sm">
          📍 Quest: The Gardener's Trail
        </span>
        <button 
          onClick={() => {
            setCurrentScreen('OVERWORLD');
            setFeedback('');
          }} 
          className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 text-xs font-black uppercase tracking-wider rounded border-2 border-black shadow-[2px_2px_0px_#000] active:translate-y-1"
        >
          🗺️ Return to Map
        </button>
      </div>

      {/* The Dynamic Stage Area - Renders the current scene */}
      <div className="flex-1 w-full h-full relative">
        
        {currentScene === 'CROSSROADS' && (
          <div className="w-full h-full relative flex flex-col">
            <CrossroadsScene onComplete={() => setCurrentScene('HUNGER')} />
         </div>
        )}

        {currentScene === 'HUNGER' && (
          <div className="w-full h-full relative flex flex-col">
            <HungerTrialScene onComplete={() => setCurrentScene('RIVER')} />
          </div>
        )}

        {currentScene === 'RIVER' && (
          <RushingWatersScene onComplete={() => setCurrentScene('BATTLE_READY')} />
        )}

        {currentScene === 'BATTLE_READY' && (
          <div className="absolute inset-0 z-30 flex items-center justify-center p-6 sm:p-10">
            <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" />
            <div className="relative w-full max-w-xl bg-amber-100 border-4 border-black rounded-2xl shadow-[8px_8px_0px_#000] p-8 flex flex-col items-center text-black overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(#eab308_1px,transparent_1px)] [background-size:16px_16px] opacity-20 pointer-events-none" />

              <h1 className="relative text-3xl font-black mb-4 text-center">⚔️ WEAPON FORGED ⚔️</h1>

              {/* 3. NEW: Dynamically joins your chunks with a space! */}
              <p className="relative text-lg font-bold italic mb-8 text-center">
                "{activeVerseReference}: {verseChunks.length > 0 ? verseChunks.join(' ') : 'Forging weapon...'}"
              </p>

              <button
                onClick={() => setCurrentScreen('CHEST_RETURN')}
                className="relative bg-green-500 hover:bg-green-400 text-white border-4 border-black py-3 px-8 rounded-xl font-black text-xl shadow-[4px_4px_0px_#000] animate-pulse"
              >
                CONTINUE
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}