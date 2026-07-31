'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useGame } from '../context/GameContext';
import { addLog } from '../utils/gameEvents';
import { askAngelGabriel, generateAdaptiveQuestion, verifyComprehension } from '../app/actions/gloo';
import { ChatMessage, DynamicQuestion } from '../utils/questTypes';
import { QuestConfig } from '../utils/questPrompts';

/**
 * Shared logic for the three quest scenes (Crossroads / HungerTrial / RushingWaters).
 * All AI-prompt text is supplied via `config` (see utils/questPrompts.ts) so this hook is pure
 * control flow: the grade overrides, the Gloo lesson+question load, answer checking, and the
 * chat/hint handling. Scenes keep only their own visual stage machine + JSX.
 */
export function useQuestChallenge(config: QuestConfig) {
  const { displayName, gradeLevel, setCurrentTrack } = useGame();

  // Play the scene's entry music when it mounts.
  useEffect(() => {
    setCurrentTrack(config.music);
  }, [setCurrentTrack, config.music]);

  const [stageState, setStageState] = useState('riddle-intro');
  const [explanationAccepted, setExplanationAccepted] = useState(false);
  const [verificationState, setVerificationState] = useState<'none' | 'pending-chat'>('none');
  const [activeComprehensionQuestion, setActiveComprehensionQuestion] = useState('');
  const [currentQuestion, setCurrentQuestion] = useState<DynamicQuestion | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [angelChat, setAngelChat] = useState(() => config.initialAngelChat(displayName));
  const [askInput, setAskInput] = useState('');
  const [chatLog, setChatLog] = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [challengeFeedback, setChallengeFeedback] = useState('');

  const handleSpeak = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(angelChat);
      utterance.rate = 0.9;
      utterance.pitch = 1.2;
      window.speechSynthesis.speak(utterance);
    }
  };

  const loadQuestionAndExplanation = async (remedialPrompt = '', currentAttemptIndex: number) => {
    setIsThinking(true);

    // TK / 1st-grade override — also fires on any retry (currentAttemptIndex >= 1).
    if (gradeLevel?.toLowerCase().includes('tk') || currentAttemptIndex >= 1) {
      const o = config.tkOverride;
      setActiveComprehensionQuestion(o.comprehensionQuestion);
      setAngelChat(o.angelChat(!!remedialPrompt));
      setCurrentQuestion(o.question);
      setIsThinking(false);
      return;
    }

    // 2nd-3rd grade override.
    if (gradeLevel?.toLowerCase().includes('2') || gradeLevel?.toLowerCase().includes('3')) {
      const o = config.grade23Override;
      setActiveComprehensionQuestion(o.comprehensionQuestion);
      setAngelChat(o.angelChat);
      setCurrentQuestion(o.question);
      setIsThinking(false);
      return;
    }

    // Live Gloo path (4th grade and up).
    const chosenMetaphor = config.metaphors[currentAttemptIndex % config.metaphors.length];
    const comprehensionQuestion =
      currentAttemptIndex === 1 ? config.comprehensionQuestions[0] : config.comprehensionQuestions[1];
    setActiveComprehensionQuestion(comprehensionQuestion);

    const explanationInstructions = config.buildExplanation({
      attemptIndex: currentAttemptIndex,
      remedialPrompt,
      metaphor: chosenMetaphor,
      comprehensionQuestion,
      displayName,
    });

    try {
      const angelResponse = await askAngelGabriel(
        'user_123',
        remedialPrompt ? 'Teach me from my mistake!' : `Introduce ${config.conceptName}${config.introSuffix}.`,
        explanationInstructions,
      );
      setChatLog((prev) => [
        ...prev,
        { sender: 'angel', text: angelResponse.reply || `Remember, ${config.fallbackPrefix}${chosenMetaphor}` },
      ]);

      const quizResponse = await generateAdaptiveQuestion(
        'user_123',
        config.conceptName,
        config.correctRule,
        config.incorrectRule,
        remedialPrompt,
        currentAttemptIndex,
      );
      if (quizResponse.questionData) setCurrentQuestion(quizResponse.questionData as DynamicQuestion);
    } catch (err) {
      setChatLog((prev) => [
        ...prev,
        { sender: 'angel', text: `Let's think about this: ${config.fallbackPrefix}${chosenMetaphor}` },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleAnswerSubmit = async (selectedOption: 'A' | 'B' | 'C') => {
    if (!currentQuestion) return;
    const chosenText =
      selectedOption === 'A'
        ? currentQuestion.optionA
        : selectedOption === 'B'
          ? currentQuestion.optionB
          : currentQuestion.optionC;

    if (selectedOption === currentQuestion.correctOption) {
      setStageState('solved');
      addLog(config.successLog, 'system');
      setIsThinking(true);
      try {
        const res = await askAngelGabriel(
          'user_123',
          'Explain why my correct answer was right!',
          `Player chose: "${chosenText}". ${config.celebrationDirective}`,
        );
        if (res.reply) {
          setAngelChat(res.reply);
          setChatLog((prev) => [...prev, { sender: 'angel', text: res.reply as string }]);
        }
      } finally {
        setIsThinking(false);
      }
    } else {
      // correctOption is guaranteed valid by gloo.ts normalizeQuestionData, so this always resolves.
      const correctText =
        currentQuestion.correctOption === 'A'
          ? currentQuestion.optionA
          : currentQuestion.correctOption === 'B'
            ? currentQuestion.optionB
            : currentQuestion.optionC;
      const nextAttempt = attempts + 1;
      setAttempts(nextAttempt);
      setChallengeFeedback(config.wrongFeedback);
      setExplanationAccepted(false);
      setVerificationState('pending-chat');
      setAngelChat(config.wrongAngelChat);
      await loadQuestionAndExplanation(
        config.buildRemedialPrompt({
          question: currentQuestion.question,
          chosenText: chosenText || '',
          correctText: correctText || '',
        }),
        nextAttempt,
      );
    }
  };

  const handleAskGloo = async (e: FormEvent) => {
    e.preventDefault();
    const currentQuestionText = askInput.trim();
    if (!currentQuestionText) return;

    setAskInput('');
    setChatLog((prev) => [...prev, { sender: 'you', text: currentQuestionText }]);
    setIsThinking(true);

    if (verificationState === 'pending-chat') {
      try {
        const res = await verifyComprehension(
          'user_123',
          activeComprehensionQuestion,
          currentQuestionText,
          config.verifyCorrectConcept,
        );
        if (res.evaluation) {
          setChatLog((prev) => [...prev, { sender: 'angel', text: res.evaluation.reply }]);
          if (res.evaluation.isUnderstood) {
            setVerificationState('none');
            setExplanationAccepted(true);
            setChallengeFeedback('');
            setAngelChat(config.unlockRetryChat);
          }
        }
      } finally {
        setIsThinking(false);
      }
    } else {
      try {
        // Give the angel the answer key (as text) so its hint always matches the option the game is
        // checking against — it just can't say the letter outright.
        const q = currentQuestion;
        const correctText = q
          ? q.correctOption === 'A'
            ? q.optionA
            : q.correctOption === 'B'
              ? q.optionB
              : q.optionC
          : '';
        const optionsList = q
          ? `Options: A) ${q.optionA}; B) ${q.optionB}${q.optionC ? `; C) ${q.optionC}` : ''}.`
          : '';
        const res = await askAngelGabriel(
          'user_123',
          currentQuestionText,
          `The child is stuck on this multiple-choice question: "${q?.question}". ${optionsList} The correct answer is: "${correctText}". Give a warm hint that nudges them toward that correct answer, but NEVER say the letter or repeat the answer word-for-word.`,
        );
        if (res.reply) setChatLog((prev) => [...prev, { sender: 'angel', text: res.reply as string }]);
      } finally {
        setIsThinking(false);
      }
    }
  };

  /**
   * Shared reset when a scene opens its lock challenge. Only the intro chat line differs per scene,
   * so it's passed in.
   */
  const beginChallenge = async (introChat: string) => {
    setStageState('lock-challenge');
    setCurrentTrack('/audio/question.mp3');
    setExplanationAccepted(false);
    setVerificationState('none');
    setAttempts(0);
    setAngelChat(introChat);
    await loadQuestionAndExplanation('', 0);
  };

  return {
    // state + setters
    stageState,
    setStageState,
    explanationAccepted,
    setExplanationAccepted,
    verificationState,
    setVerificationState,
    currentQuestion,
    setCurrentQuestion,
    attempts,
    setAttempts,
    angelChat,
    setAngelChat,
    askInput,
    setAskInput,
    chatLog,
    setChatLog,
    isThinking,
    setIsThinking,
    challengeFeedback,
    setChallengeFeedback,
    // handlers
    handleSpeak,
    loadQuestionAndExplanation,
    handleAnswerSubmit,
    handleAskGloo,
    beginChallenge,
  };
}
