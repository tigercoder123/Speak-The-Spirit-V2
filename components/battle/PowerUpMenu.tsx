'use client';

import React, { useState } from 'react';
import { POWER_UPS, type PowerUpType } from '../../config/powerUpConfig';

interface PowerUpMenuProps {
  powerUps: Record<PowerUpType, number>;
  onSelect: (type: PowerUpType) => void;
}

// Corner button + dropdown for activating a power-up mid-challenge - purely
// presentational, all inventory/consume/activation logic lives in
// hooks/useSilencerBattle.ts. Power-ups the player owns 0 of still render,
// just greyed out and disabled, rather than being hidden - see
// config/powerUpConfig.ts for the full set.
export default function PowerUpMenu({ powerUps, onSelect }: PowerUpMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="absolute top-3 left-3 z-40">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="neo-btn bg-yellow-400 hover:bg-yellow-300 text-black font-black text-xs px-3 py-2 rounded-lg uppercase"
      >
        ⚡ Power Ups
      </button>
      {open && (
        <div className="mt-2 bg-amber-100 border-4 border-black rounded-xl shadow-[4px_4px_0px_#000] p-2 flex flex-col gap-1.5 w-56">
          {POWER_UPS.map((powerUp) => {
            const count = powerUps[powerUp.id];
            const owned = count > 0;
            return (
              <button
                key={powerUp.id}
                disabled={!owned}
                onClick={() => {
                  onSelect(powerUp.id);
                  setOpen(false);
                }}
                className={`flex items-center justify-between gap-2 text-left border-2 border-black rounded-lg px-2 py-1.5 ${
                  owned ? 'bg-yellow-400 hover:bg-yellow-300 neo-btn' : 'bg-slate-200 opacity-50 cursor-not-allowed'
                }`}
              >
                <span className="flex items-center gap-1.5 text-xs font-black text-black">
                  <span className="text-base">{powerUp.icon}</span>
                  {powerUp.name}
                </span>
                <span className="text-xs font-black text-black">x{count}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
