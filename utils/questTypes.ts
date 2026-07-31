// Shared types for the quest scenes (Crossroads, HungerTrial, RushingWaters).
// Previously these interfaces were copy-pasted at the top of each *Scene.tsx.

export interface ChatMessage {
  sender: 'you' | 'angel';
  text: string;
}

export interface DynamicQuestion {
  question: string;
  optionA: string;
  optionB: string;
  optionC?: string;
  correctOption: 'A' | 'B' | 'C';
}
