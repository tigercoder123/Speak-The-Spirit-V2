'use client';

import React, { useState } from 'react';
import { useGame } from '../../../context/GameContext';
import { useQuestChallenge } from '../../../hooks/useQuestChallenge';
import { HUNGER_TRIAL_CONFIG } from '../../../utils/questPrompts';
import AngelConsole from '../Crossroads/AngelConsole';
import HungerTrialStage from './HungerTrialStage'; // Import our separated visual component

export default function HungerTrialScene({ onComplete }: { onComplete?: () => void }) {
  const { characterPath, verseChunks } = useGame();
  const [selectedAction, setSelectedAction] = useState<'fishing' | 'fruit' | null>(null);

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
  } = useQuestChallenge(HUNGER_TRIAL_CONFIG);

  return (
    <div className="w-full h-full flex bg-slate-950 border-4 border-black overflow-hidden shadow-[8px_8px_0px_#000] rounded-xl relative">

      {/* 🔴 LEFT SIDE: INTERACTIVE STAGE (60%) */}
      <div className="w-[60%] h-full bg-slate-900 relative flex flex-col items-center border-r-4 border-black text-white p-4">

        {/* TOP STATUS ROW */}
        <div className="w-full flex justify-between items-center bg-slate-800 border-2 border-black p-2 rounded shadow-[2px_2px_0px_#000] shrink-0 mb-4 z-20">
          <div>
            <h3 className="text-[10px] font-black uppercase text-amber-400">Weapon Tracker</h3>
            <p className="text-xs font-bold text-slate-200">
              {stageState === 'solved' ? `${verseChunks[0]} ${verseChunks[1]}` : `${verseChunks[0]}` + " [ _ _ _ _ _ ]"}
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
            </div>
            </div>



        {/* 🗺️ RENDER VISUAL STAGE OR LOCK CHALLENGE */}
        {(stageState !== 'lock-challenge') ? (
          <HungerTrialStage
            stageState={stageState}
            characterPath={characterPath}
            selectedAction={selectedAction}
            onStartWalk={() => {
              setStageState('desert-walk');
              setAngelChat("Use the arrow keys to walk through the desert.");
            }}
            onReachOasis={() => {
              setStageState('garden-choice');
              setAngelChat("You made it to the Gardener's Oasis! How will you receive your provision?");
            }}
            onActionSelect={(action) => {
              setSelectedAction(action);
              setStageState('action-scene');
              setAngelChat("Wonderful choice! You trusted the Gardener to provide, and your needs are met.");
            }}
            onTransitionToChallenge={async () => {
              // 🔄 Dynamic router check added here to control the map-to-scroll transitions safely:
              if (stageState === 'chest-oasis') {
                await beginChallenge("Now that your physical hunger is satisfied, let's feed your spirit. Let me explain what this trial means...");
              } else {
                setStageState('quarter-rest');
                setAngelChat("Look around! Your provision revealed a secret signature hidden right in the environment!");
              }
            }}
            onDiscoverChest={() => {
              setStageState('chest-oasis');
              setAngelChat("Incredible! Stepping onto the rest uncovered a hidden treasure chest. Go click it!");
            }}
          />
        ) : (
          <div className="w-full h-full flex flex-col bg-slate-900 p-6 overflow-y-auto rounded border-4 border-black shadow-[inset_4px_4px_0px_rgba(0,0,0,0.5)] relative">
            {currentQuestion && (
              <>
                <div className={`transition-all duration-300 ${explanationAccepted ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
                   <p className="font-bold text-base text-slate-100 leading-relaxed mb-4">{currentQuestion.question}</p>
                   {challengeFeedback && <div className="bg-red-950/80 border-2 border-red-500 text-red-200 font-bold p-2 text-xs rounded mb-3">⚠️ {challengeFeedback}</div>}
                   <div className="space-y-3">
                      <button onClick={() => handleAnswerSubmit('A')} className="w-full text-left bg-slate-800 hover:bg-slate-700 text-white border-2 border-black p-3 font-bold text-sm shadow-[2px_2px_0px_#000] transition-colors rounded">A) {currentQuestion.optionA}</button>
                      <button onClick={() => handleAnswerSubmit('B')} className="w-full text-left bg-slate-800 hover:bg-slate-700 text-white border-2 border-black p-3 font-bold text-sm shadow-[2px_2px_0px_#000] transition-colors rounded">B) {currentQuestion.optionB}</button>
                      {currentQuestion.optionC && <button onClick={() => handleAnswerSubmit('C')} className="w-full text-left bg-slate-800 hover:bg-slate-700 text-white border-2 border-black p-3 font-bold text-sm shadow-[2px_2px_0px_#000] transition-colors rounded">C) {currentQuestion.optionC}</button>}
                   </div>
                </div>
                {!explanationAccepted && (
                   <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center p-4 text-center z-10 rounded">
                      <div className="bg-slate-800 border-2 border-black p-5 rounded-lg shadow-[4px_4px_0px_#000] max-w-sm">
                         <h3 className="font-black uppercase text-amber-400 text-sm mt-2 mb-1">{verificationState === 'pending-chat' ?  "Explain the concept to Angel Gabriel in the Chat box to unlock your retry!" : "Read Angel Gabriel's lesson in the Chat Console first!"}</h3>
                         {verificationState !== 'pending-chat' && (
                            <button disabled={isThinking} onClick={() => { setExplanationAccepted(true); setChallengeFeedback(""); setAngelChat("Ready? Answer the challenge!"); }} className="bg-blue-400 text-black font-black text-xs py-2.5 px-6 rounded border-2 border-black shadow-[2px_2px_0px_#000]">{isThinking ? "Preparing..." : "Okay"}</button>
                         )}
                      </div>
                   </div>
                )}
              </>
            )}
          </div>
        )}
      </div>


      {/* 🔵 RIGHT SIDE: ANGEL CONSOLE */}
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
