'use client';

import React from 'react';
import { POWER_UPS } from '../../config/powerUpConfig';

interface ActivePowerUpBannerProps {
  activePowerUps: { SHIELD: number; HUSH_SILENCER: number };
}

// Shows which lingering power-ups are currently active this battle and how
// many of each are stacked (see useSilencerBattle.ts's activePowerUps).
// Hint/Check/Free Pass never linger, so they never appear here - the menu
// (not this banner) is the only place their counts show.
export default function ActivePowerUpBanner({ activePowerUps }: ActivePowerUpBannerProps) {
  const entries = (Object.keys(activePowerUps) as Array<keyof typeof activePowerUps>).filter(
    (type) => activePowerUps[type] > 0
  );
  if (entries.length === 0) return null;

  return (
    <div className="absolute top-3 right-3 z-40 flex flex-col gap-1.5 items-end">
      {entries.map((type) => {
        const config = POWER_UPS.find((p) => p.id === type);
        if (!config) return null;
        return (
          <div
            key={type}
            className="bg-purple-400 border-2 border-black rounded-lg px-2 py-1 text-[10px] font-black text-black shadow-[2px_2px_0px_#000]"
          >
            {config.icon} {config.name} x{activePowerUps[type]}
          </div>
        );
      })}
    </div>
  );
}
