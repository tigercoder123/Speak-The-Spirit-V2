'use client';

import React, { useState, useEffect } from 'react';
import { useGame } from '../../../context/GameContext';
import { addLog } from '../../../utils/gameEvents';
import { askAngelGabriel, generateAdaptiveQuestion, verifyComprehension } from '../../../app/actions/gloo';
import CrossroadsMap from './CrossroadsMap';
import AngelConsole from './AngelConsole';

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

export default function CrossroadsScene({ onComplete }: { onComplete?: () => void }) {
  // 1. NEW: Grab verseChunks from useGame!
  const { setCurrentScreen, verseChunks, characterPath, displayName, gradeLevel, setCurrentTrack } = useGame();

  // 2. 🎵 Tell the game to play the crossroads music when this scene loads!
  useEffect(() => {
    setCurrentTrack('/audio/crossroads.mp3');
  }, [setCurrentTrack]);

  const [stageState, setStageState] = useState('riddle-intro');
  const [explanationAccepted, setExplanationAccepted] = useState(false);
  const [verificationState, setVerificationState] = useState<'none' | 'pending-chat'>('none');
  const [activeComprehensionQuestion, setActiveComprehensionQuestion] = useState("");

  const [currentQuestion, setCurrentQuestion] = useState<DynamicQuestion | null>(null);
  const [attempts, setAttempts] = useState(0);

  const [angelChat, setAngelChat] = useState(`Greetings, ${displayName || 'Traveler'}! Before you take a single step, you must decode the riddle above. Click the scroll on the left to begin!`);
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

  const loadQuestionAndExplanation = async (remedialPrompt: string = "", currentAttemptIndex: number) => {
    setIsThinking(true);
    
    if (gradeLevel?.toLowerCase().includes('tk') || currentAttemptIndex >= 1) {
      setActiveComprehensionQuestion("Do we trust God?");
      setAngelChat(remedialPrompt ? "Not quite! Let's try an easier one. Do we trust God?" : "Faith means trusting God! Do we trust God?");
      setCurrentQuestion({
        question: "Do we trust God?",
        optionA: "Yes",
        optionB: "No",
        correctOption: "A"
      });
      setIsThinking(false);
      return; 
    }

    // 🌟 2. 2ND-3RD GRADE OVERRIDE (NEW!)
    if (gradeLevel?.toLowerCase().includes('2') || gradeLevel?.toLowerCase().includes('3')) {
      setActiveComprehensionQuestion("What is faith?");
      setAngelChat("Faith is active trust! Let's see if you can fill in the blank.");
      setCurrentQuestion({
        question: "Faith is ________.",
        optionA: "trust",
        optionB: "cool",
        correctOption: "A"
      });
      setIsThinking(false);
      return; 
    }

    const conceptName = "Faith";
    const correctRule = "Active loyalty, deep trust, and doing what the Gardener says (taking action).";
    const incorrectRule = "Just memorizing lists of facts and trivia about the Gardener, or passive head-knowledge without movement.";

    const metaphors = [
      "Pistis means active trust. It's like sitting on a chair: you don't just look at it, you have to actually sit down!",
      "Pistis is active trust. Think of walking through a door: you don't just stare at it, you have to step through!",
      "Pistis is active trust. It's like the wind: you step forward trusting it will carry your kite!"
    ];
    
    const chosenMetaphor = metaphors[currentAttemptIndex % metaphors.length];
    const dynamicComprehensionQuestion = currentAttemptIndex === 1 
      ? "If you just stare at a door handle, how do you get to the other side? What action must you take?"
      : "If you want the wind to fly your kite, what must you physically do with the string?";
    
    setActiveComprehensionQuestion(dynamicComprehensionQuestion);

    const explanationInstructions = `
      The ${displayName || 'Traveler'} is learning about ${conceptName}. Attempt number ${currentAttemptIndex + 1}.
      ${remedialPrompt ? `REMEDIAL: The child answered incorrectly. ${remedialPrompt} Pivot to why the correct choice was right. End by asking: "${dynamicComprehensionQuestion}"` : `INTRO: Explain "Pistis" (active trust) using this analogy: "${chosenMetaphor}".`}
      Keep the entire message warm and brief (maximum 3 sentences).
    `;

    try {
      const angelResponse = await askAngelGabriel("user_123", remedialPrompt ? "Teach me from my mistake!" : `Introduce ${conceptName} dynamically.`, explanationInstructions);
      setChatLog(prev => [...prev, { sender: 'angel', text: angelResponse.reply || `Remember, faith is active trust. ${chosenMetaphor}` }]);
      
      const quizResponse = await generateAdaptiveQuestion("user_123", conceptName, correctRule, incorrectRule, remedialPrompt, currentAttemptIndex);
      if (quizResponse.questionData) setCurrentQuestion(quizResponse.questionData as DynamicQuestion);
    } catch (err) {
      setChatLog(prev => [...prev, { sender: 'angel', text: `Let's think about this: faith is active trust. ${chosenMetaphor}` }]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleChestClick = async () => {
    setStageState('lock-challenge');
    setCurrentTrack('/audio/question.mp3');
    setExplanationAccepted(false);
    setVerificationState('none');
    setAttempts(0);
    setAngelChat(`Hold on, ${displayName || 'Traveler'}! To unlock this chest, we must first learn what Faith truly is. Let me teach you...`);
    await loadQuestionAndExplanation("", 0);
  };

  const handleAnswerSubmit = async (selectedOption: 'A' | 'B' | 'C') => {
    if (!currentQuestion) return;

    const chosenText = selectedOption === 'A' ? currentQuestion.optionA : (selectedOption === 'B' ? currentQuestion.optionB : currentQuestion.optionC);

    // 🛡️ CATCH ALTERNATIVE AI KEYS
    // The AI might be ignoring our interface and using a different word for the answer key!
    const aiQuestion = currentQuestion as any; 
    const rawCorrect = String(
      aiQuestion.correctOption || 
      aiQuestion.correctAnswer || 
      aiQuestion.correct_option || 
      aiQuestion.answer || 
      aiQuestion.correct || 
      ""
    ).trim();
    
    // AUTO-REROLL: Only trigger if the AI *truly* forgot to include the answer anywhere
    if (!rawCorrect || rawCorrect === "undefined") {
      setChallengeFeedback("Oops! The heavenly static scrambled the answer key. Asking Gabriel for a fresh question...");
      // Pass an empty string so Gabriel just does a normal re-introduction!
      await loadQuestionAndExplanation("", attempts);
      return; 
    }

    const isCorrect = 
      selectedOption === rawCorrect.toUpperCase() || 
      rawCorrect.toUpperCase().startsWith(selectedOption) || 
      (chosenText && rawCorrect.toLowerCase().includes(chosenText.toLowerCase().trim())); 

    if (isCorrect) {
      setStageState('solved');
      addLog("Successfully broke the lock!", "system");
      setIsThinking(true);
      try {
        const res = await askAngelGabriel("user_123", "Explain why my correct answer was right!", `Player chose: "${chosenText}". Celebrate briefly (1-2 sentences) and explain why this is true faith.`);
        if (res.reply) { setAngelChat(res.reply); setChatLog(prev => [...prev, { sender: 'angel', text: res.reply }]); }
      } finally { setIsThinking(false); }
    } else {
      const correctText = currentQuestion.optionA; // Fallback text just in case
      const actualCorrectText = rawCorrect.toUpperCase().includes('A') ? currentQuestion.optionA : (rawCorrect.toUpperCase().includes('B') ? currentQuestion.optionB : currentQuestion.optionC);
      
      const nextAttempt = attempts + 1;
      setAttempts(nextAttempt);
      setChallengeFeedback("Not quite! Angel Gabriel is testing your understanding in the chat before you can retry.");
      setExplanationAccepted(false); 
      setVerificationState('pending-chat'); 
      setAngelChat("That wasn't quite it, Messenger. Answer my question in the chat console on the right so we can clear this up!");
      
      await loadQuestionAndExplanation(`The question asked: "${currentQuestion.question}". Child chose "${chosenText}" instead of "${actualCorrectText || correctText}". Explain why.`, nextAttempt);
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
        const res = await verifyComprehension("user_123", activeComprehensionQuestion, currentQuestionText, "Faith is active trust, physically stepping forward.");
        if (res.evaluation) {
          setChatLog(prev => [...prev, { sender: 'angel', text: res.evaluation.reply }]);
          if (res.evaluation.isUnderstood) {
            setVerificationState('none'); setExplanationAccepted(true); setChallengeFeedback("");
            setAngelChat("Fantastic understanding! Now, try answering this brand-new multiple choice challenge on the left.");
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