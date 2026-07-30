// Config-driven script for the post-restoration debrief dialogue (see
// hooks/useSongbeastDebriefDialogue.ts for the sequencing engine that steps
// through this, and hooks/useSilencerBattle.ts's DIALOGUE phase for where it
// runs). Writers edit lines/choices here without touching any component or
// hook code.

export type DebriefDialogueSpeaker = 'songbeast' | 'player';

export interface DebriefDialogueLineStep {
  type: 'line';
  speaker: DebriefDialogueSpeaker;
  text: string;
}

export interface DebriefCucumberGiftStep {
  type: 'cucumberGift';
  /** How many cucumbers this gift writes to the player's existing GameContext balance. */
  amount: number;
  /** Shown beside the cucumber icon before the player has accepted it. */
  prompt: string;
  /** Shown in place of the prompt, briefly, once accepted. */
  confirmation: string;
}

export interface DebriefPlayerChoiceOption {
  id: string;
  /** The button label - also spoken back as the player's own dialogue line once chosen. */
  label: string;
  /** The Songbeast's reply, specific to this choice. */
  responseText: string;
}

export interface DebriefPlayerChoiceStep {
  type: 'choice';
  options: [DebriefPlayerChoiceOption, DebriefPlayerChoiceOption];
}

export type DebriefDialogueStep = DebriefDialogueLineStep | DebriefCucumberGiftStep | DebriefPlayerChoiceStep;

// Beat 1 (gratitude + gift) -> Beat 2 (recognition) -> Beat 3 (the ask) ->
// Beat 4 (player choice + send-off). The choice step's branch reply and the
// player's own spoken choice are injected at runtime (see the sequencing
// hook's dynamic queue) rather than duplicated here per-option - this array
// only holds the ONE final line both branches converge back onto.
export const SONGBEAST_DEBRIEF_DIALOGUE: DebriefDialogueStep[] = [
  {
    type: 'line',
    speaker: 'songbeast',
    text: 'You did it. I can hear my song again! Thank you for singing it back to me.',
  },
  {
    type: 'line',
    speaker: 'songbeast',
    text:
      "I grew these in the garden, before the Silencer came. Please, take them! I've been saving them all this time. Take them to the shop. Let them help you on your way.",
  },
  {
    type: 'cucumberGift',
    amount: 3,
    prompt: 'Tap the cucumber to take it!',
    confirmation: '+3 Cucumbers! Item added.',
  },
  {
    type: 'line',
    speaker: 'songbeast',
    text:
      'Wait… the woods are still too quiet, aren’t they? My brothers and sisters are still out there. Still quiet. Still waiting. Still forgetting who they are.',
  },
  {
    type: 'line',
    speaker: 'songbeast',
    text: "But I can help! I know their song — because it's my song too. I can sing it back to the ones who are like me.",
  },
  {
    type: 'line',
    speaker: 'songbeast',
    text:
      "But the others… the ones who aren't my kind… I don't know their songs. Only you can reach those. You were sent for that. If I go wake my kind, will you keep finding the others?",
  },
  {
    type: 'choice',
    options: [
      { id: 'COUNT_ON_ME', label: 'You can count on me!', responseText: 'I knew we could count on you!' },
      { id: 'SING_YOUR_HEART_OUT', label: 'Go sing your heart out!', responseText: "I'll sing louder than ever!" },
    ],
  },
  {
    type: 'line',
    speaker: 'songbeast',
    text: "Thank you! Keep an ear out for us—we'll be singing for you!",
  },
];
