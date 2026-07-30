'use client';

import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import SettingsModal from './SettingsModal';

export default function GameHeader() {
  const {
    cupcakes,
    cucumbers,
    tickets,
    hasHolyWater,
    handleResetGame,
    handleLogout,
    userId,
    loginMethod,
    setCurrentScreen,
    setPendingBattleSkipToRestored,
  } = useGame();

  const [showSettings, setShowSettings] = useState(false);

  return (
    <header className="w-full bg-yellow-400 text-black neo-card py-1.5 px-4 flex flex-row items-center justify-between gap-4 rounded-none z-10">
      <div className="flex items-center gap-3">
        <span className="text-xl">🛡️</span>
        <div>
          <h1 className="text-sm font-black tracking-wider uppercase">Speak The Spirit</h1>
          <div className="flex items-center gap-2 text-[9px] font-bold text-black/75 uppercase">
            <span>Hackathon Prototype v1.0</span>
            {userId && (
              <span className="bg-black/10 px-1 py-0.5 rounded flex items-center gap-1">
                👤 {userId.substring(0, 8)}...
              </span>
            )}
            {!userId && loginMethod && (
              <span className="bg-black/10 px-1 py-0.5 rounded flex items-center gap-1">
                ✉️ Social Logged In
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Replace the "Currency & Gear Inventory Panel" section with this: */}

<div className="flex items-center gap-2 text-xs font-bold">
  {/* Keeps track of progress without showing shop currency */}
  <div className="bg-white py-0.5 px-3 border-2 border-black rounded-lg flex items-center gap-1.5 shadow-[2px_2px_0px_0px_#000]">
    <span>🎟️ Realm Passes:</span>
    <span className="text-indigo-600 text-xs">{tickets}</span>
  </div>

  <div className="flex gap-2 ml-2">
    <button
      onClick={() => setCurrentScreen('BATTLE')}
      title="Dev cheat: jump straight to the battle scene"
      className="bg-purple-700 text-white hover:bg-purple-600 border-2 border-black px-2 py-0.5 rounded-lg font-black text-[10px] uppercase neo-btn"
    >
      ⚔️ Cheat: Battle
    </button>
    <button
      onClick={() => {
        setPendingBattleSkipToRestored(true);
        setCurrentScreen('BATTLE');
      }}
      title="Dev cheat: jump straight to the battle scene with the Songbeast already restored"
      className="bg-emerald-700 text-white hover:bg-emerald-600 border-2 border-black px-2 py-0.5 rounded-lg font-black text-[10px] uppercase neo-btn"
    >
      ⭐ Cheat: Restored
    </button>
    <button
      onClick={handleResetGame}
      className="bg-orange-500 text-white hover:bg-orange-600 border-2 border-black px-2 py-0.5 rounded-lg font-black text-[10px] uppercase neo-btn"
    >
      Reset
    </button>
    <button
      onClick={handleLogout}
      className="bg-red-600 text-white hover:bg-red-700 border-2 border-black px-2 py-0.5 rounded-lg font-black text-[10px] uppercase neo-btn"
    >
      Logout
    </button>
    <button
      onClick={() => setShowSettings(true)}
      title="Change verse language/translation"
      className="bg-slate-700 text-white hover:bg-slate-600 border-2 border-black px-2 py-0.5 rounded-lg font-black text-[10px] uppercase neo-btn"
    >
      ⚙️ Settings
    </button>
  </div>
</div>
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </header>
  );
}
