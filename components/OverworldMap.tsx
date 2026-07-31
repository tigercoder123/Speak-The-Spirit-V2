'use client';

import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { addLog } from '../utils/gameEvents';

/**
 * OverworldMap
 * ------------
 * Presentational overlay for the hand-painted map.jpg background, matching
 * the same pattern as components/BasecampShop.tsx: the art is a fixed
 * painting, every interactive island is a % -positioned invisible hotspot
 * anchored to it, and hovering one surfaces its subtext (the same status +
 * description text the old card-grid map used to always show). Only Base,
 * Faith, Love, and Hope have real behavior behind them - map.jpg also shows
 * Joy/Patience/Peace/Kindness, but those have no feature behind them yet,
 * so they're left as plain, non-interactive art.
 */

type IslandId = 'BASE' | 'FAITH' | 'LOVE' | 'HOPE';

interface IslandRegion {
  id: IslandId;
  name: string;
  // Bounding box (in % of map.jpg) covering the island's icon + label banner.
  left: number;
  top: number;
  width: number;
  height: number;
}

// Regions are tuned to map.jpg's painted island positions. If the art is
// regenerated, nudge these %s to match the new island positions.
const ISLAND_REGIONS: IslandRegion[] = [
  { id: 'FAITH', name: 'Faith Island', left: 11, top: 58, width: 22, height: 35 },
  { id: 'BASE', name: 'Basecamp Castle', left: 37, top: 58, width: 22, height: 35 },
  { id: 'LOVE', name: 'Love Island', left: 17, top: 11, width: 19, height: 28 },
  { id: 'HOPE', name: 'Hope Island', left: 4, top: 36, width: 20, height: 26 },
];

export default function OverworldMap() {
  const { setCurrentScreen, setFeedback, feedback, triggerShake, hasHolyWater, clearedIslands } = useGame();
  const [hoveredIsland, setHoveredIsland] = useState<IslandId | null>(null);

  const faithCleared = clearedIslands.includes('Faith Island');

  const handleFaithClick = () => {
    addLog('Traveling to Faith Island...', 'system');
    setCurrentScreen('QUEST');
  };

  const handleBaseClick = () => {
    addLog('Entering Basecamp Castle & Merchant Shop.', 'shop');
    setCurrentScreen('SHOP');
  };

  const handleHopeClick = () => {
    if (faithCleared) {
      addLog('Traveling to Hope Island...', 'system');
      setCurrentScreen('QUEST'); // In a real app, this would be a different screen/quest
    } else {
      triggerShake();
      addLog('Tried to enter Hope Island, but it is locked in static mist.', 'system');
      setFeedback('Hope Island is shrouded in toxic mist! Complete Faith Island first to unlock it.');
    }
  };

  const handleLoveClick = () => {
    if (hasHolyWater) {
      addLog('Holy Water Spray breaks the protective Static on Love Island!', 'system');
      setFeedback("You spray Holy Water! The barrier dissolved. (Love Island is unlocked, but wait! Let's clear Faith Island first in this demo!)");
    } else {
      triggerShake();
      addLog('Tried to enter Love Island. Blocked by a Static shield.', 'system');
      setFeedback('Love Island is guarded by a Static shield! Buy Holy Water Spray 🧪 from the Castle Shop to bypass it.');
    }
  };

  const handlers: Record<IslandId, () => void> = {
    FAITH: handleFaithClick,
    BASE: handleBaseClick,
    LOVE: handleLoveClick,
    HOPE: handleHopeClick,
  };

  // Same subtext each island's card used to always show, keyed by id - shown
  // now only while that island is hovered (see the info bar below the map).
  const subtext: Record<IslandId, { status: string; description: string }> = {
    FAITH: { status: 'ACTIVE', description: 'Location of the first riddle and captive Songbeast.' },
    BASE: { status: 'VISITABLE', description: 'Exchange currency and buy power ups to save more songbeasts.' },
    LOVE: {
      status: hasHolyWater ? 'UNLOCKED' : 'SHIELDED',
      description: 'Requires Holy Water Spray to breach static barriers.',
    },
    HOPE: {
      status: faithCleared ? 'ACTIVE' : 'LOCKED',
      description: faithCleared
        ? 'The mist has cleared! Time to find the next Songbeast.'
        : 'Requires Faith Island clearance.',
    },
  };

  const hovered = hoveredIsland ? subtext[hoveredIsland] : null;

  return (
    <div className="flex-1 flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-center border-b-2 border-slate-700 pb-3 mb-4">
          <span className="text-green-400 font-black tracking-widest uppercase text-xs">Phase 2: Overworld Map</span>
          <span className="bg-emerald-950 text-emerald-400 px-2.5 py-1 text-xs font-bold rounded-lg border border-emerald-800">
            Select a Location
          </span>
        </div>

        <div className="relative w-full max-w-4xl mx-auto aspect-[1344/768] rounded-2xl border-4 border-black shadow-[6px_6px_0px_#000] overflow-hidden select-none">
          <img
            src="/map.jpg"
            alt="Overworld Map"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          />

          {ISLAND_REGIONS.map((region) => (
            <button
              key={region.id}
              onClick={handlers[region.id]}
              onMouseEnter={() => setHoveredIsland(region.id)}
              onMouseLeave={() => setHoveredIsland((prev) => (prev === region.id ? null : prev))}
              onFocus={() => setHoveredIsland(region.id)}
              onBlur={() => setHoveredIsland((prev) => (prev === region.id ? null : prev))}
              aria-label={region.name}
              className={`absolute rounded-2xl transition-shadow ${
                hoveredIsland === region.id ? 'shadow-[inset_0_0_0_4px_rgba(250,204,21,0.85)]' : ''
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
            💡 Hint: Go to Faith Island to start the quest, or visit Basecamp Castle to purchase gear!
          </p>
        )}
        {feedback && (
          <span className="text-pink-400 font-bold text-right ml-2 animate-pulse">{feedback}</span>
        )}
      </div>
    </div>
  );
}
