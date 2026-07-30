'use client';

import React from 'react';
import { useGame } from '../context/GameContext';
import { usePlayerWalker } from '../hooks/usePlayerWalker';
import { useEdgeTransition } from '../hooks/useEdgeTransition';
import { BATTLE_ASSETS } from '../config/battleAssets';
import DirectionalPad from './DirectionalPad';
import {
  CHEST_RETURN_CANVAS_BOUNDS,
  CHEST_RETURN_RIGHT_EDGE_THRESHOLD_X,
  CHEST_RETURN_PLAYER_SPAWN,
  CHEST_RETURN_PLAYER_SPEED,
  CHEST_RETURN_PLAYER_SPRITE_SIZE,
  PRE_BATTLE_LEFT_EDGE_SPAWN_X,
} from '../config/battleApproach';

// Post-"Weapon Forged" free-roam scene using the chest.png background -
// reached via QuestRiddle's CONTINUE button. Walking to this scene's right
// edge (see hooks/useEdgeTransition.ts) hands the player off to the
// pre-battle Silencer approach view, spawning them on ITS left edge so the
// walk reads as one continuous motion. Purely presentational plumbing: all
// movement/position comes from usePlayerWalker, the same convention as
// every other walkable scene in the game.
export default function ChestReturnScene() {
  const { setCurrentScreen, setPendingBattleSpawn, characterPath } = useGame();

  const { position, facing, startMove, stopMove } = usePlayerWalker({
    initialPosition: CHEST_RETURN_PLAYER_SPAWN,
    speed: CHEST_RETURN_PLAYER_SPEED,
    bounds: CHEST_RETURN_CANVAS_BOUNDS,
    enabled: true,
  });

  useEdgeTransition({
    position,
    enabled: true,
    edge: 'right',
    threshold: CHEST_RETURN_RIGHT_EDGE_THRESHOLD_X,
    onReachEdge: (exitPosition) => {
      setPendingBattleSpawn({ x: PRE_BATTLE_LEFT_EDGE_SPAWN_X, y: exitPosition.y });
      setCurrentScreen('BATTLE');
    },
  });

  return (
    <div className="relative mx-auto flex h-[520px] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-gradient-to-b from-emerald-950 to-slate-900 text-white">
      <div className="relative flex-1">
        <img
          src={BATTLE_ASSETS.backgrounds.chestReturn}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />

        <div
          className="absolute -translate-x-1/2 -translate-y-[80%] transition-all duration-75 ease-out z-20"
          style={{
            left: position.x,
            top: position.y,
            width: CHEST_RETURN_PLAYER_SPRITE_SIZE,
            height: CHEST_RETURN_PLAYER_SPRITE_SIZE,
          }}
        >
          <img
            src={characterPath}
            alt="Player"
            className="w-full h-full object-contain drop-shadow-xl"
            style={{ transform: facing === 'left' ? 'scaleX(-1)' : 'scaleX(1)' }}
          />
        </div>

        {/* D-PAD CONTROLS - same convention as components/battle/BattleExplorationView.tsx et al. */}
        <DirectionalPad onStartMove={startMove} onStopMove={stopMove} />
      </div>
    </div>
  );
}
