'use client';

import React, { useState, useEffect } from 'react';
import { useGame } from '../../../context/GameContext';
import { addLog } from '../../../utils/gameEvents';
import { askAngelGabriel, generateAdaptiveQuestion, verifyComprehension } from '../../../app/actions/gloo';
import AngelConsole from '../Crossroads/AngelConsole';
import RushingWatersStage from './RushingWatersStage'; 

interface ChatMessage {
  sender: 'you' | 'angel';
  text: string;
}

interface DynamicQuestion {
  question: string;
  optionA: string;
  optionB: string;
  optionC?: string;
  correctOption: 'A' | 'B' | 'C';
}

export default function RushingWatersScene({ onComplete }: { onComplete?: () => void }) {
  const { setCurrentScreen, characterPath, gradeLevel, setCurrentTrack } = useGame();

  const [stageState, setStageState] = useState('riddle-intro');

  useEffect(() => {
    setCurrentTrack('/audio/waters.mp3');
  }, [setCurrentTrack]);

  // 🧠 AI & GLOO STATES
  const [explanationAccepted, setExplanationAccepted] = useState(false);
  const [verificationState, setVerificationState] = useState<'none' | 'pending-chat'>('none');
  const [activeComprehensionQuestion, setActiveComprehensionQuestion] = useState("");
  const [currentQuestion, setCurrentQuestion] = useState<DynamicQuestion | null>(null);
  const [attempts, setAttempts] = useState(0);
  
  const [angelChat, setAngelChat] = useState("Traveler, the river looks wild and deep. But remember... no boat is docked, no timber groans. Read the riddle!");
  const [askInput, setAskInput] = useState("");
  const [chatLog, setChatLog] = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [challengeFeedback, setChallengeFeedback] = useState("");

  // 2. ADD THE TTS FUNCTION HERE
  const handleSpeak = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); 
      const utterance = new SpeechSynthesisUtterance(angelChat);
      utterance.rate = 0.9;  
      utterance.pitch = 1.2; 
      window.speechSynthesis.speak(utterance);
    }
  };

  const { verseChunks } = useGame();

  const loadQuestionAndExplanation = async (remedialPrompt: string = "", currentAttemptIndex: number) => {
    setIsThinking(true);
    
    // 🌟 TK-1ST GRADE / RETRY OVERRIDE
    if (gradeLevel?.toLowerCase().includes('tk') || currentAttemptIndex >= 1) {
      setActiveComprehensionQuestion("Can we always see God?");
      setAngelChat(remedialPrompt 
        ? "Not quite! Let's think about this. Can we always see God with our eyes?" 
        : "We can have confidence even when we can't see Him! Can we always see God?");
      setCurrentQuestion({
        question: "Can we always see God with our eyes?",
        optionA: "No",
        optionB: "Yes",
        correctOption: "A" // "No" is the correct answer here!
      });
      setIsThinking(false);
      return; 
    }

    // 🌟 2. 2ND-3RD GRADE OVERRIDE (NEW!)
    if (gradeLevel?.toLowerCase().includes('2') || gradeLevel?.toLowerCase().includes('3')) {
      setActiveComprehensionQuestion("Do we need to see God to trust Him?");
      setAngelChat("We can have confidence even when we can't see Him! Fill in the blank.");
      setCurrentQuestion({
        question: "We can trust God even when we ________ see Him.",
        optionA: "cannot",
        optionB: "can",
        correctOption: "A"
      });
      setIsThinking(false);
      return; 
    }

    const conceptName = "Trusting in things not seen.";
    const correctRule = "Trusting in the Gardener and His promises, even when your eyes see absolutely nothing.";
    const incorrectRule = "Trusting only in your own physical sight, tools, and abilities to make a bridge or boat.";

    const metaphors = [
      "Sometimes you have faith in things you can't actually see with your eyes! Just like gravity or a radio frequency, just because you can't see it doesn't mean it isn't real and holding you up.",
      "We can be sure something esists without seeing it physically. The Gardener's character is our proof, even when the river looks scary!",
    ];
    
    const chosenMetaphor = metaphors[currentAttemptIndex % metaphors.length];
    const dynamicComprehensionQuestion = currentAttemptIndex === 1 
      ? "If you step onto the water without a boat, what unseen reality are you trusting to hold you up?"
      : "Can you name one thing in real life (like gravity) that is invisible but completely real?";
    
    setActiveComprehensionQuestion(dynamicComprehensionQuestion);

    const explanationInstructions = `
      The player is learning about "${conceptName}". Attempt number ${currentAttemptIndex + 1}.
      They just crossed a rushing river on an invisible bridge.
      ${remedialPrompt ? `REMEDIAL: ${remedialPrompt} End by asking: "${dynamicComprehensionQuestion}"` : `INTRO: Explain the concept of 'things not seen' using this analogy: "${chosenMetaphor}".`}
      Keep the entire message warm and brief (maximum 3 sentences).
    `;

    try {
      const angelResponse = await askAngelGabriel("user_123", remedialPrompt ? "Teach me from my mistake!" : `Introduce ${conceptName}.`, explanationInstructions);
      setChatLog(prev => [...prev, { sender: 'angel', text: angelResponse.reply || `Remember, ${chosenMetaphor}` }]);
      
      const quizResponse = await generateAdaptiveQuestion("user_123", conceptName, correctRule, incorrectRule, remedialPrompt, currentAttemptIndex);
      if (quizResponse.questionData) setCurrentQuestion(quizResponse.questionData as DynamicQuestion);
    } catch (err) {
      setChatLog(prev => [...prev, { sender: 'angel', text: `Let's think about this: ${chosenMetaphor}` }]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleAnswerSubmit = async (selectedOption: 'A' | 'B' | 'C') => {
    if (!currentQuestion) return;
    const chosenText = selectedOption === 'A' ? currentQuestion.optionA : (selectedOption === 'B' ? currentQuestion.optionB : currentQuestion.optionC);

    if (selectedOption === currentQuestion.correctOption) {
      setStageState('solved');
      addLog("Mastered 'things not seen' concept!", "system");
      setIsThinking(true);
      try {
        const res = await askAngelGabriel("user_123", "Explain why my correct answer was right!", `Player chose: "${chosenText}". Celebrate briefly and mention we are ready to battle the silencer.`);
        if (res.reply) { setAngelChat(res.reply); setChatLog(prev => [...prev, { sender: 'angel', text: res.reply }]); }
      } finally { setIsThinking(false); }
    } else {
      const correctText = currentQuestion.correctOption === 'A' ? currentQuestion.optionA : (currentQuestion.correctOption === 'B' ? currentQuestion.optionB : currentQuestion.optionC);
      const nextAttempt = attempts + 1;
      setAttempts(nextAttempt);
      setChallengeFeedback("Not quite! Let's chat about it on the right.");
      setExplanationAccepted(false); 
      setVerificationState('pending-chat'); 
      setAngelChat("That wasn't quite it. Answer my question in the chat console so we can clear this up!");
      await loadQuestionAndExplanation(`Child chose "${chosenText}" instead of "${correctText}". Explain why.`, nextAttempt);
    }
  };

  const handleAskGloo = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentQuestionText = askInput.trim();
    if (!currentQuestionText) return;

    setAskInput("");
    setChatLog(prev => [...prev, { sender: 'you', text: currentQuestionText }]);
    setIsThinking(true);

    if (verificationState === 'pending-chat') {
      try {
        const res = await verifyComprehension("user_123", activeComprehensionQuestion, currentQuestionText, "Conviction/Assurance means acting on the unseen realities promised by the Gardener.");
        if (res.evaluation) {
          setChatLog(prev => [...prev, { sender: 'angel', text: res.evaluation.reply }]);
          if (res.evaluation.isUnderstood) {
            setVerificationState('none'); setExplanationAccepted(true); setChallengeFeedback("");
            setAngelChat("Fantastic! Try this brand-new challenge on the left.");
          }
        }
      } finally { setIsThinking(false); }
    } else {
      try {
        // Give the angel the answer key (as text) so its hint always matches the
        // option the game is checking against — it just can't say the letter outright.
        const q = currentQuestion;
        const correctText = q ? (q.correctOption === 'A' ? q.optionA : q.correctOption === 'B' ? q.optionB : q.optionC) : '';
        const optionsList = q ? `Options: A) ${q.optionA}; B) ${q.optionB}${q.optionC ? `; C) ${q.optionC}` : ''}.` : '';
        const res = await askAngelGabriel("user_123", currentQuestionText, `The child is stuck on this multiple-choice question: "${q?.question}". ${optionsList} The correct answer is: "${correctText}". Give a warm hint that nudges them toward that correct answer, but NEVER say the letter or repeat the answer word-for-word.`);
        if (res.reply) setChatLog(prev => [...prev, { sender: 'angel', text: res.reply }]);
      } finally { setIsThinking(false); }
    }
  };

  return (
    <div className="w-full h-full flex bg-slate-950 border-4 border-black overflow-hidden shadow-[8px_8px_0px_#000] rounded-xl relative">
      
      {/* 🔴 LEFT SIDE: INTERACTIVE STAGE (60%) */}
      <div className="w-[60%] h-full bg-slate-900 relative flex flex-col items-center border-r-4 border-black text-white p-4">
        
        {/* TOP STATUS ROW */}
        <div className="w-full flex justify-between items-center bg-slate-800 border-2 border-black p-2 rounded shadow-[2px_2px_0px_#000] shrink-0 mb-4 z-20">
          <div>
            <h3 className="text-[10px] font-black uppercase text-amber-400">Weapon Tracker</h3>
            <p className="text-xs font-bold text-slate-200">
              {stageState === 'solved' ? `${verseChunks[0]} ${verseChunks[1]} ${verseChunks[2]}` : `${verseChunks[0]} ${verseChunks[1]}` + " [ _ _ _ _ _ ]"}
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
          <RushingWatersStage 
            stageState={stageState}
            characterPath={characterPath}
            onStartCrossing={() => {
              setStageState('river-crossing');
              setAngelChat("Use your arrow keys to step onto the water. What are you walking on?");
            }}
            onCrossedRiver={() => {
              setStageState('find-clef');
              setAngelChat("You made it across! Walk the path and look for the Treble Clef.");
            }}
            onFoundClef={() => {
              setStageState('chest-scene');
              setAngelChat("You found it! The mark has revealed a chest! Click on it to open it.");
            }}
            onOpenChest={async () => {
              setStageState('lock-challenge');
              setCurrentTrack('/audio/question.mp3');
              setExplanationAccepted(false);
              setVerificationState('none');
              setAttempts(0);
              setAngelChat("To unlock the chest, let's learn what 'things not seen' actually means!");
              await loadQuestionAndExplanation("", 0);
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
                         <h3 className="font-black uppercase text-amber-400 text-sm mt-2 mb-1">{verificationState === 'pending-chat' ? "Explain the concept to Angel Gabriel in the Chat box to unlock your retry!" : "Read Angel Gabriel's lesson in the Chat Console first!"}</h3>
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