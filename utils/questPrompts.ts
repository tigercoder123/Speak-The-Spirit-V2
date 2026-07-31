// Per-scene DATA for the three quest challenges. All AI-prompt text lives here so the shared
// `useQuestChallenge` hook can stay pure logic. Each string below was moved VERBATIM out of its
// original *Scene.tsx (including original wording/typos) so the prompts sent to Gloo are unchanged.

import { DynamicQuestion } from './questTypes';

/** A hardcoded question shown to younger players / on retries, instead of a live Gloo question. */
export interface TkOverride {
  comprehensionQuestion: string;
  angelChat: (isRemedial: boolean) => string;
  question: DynamicQuestion;
}

export interface Grade23Override {
  comprehensionQuestion: string;
  angelChat: string;
  question: DynamicQuestion;
}

export interface QuestConfig {
  /** Background track played when the scene mounts. */
  music: string;

  // --- Live Gloo curriculum (4th grade and up) ---
  conceptName: string;
  correctRule: string;
  incorrectRule: string;
  metaphors: string[];
  /** [ variant used when attempt === 1, variant used otherwise ]. */
  comprehensionQuestions: [string, string];
  verifyCorrectConcept: string;
  /** Prefix injected into the offline fallback lines ("Remember, <prefix><metaphor>"). */
  fallbackPrefix: string;
  /** Suffix on the intro user message ("Introduce <concept><introSuffix>."). */
  introSuffix: string;
  buildExplanation: (args: {
    attemptIndex: number;
    remedialPrompt: string;
    metaphor: string;
    comprehensionQuestion: string;
    displayName: string | null;
  }) => string;

  // --- Grade overrides (short-circuit before Gloo) ---
  tkOverride: TkOverride;
  grade23Override: Grade23Override;

  // --- Answer handling ---
  successLog: string;
  /** Directive appended after `Player chose: "<text>". ` in the celebration prompt. */
  celebrationDirective: string;
  wrongFeedback: string;
  wrongAngelChat: string;
  buildRemedialPrompt: (args: { question: string; chosenText: string; correctText: string }) => string;
  /** Angel line shown once the child explains the concept and unlocks their retry. */
  unlockRetryChat: string;

  /** Initial angel greeting when the scene loads. */
  initialAngelChat: (displayName: string | null) => string;
}

export const CROSSROADS_CONFIG: QuestConfig = {
  music: '/audio/crossroads.mp3',

  conceptName: 'Faith',
  correctRule: 'Active loyalty, deep trust, and doing what the Gardener says (taking action).',
  incorrectRule:
    'Just memorizing lists of facts and trivia about the Gardener, or passive head-knowledge without movement.',
  metaphors: [
    "Pistis means active trust. It's like sitting on a chair: you don't just look at it, you have to actually sit down!",
    'Pistis is active trust. Think of walking through a door: you don\'t just stare at it, you have to step through!',
    'Pistis is active trust. It\'s like the wind: you step forward trusting it will carry your kite!',
  ],
  comprehensionQuestions: [
    'If you just stare at a door handle, how do you get to the other side? What action must you take?',
    'If you want the wind to fly your kite, what must you physically do with the string?',
  ],
  verifyCorrectConcept: 'Faith is active trust, physically stepping forward.',
  fallbackPrefix: 'faith is active trust. ',
  introSuffix: ' dynamically',
  buildExplanation: ({ attemptIndex, remedialPrompt, metaphor, comprehensionQuestion, displayName }) => `
      The ${displayName || 'Traveler'} is learning about Faith. Attempt number ${attemptIndex + 1}.
      ${remedialPrompt ? `REMEDIAL: The child answered incorrectly. ${remedialPrompt} Pivot to why the correct choice was right. End by asking: "${comprehensionQuestion}"` : `INTRO: Explain "Pistis" (active trust) using this analogy: "${metaphor}".`}
      Keep the entire message warm and brief (maximum 3 sentences).
    `,

  tkOverride: {
    comprehensionQuestion: 'Do we trust God?',
    angelChat: (isRemedial) =>
      isRemedial ? "Not quite! Let's try an easier one. Do we trust God?" : 'Faith means trusting God! Do we trust God?',
    question: { question: 'Do we trust God?', optionA: 'Yes', optionB: 'No', correctOption: 'A' },
  },
  grade23Override: {
    comprehensionQuestion: 'What is faith?',
    angelChat: "Faith is active trust! Let's see if you can fill in the blank.",
    question: { question: 'Faith is ________.', optionA: 'trust', optionB: 'cool', correctOption: 'A' },
  },

  successLog: 'Successfully broke the lock!',
  celebrationDirective: 'Celebrate briefly (1-2 sentences) and explain why this is true faith.',
  wrongFeedback: 'Not quite! Angel Gabriel is testing your understanding in the chat before you can retry.',
  wrongAngelChat:
    "That wasn't quite it, Messenger. Answer my question in the chat console on the right so we can clear this up!",
  buildRemedialPrompt: ({ question, chosenText, correctText }) =>
    `The question asked: "${question}". Child chose "${chosenText}" instead of "${correctText}". Explain why.`,
  unlockRetryChat: 'Fantastic understanding! Now, try answering this brand-new multiple choice challenge on the left.',

  initialAngelChat: (displayName) =>
    `Greetings, ${displayName || 'Traveler'}! Before you take a single step, you must decode the riddle above. Click the scroll on the left to begin!`,
};

export const HUNGER_TRIAL_CONFIG: QuestConfig = {
  music: '/audio/hunger.mp3',

  conceptName: 'Assurance (Hypostasis)',
  correctRule:
    'Having a guaranteed, confident expectation that the Gardener will provide, even before you see the proof.',
  incorrectRule:
    'Refusing to trust the Gardener until you physically see the food, or scrambling around anxiously.',
  metaphors: [
    "Assurance is like having a birthday invitation from a friend. Even if it's days away, you are completely sure the party is happening!",
    'Assurance is like holding a ticket to a fun theme park. Even if you are standing outside the gates, you know that ride is yours to enjoy!',
    'Assurance is an eager, confident expectation. It\'s like going to sleep completely certain the sun will rise tomorrow.',
  ],
  comprehensionQuestions: [
    'If you have a guaranteed ticket to a feast, do you need to worry about starving today?',
    "What does it mean to have a 'title deed' to something you can't physically see yet?",
  ],
  verifyCorrectConcept: 'Assurance means deep confidence and trust in provision.',
  fallbackPrefix: '',
  introSuffix: '',
  buildExplanation: ({ attemptIndex, remedialPrompt, metaphor, comprehensionQuestion }) => `
      The player is learning about "Assurance (Hypostasis)". Attempt number ${attemptIndex + 1}.
      They already know what "Faith" is. This is strictly about the "Assurance" part of the verse.
      ${remedialPrompt ? `REMEDIAL: ${remedialPrompt} End by asking: "${comprehensionQuestion}"` : `INTRO: Explain the concept of Assurance using this analogy: "${metaphor}".`}
      Keep the entire message warm and brief (maximum 3 sentences).
    `,

  tkOverride: {
    comprehensionQuestion: 'Does God care about us?',
    angelChat: (isRemedial) =>
      isRemedial
        ? "Not quite! Let's try an easier one. Does God care about us?"
        : 'Assurance means knowing God loves us! Does God care about us?',
    question: { question: 'Does God care about us?', optionA: 'Yes', optionB: 'No', correctOption: 'A' },
  },
  grade23Override: {
    comprehensionQuestion: 'Does God provide for us?',
    angelChat: 'Assurance means knowing God will meet our needs! Fill in the blank.',
    question: { question: 'God ________ about our needs.', optionA: "doesn't care", optionB: 'cares', correctOption: 'B' },
  },

  successLog: 'Mastered the Assurance concept!',
  celebrationDirective: 'Celebrate briefly.',
  wrongFeedback: "Not quite! Let's chat about it on the right.",
  wrongAngelChat: "That wasn't quite it. Answer my question in the chat console so we can clear this up!",
  buildRemedialPrompt: ({ chosenText, correctText }) =>
    `Child chose "${chosenText}" instead of "${correctText}". Explain why.`,
  unlockRetryChat: 'Fantastic! Try this brand-new challenge on the left.',

  initialAngelChat: (displayName) =>
    `${displayName || 'Traveler'}, your stomach may rumble, but true provision comes to those who seek it. Read the riddle!`,
};

export const RUSHING_WATERS_CONFIG: QuestConfig = {
  music: '/audio/waters.mp3',

  conceptName: 'Trusting in things not seen.',
  correctRule: 'Trusting in the Gardener and His promises, even when your eyes see absolutely nothing.',
  incorrectRule: 'Trusting only in your own physical sight, tools, and abilities to make a bridge or boat.',
  metaphors: [
    "Sometimes you have faith in things you can't actually see with your eyes! Just like gravity or a radio frequency, just because you can't see it doesn't mean it isn't real and holding you up.",
    'We can be sure something esists without seeing it physically. The Gardener\'s character is our proof, even when the river looks scary!',
  ],
  comprehensionQuestions: [
    'If you step onto the water without a boat, what unseen reality are you trusting to hold you up?',
    'Can you name one thing in real life (like gravity) that is invisible but completely real?',
  ],
  verifyCorrectConcept: 'Conviction/Assurance means acting on the unseen realities promised by the Gardener.',
  fallbackPrefix: '',
  introSuffix: '',
  buildExplanation: ({ attemptIndex, remedialPrompt, metaphor, comprehensionQuestion }) => `
      The player is learning about "Trusting in things not seen.". Attempt number ${attemptIndex + 1}.
      They just crossed a rushing river on an invisible bridge.
      ${remedialPrompt ? `REMEDIAL: ${remedialPrompt} End by asking: "${comprehensionQuestion}"` : `INTRO: Explain the concept of 'things not seen' using this analogy: "${metaphor}".`}
      Keep the entire message warm and brief (maximum 3 sentences).
    `,

  tkOverride: {
    comprehensionQuestion: 'Can we always see God?',
    angelChat: (isRemedial) =>
      isRemedial
        ? "Not quite! Let's think about this. Can we always see God with our eyes?"
        : "We can have confidence even when we can't see Him! Can we always see God?",
    question: { question: 'Can we always see God with our eyes?', optionA: 'No', optionB: 'Yes', correctOption: 'A' },
  },
  grade23Override: {
    comprehensionQuestion: 'Do we need to see God to trust Him?',
    angelChat: "We can have confidence even when we can't see Him! Fill in the blank.",
    question: { question: 'We can trust God even when we ________ see Him.', optionA: 'cannot', optionB: 'can', correctOption: 'A' },
  },

  successLog: "Mastered 'things not seen' concept!",
  celebrationDirective: 'Celebrate briefly and mention we are ready to battle the silencer.',
  wrongFeedback: "Not quite! Let's chat about it on the right.",
  wrongAngelChat: "That wasn't quite it. Answer my question in the chat console so we can clear this up!",
  buildRemedialPrompt: ({ chosenText, correctText }) =>
    `Child chose "${chosenText}" instead of "${correctText}". Explain why.`,
  unlockRetryChat: 'Fantastic! Try this brand-new challenge on the left.',

  initialAngelChat: () =>
    'Traveler, the river looks wild and deep. But remember... no boat is docked, no timber groans. Read the riddle!',
};
