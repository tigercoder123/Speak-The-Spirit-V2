'use client';

import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { addLog } from '../utils/gameEvents';
import { BATTLE_SCENE_MAX_WIDTH } from '../config/battleApproach';

/**
 * OverworldMap
 * ------------
 * Presentational overlay for the hand-painted Home.jpg background: the art
 * is a fixed painting, every interactive sign is a % -positioned invisible
 * hotspot anchored to it. Home.jpg only shows two signs - Shop and Battle -
 * so those are the only two regions; Love/Hope islands and the Quest flow
 * that used to live on the old map.jpg have no entry point here anymore.
 */

// Home.jpg's own aspect ratio (1376x768) - deliberately not the shared
// BATTLE_SCENE_ASPECT_RATIO from config/battleApproach.ts, since that's
// tuned to the battle scene's own canvas and doesn't match this image's
// proportions (using it would crop Home.jpg's edges via object-cover).
// BATTLE_SCENE_MAX_WIDTH is still reused - it's just a pixel cap, not tied
// to aspect ratio, and keeps this screen the same size as before.
const HOME_IMAGE_ASPECT_RATIO = '1376 / 768';

type SignId = 'SHOP' | 'BATTLE';

interface SignRegion {
  id: SignId;
  name: string;
  // Bounding box (in % of Home.jpg), fitted to the sign's wood-plank art.
  left: number;
  top: number;
  width: number;
  height: number;
}

const SIGN_REGIONS: SignRegion[] = [
  { id: 'SHOP', name: 'Shop', left: 28, top: 52, width: 21, height: 20 },
  { id: 'BATTLE', name: 'Battle', left: 52, top: 52, width: 21, height: 20 },
];

export default function OverworldMap() {
  const { setCurrentScreen, feedback } = useGame();
  const [hoveredSign, setHoveredSign] = useState<SignId | null>(null);

  const handleShopClick = () => {
    addLog('Entering Basecamp Castle & Merchant Shop.', 'shop');
    setCurrentScreen('SHOP');
  };

  const handleBattleClick = () => {
    addLog('Traveling to Faith Island...', 'system');
    setCurrentScreen('BATTLE');
  };

  const handlers: Record<SignId, () => void> = {
    SHOP: handleShopClick,
    BATTLE: handleBattleClick,
  };

  const subtext: Record<SignId, { status: string; description: string }> = {
    SHOP: { status: 'VISITABLE', description: 'Exchange currency and buy power ups to save more songbeasts.' },
    BATTLE: { status: 'ACTIVE', description: 'Face the captive Songbeast.' },
  };

  const hovered = hoveredSign ? subtext[hoveredSign] : null;

  return (
    <div className="flex-1 flex flex-col justify-between">
      <div>
        <div
          className="relative w-full mx-auto rounded-2xl border-4 border-black shadow-[6px_6px_0px_#000] overflow-hidden select-none"
          style={{ maxWidth: BATTLE_SCENE_MAX_WIDTH, aspectRatio: HOME_IMAGE_ASPECT_RATIO }}
        >
          <img
            src="/Home.jpg"
            alt="Overworld Home"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          />

          {SIGN_REGIONS.map((region) => (
            <button
              key={region.id}
              onClick={handlers[region.id]}
              onMouseEnter={() => setHoveredSign(region.id)}
              onMouseLeave={() => setHoveredSign((prev) => (prev === region.id ? null : prev))}
              onFocus={() => setHoveredSign(region.id)}
              onBlur={() => setHoveredSign((prev) => (prev === region.id ? null : prev))}
              aria-label={region.name}
              className={`absolute rounded-2xl transition-shadow ${
                hoveredSign === region.id ? 'shadow-[inset_0_0_0_4px_rgba(250,204,21,0.85)]' : ''
              }`}
              style={{ left: `${region.left}%`, top: `${region.top}%`, width: `${region.width}%`, height: `${region.height}%` }}
            />
          ))}
        </div>
      </div>

      <div className="bg-slate-900/60 p-3 border-2 border-slate-700 rounded-lg text-xs flex justify-between items-center mt-4">
        {hovered ? (
          <p className="text-yellow-400 font-bold">
            <span className="bg-black text-white text-[10px] font-black px-2 py-0.5 rounded-full mr-2">
              {hovered.status}
            </span>
            {hovered.description}
          </p>
        ) : (
          <p className="text-yellow-400 font-bold">
            💡 Hint: Click Battle to face the Songbeast, or visit the Shop to purchase gear!
          </p>
        )}
        {feedback && (
          <span className="text-pink-400 font-bold text-right ml-2 animate-pulse">{feedback}</span>
        )}
      </div>
    </div>
  );
}
