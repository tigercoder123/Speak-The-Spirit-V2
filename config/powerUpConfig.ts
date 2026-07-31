// Power-up definitions are data, not branching - adding/renaming/repricing a
// power-up only ever touches POWER_UPS below. Everything that reads this
// config (the shop, the parchment menu, the active-power-up banner, and
// useSilencerBattle's activation logic) is driven off `id`, never a
// hardcoded switch on a specific power-up's identity.
export type PowerUpType = 'HINT' | 'HUSH_SILENCER' | 'FREE_PASS' | 'SHIELD' | 'CHECK';

export interface PowerUpConfig {
  id: PowerUpType;
  name: string;
  description: string;
  /** Cost in cupcakes. */
  cost: number;
  icon: string;
}

export const POWER_UPS: PowerUpConfig[] = [
  {
    id: 'HINT',
    name: 'Hint',
    description: 'Reveal any blank you choose.',
    cost: 3,
    icon: '💡',
  },
  {
    id: 'HUSH_SILENCER',
    name: 'Hush Silencer',
    description: "Silence the Silencer's comeback for one round.",
    cost: 3,
    icon: '🤫',
  },
  {
    id: 'FREE_PASS',
    name: 'Free Pass',
    description: 'Skip a challenge — counts as a win.',
    cost: 4,
    icon: '🎫',
  },
  {
    id: 'SHIELD',
    name: 'Shield',
    description: 'Block one wrong answer. No harm done.',
    cost: 3,
    icon: '🛡️',
  },
  {
    id: 'CHECK',
    name: 'Check',
    description: 'Peek at your answers before you commit.',
    cost: 2,
    icon: '✅',
  },
];

export const POWER_UP_TYPES: PowerUpType[] = POWER_UPS.map((p) => p.id);

export const DEFAULT_POWER_UP_COUNTS: Record<PowerUpType, number> = POWER_UP_TYPES.reduce(
  (acc, type) => ({ ...acc, [type]: 0 }),
  {} as Record<PowerUpType, number>
);

export function isPowerUpType(id: string): id is PowerUpType {
  return (POWER_UP_TYPES as string[]).includes(id);
}
