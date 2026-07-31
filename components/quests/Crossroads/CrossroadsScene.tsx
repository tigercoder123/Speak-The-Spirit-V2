'use client';

import React from 'react';
import { useGame } from '../../../context/GameContext';
import { addLog } from '../../../utils/gameEvents';
import { useQuestChallenge } from '../../../hooks/useQuestChallenge';
import { CROSSROADS_CONFIG } from '../../../utils/questPrompts';
import CrossroadsMap from './CrossroadsMap';
import AngelConsole from './AngelConsole';

export default function CrossroadsScene({ onComplete }: { onComplete?: () => void }) {
  const { verseChunks, characterPath, displayName } = useGame();

  const {
    stageState, setStageState,
    explanationAccepted, setExplanationAccepted,
    verificationState,
    currentQuestion,
    angelChat, setAngelChat,
    askInput, setAskInput,
    chatLog,
    isThinking,
    challengeFeedback, setChallengeFeedback,
    handleSpeak,
    handleAnswerSubmit,
    handleAskGloo,
    beginChallenge,
  } = useQuestChallenge(CROSSROADS_CONFIG);

  const handleChestClick = async () => {
    await beginChallenge(
      `Hold on, ${displayName || 'Traveler'}! To unlock this chest, we must first learn what Faith truly is. Let me teach you...`,
    );
  };

  return (
    <div className="w-full h-full flex bg-slate-950 border-4 border-black overflow-hidden shadow-[8px_8px_0px_rgba(0,0,0,1)] rounded-xl relative">

      {/* 🔴 LEFT SIDE: INTERACTIVE STAGE (60%) */}
      <div className="w-[60%] h-full bg-slate-900 relative flex flex-col items-center border-r-4 border-black text-white p-4">

        {/* TOP STATUS ROW */}
        <div className="w-full flex justify-between items-center bg-slate-800 border-2 border-black p-2 rounded shadow-[2px_2px_0px_#000] shrink-0 mb-4 z-20">
          <div>
            <h3 className="text-[10px] font-black uppercase text-amber-400">Weapon Tracker</h3>
            {/* 2. NEW: Dynamic Tracker Text */}
            <p className="text-xs font-bold text-slate-200">
              {stageState === 'solved' ? `${verseChunks[0] || "Forging..."}` : "[ _ _ _ _ _ ]"}
            </p>
          </div>

          <div className="flex gap-2">
            {/* 🔊 THE NEW AUDIO BUTTON */}
            <button
              onClick={handleSpeak}
              className="bg-blue-500 hover:bg-blue-400 text-white font-bold py-1 px-3 rounded text-xs border border-black shadow-[1px_1px_0px_#000]"
            >
              🔊 Read Aloud
            </button>

          {stageState === 'lock-challenge' && (
            <div className="flex items-center gap-2 bg-slate-900 px-3 py-1 border border-black rounded">
              <span className="text-xl">🔒</span><span className="text-[10px] font-black uppercase text-amber-400">Lock Puzzle</span>
            </div>
          )}
        </div>
        </div>

        {/* SCENE RENDERING AREA */}
        <div className="flex-1 w-full relative overflow-hidden flex flex-col">

          {stageState === 'riddle-intro' && (
             <div className="m-auto w-full max-w-md bg-amber-50 text-black border-4 border-black p-6 rounded-xl shadow-[6px_6px_0px_#000] animate-bounce-short text-center relative">
               <span className="text-5xl absolute -top-8 left-1/2 -translate-x-1/2 bg-yellow-400 p-2 rounded-full border-4 border-black shadow-[2px_2px_0px_#000]">📜</span>
               <h2 className="text-xl font-black uppercase text-amber-900 mt-4 mb-3">Ancient Message Decoded!</h2>

               {/* THE MISSING RIDDLE TEXT RESTORED */}
               <div className="bg-white border-2 border-black p-4 rounded-lg italic font-bold text-sm text-slate-800 leading-relaxed mb-6">
                 "Where cobblestones end and hidden trails start,<br />
                 Choose the path less traveled with all of your heart."
               </div>

               <button
                 onClick={() => { setStageState('fork'); setAngelChat("Awesome! Use your arrow keys to step off the cobblestones!"); }}
                 className="w-full bg-green-500 hover:bg-green-400 text-white font-black py-3 px-6 rounded-lg border-2 border-black shadow-[4px_4px_0px_#000] transition-transform active:translate-y-1 uppercase tracking-wider text-sm"
               >
                 Begin Quest ➔
               </button>
             </div>
          )}

          {/* 🗺️ DYNAMIC MAP COMPONENT */}
          {(stageState === 'fork' || stageState === 'ghosts' || stageState === 'x-marks' || stageState === 'chest') && (
            <CrossroadsMap
              stageState={stageState}
              characterPath={characterPath}
              onHitGhost={() => {
                setStageState('ghosts');
                setAngelChat("Oh no! The ghosts of doubt! Turn back!");
                addLog("Wandered into the ghosts.", "system");
              }}
              onHitXMarks={() => {
                setStageState('x-marks');
                setAngelChat("You found the dirt trail X! Let's dig!");
                addLog("Found the dirt trail.", "system");
              }}
              onReturnToFork={() => {
                setStageState('fork');
                setAngelChat("Phew, back at the crossroads. Try the other path!");
              }}
              onClickChest={() => {
                setStageState('chest');
                setAngelChat("You dug it up! Click the chest to inspect the lock.");
                if (stageState === 'chest') handleChestClick();
              }}
            />
          )}

          {/* 🔒 LOCK CHALLENGE */}
          {stageState === 'lock-challenge' && currentQuestion && (
            <div className="w-full h-full flex flex-col justify-between animate-fade-in bg-slate-900 overflow-y-auto">
              {/* Challenge UI omitted for brevity, it's identically intact from your file just wrapped nicely! */}
              <div className={`transition-all duration-300 ${explanationAccepted ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
                 <p className="font-bold text-base text-slate-100 leading-relaxed mb-4">{currentQuestion.question}</p>
                 {challengeFeedback && <div className="bg-red-950/80 border-2 border-red-500 text-red-200 font-bold p-2 text-xs rounded mb-3">⚠️ {challengeFeedback}</div>}
                 <div className="space-y-3">
                    <button onClick={() => handleAnswerSubmit('A')} className="w-full text-left bg-slate-800 hover:bg-slate-700 text-white border-2 border-black p-3 font-bold text-xs shadow-[2px_2px_0px_#000] transition-colors rounded">A) {currentQuestion.optionA}</button>
                    <button onClick={() => handleAnswerSubmit('B')} className="w-full text-left bg-slate-800 hover:bg-slate-700 text-white border-2 border-black p-3 font-bold text-xs shadow-[2px_2px_0px_#000] transition-colors rounded">B) {currentQuestion.optionB}</button>
                    {currentQuestion.optionC && <button onClick={() => handleAnswerSubmit('C')} className="w-full text-left bg-slate-800 hover:bg-slate-700 text-white border-2 border-black p-3 font-bold text-xs shadow-[2px_2px_0px_#000] transition-colors rounded">C) {currentQuestion.optionC}</button>}
                 </div>
              </div>
              {!explanationAccepted && (
                 <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center p-4 text-center z-10 rounded">
                    <div className="bg-slate-800 border-2 border-black p-5 rounded-lg shadow-[4px_4px_0px_#000] max-w-sm">
                       <h3 className="font-black uppercase text-amber-400 text-sm mt-2 mb-1">{verificationState === 'pending-chat' ? "Explain the concept to Angel Gabriel in the Chat box to unlock your retry!" : "Read Angel Gabriel's lesson in the Chat Console first!"}</h3>
                       {verificationState !== 'pending-chat' && (
                          <button disabled={isThinking} onClick={() => { setExplanationAccepted(true); setChallengeFeedback(""); setAngelChat("Ready? Answer the fresh question now!"); }} className="bg-blue-400 text-black font-black text-xs py-2.5 px-6 rounded border-2 border-black shadow-[2px_2px_0px_#000]">{isThinking ? "Preparing..." : "Okay"}</button>
                       )}
                    </div>
                 </div>
              )}
            </div>
          )}

          {/* ✅ SOLVED STAGE */}
          {stageState === 'solved' && (
            <div className="w-full h-full bg-slate-900 flex flex-col items-center justify-center bg-[radial-gradient(#eab308_1px,transparent_1px)] [background-size:16px_16px]">
              <div className="bg-yellow-100 border-4 border-black p-8 shadow-[8px_8px_0px_#000] max-w-sm text-center animate-fade-in text-black">
                <h2 className="text-2xl font-black mb-2 uppercase tracking-wide text-amber-900">📜 SCROLL UNLOCKED</h2>
                {/* 3. NEW: Dynamic Solved Text */}
                <p className="text-xl font-bold italic text-slate-800">
                  "{verseChunks[0] || "Forging..."}"
                </p>
              </div>
              <div className="w-32 h-32 mt-8 drop-shadow-xl animate-bounce"><img src={characterPath} alt="Character" className="w-full h-full object-contain" /></div>
            </div>
          )}
        </div>
      </div>

      {/* 🔵 RIGHT SIDE: ANGEL CONSOLE COMPONENT */}
      <AngelConsole
        angelChat={angelChat}
        chatLog={chatLog}
        isThinking={isThinking}
        askInput={askInput}
        setAskInput={setAskInput}
        handleAskGloo={handleAskGloo}
        verificationState={verificationState}
        stageState={stageState}
        onComplete={onComplete}
      />
    </div>
  );
}
