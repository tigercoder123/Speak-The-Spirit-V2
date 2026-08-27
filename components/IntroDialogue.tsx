'use client';

import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { addLog } from '../utils/gameEvents';

export default function IntroDialogue() {
  const { setCurrentScreen } = useGame();
  const [isLetterOpened, setIsLetterOpened] = useState(false);

  const handleBreakSeal = () => {
    setIsLetterOpened(true);
    addLog("The Gardener's seal has been broken. The vision begins...", "system");
  };

  const handleEnterOverworld = () => {
    addLog("Entered the Overworld Map. The quest for the Songbeasts begins!", "system");
    setCurrentScreen('QUEST');
  };

  return (
    <div className="flex-1 flex flex-col justify-between relative">
      <div className="absolute inset-0 -m-6 bg-gradient-to-b from-red-950 via-slate-950 to-slate-950 opacity-90 -z-10 overflow-hidden">
        <div className="absolute top-10 left-1/4 w-72 h-72 bg-red-600/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-10 right-1/4 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl animate-pulse delay-700"></div>
        <div className="absolute inset-0 opacity-25 bg-[radial-gradient(#f97316_1px,transparent_1px)] [background-size:24px_24px] animate-pulse"></div>
      </div>

      <div>
        <div className="flex justify-between items-center border-b-2 border-slate-700 pb-3 mb-4">
          <span className="text-red-400 font-black tracking-widest uppercase text-xs">Phase 1: Cinematic Introduction</span>
          <button 
            onClick={() => {
              setCurrentScreen('OVERWORLD');
              addLog("Skipped introduction sequence.", "system");
            }} 
            className="bg-slate-700 text-slate-300 hover:text-white px-2.5 py-1 text-xs font-bold rounded border border-black"
          >
            Skip Intro ⏭️
          </button>
        </div>

        <div className="my-4 min-h-[400px] flex items-center justify-center">
          {!isLetterOpened ? (
            <div className="flex flex-col items-center justify-center p-8 bg-orange-100 border-4 border-black shadow-[8px_8px_0px_#000] max-w-md w-full text-center animate-float">
              <div className="text-8xl mb-6">✉️</div>
              <h2 className="text-2xl font-black text-black uppercase mb-4 tracking-tighter">A Sealed Message</h2>
              <p className="text-slate-700 font-bold mb-8">The Gardener has left a vision of the Silent Valley. Break the seal to witness the truth.</p>
                <button 
                onClick={handleBreakSeal} 
                className="bg-yellow-400 text-black font-black uppercase text-sm px-8 py-4 rounded-xl neo-btn animate-bounce"
              >
                ✉️ BREAK THE GARDENER&apos;S SEAL ✉️
              </button>
            </div>
          ) : (
            <div className="w-full max-w-5xl aspect-video border-4 border-black shadow-[12px_12px_0px_#000] bg-black overflow-hidden">
              <video 
                src="/introcompress.mp4" 
                autoPlay 
                playsInline 
                className="w-full h-full object-cover"
              />
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 pt-4 border-t-2 border-slate-700 flex items-center justify-between">
        <span className="text-slate-400 text-xs">
          {isLetterOpened ? "Vision active..." : "Awaiting activation..."}
        </span>
        {isLetterOpened && (
          <button
            onClick={handleEnterOverworld}
            className="bg-green-500 text-white font-black uppercase text-sm px-6 py-3 rounded-xl neo-btn"
          >
            Begin Quest!
          </button>
        )}
      </div>
    </div>
  );
}
