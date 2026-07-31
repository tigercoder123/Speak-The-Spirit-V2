'use client';

import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import SettingsModal from './SettingsModal';

export default function GameHeader() {
  const {
    cupcakes,
    cucumbers,
    hasHolyWater,
    handleLogout,
    userId,
    loginMethod,
    setCurrentScreen,
    setFeedback,
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
  <div className="flex gap-2 ml-2">
    <button
      onClick={handleLogout}
      className="bg-red-600 text-white hover:bg-red-700 border-2 border-black px-2 py-0.5 rounded-lg font-black text-[10px] uppercase neo-btn"
    >
      Logout
    </button>
    <button
      onClick={() => {
        setCurrentScreen('OVERWORLD');
        setFeedback('');
      }}
      className="bg-cyan-600 text-white hover:bg-cyan-500 border-2 border-black px-2 py-0.5 rounded-lg font-black text-[10px] uppercase neo-btn"
    >
      🗺️ Return to Map
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
