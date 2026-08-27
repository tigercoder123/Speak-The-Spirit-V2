'use client';

import React from 'react';
import { BATTLE_ASSETS } from '../../config/battleAssets';
import {
  BATTLE_SCENE_ASPECT_RATIO,
  BATTLE_SCENE_MAX_WIDTH,
  EXPLORATION_PLAYER_SPRITE_SIZE,
} from '../../config/battleApproach';
import type { Direction, FacingDirection, Position } from '../../hooks/usePlayerWalker';
import SilencedSongbeastPreview from './SilencedSongbeastPreview';
import RestorePrompt from './RestorePrompt';
import DirectionalPad from '../DirectionalPad';

interface BattleExplorationViewProps {
  /** This battle's randomly-picked exploration background (see
   * hooks/useSilencerBattle.ts's battleTheme / BATTLE_ASSETS.backgrounds.themes). */
  backgroundSrc: string;
  playerPosition: Position;
  playerFacing: FacingDirection;
  onStartMove: (direction: Direction) => void;
  onStopMove: (direction: Direction) => void;
  showRestorePrompt: boolean;
  onConfirmRestore: () => void;
  includesHandcuffs: boolean;
  includesLegcuffs: boolean;
}

// The zoomed-out exploration view (battle.png) - the player walks up to the
// silenced Songbeast+Silencer preview and a Restore prompt shows/hides based
// on proximity. Purely presentational: position/facing/movement come from
// the state machine (hooks/useSilencerBattle.ts, via hooks/usePlayerWalker.ts),
// this only renders them. Same container sizing as
// components/battle/SongbeastBattleAvatar.tsx so the swap into the
// zoomed-in battle view (see BattleIntroTransition) doesn't jump size.
export default function BattleExplorationView({
  backgroundSrc,
  playerPosition,
  playerFacing,
  onStartMove,
  onStopMove,
  showRestorePrompt,
  onConfirmRestore,
  includesHandcuffs,
  includesLegcuffs,
}: BattleExplorationViewProps) {
  return (
    // `isolate` traps this scene's internal z-index values (the player's
    // z-20 in particular) inside a local stacking context - without it, that
    // z-20 escapes all the way to the page's root stacking context (since no
    // ancestor between here and <body> sets a z-index of its own) and can
    // out-rank unrelated fixed-position overlays elsewhere on the page, like
    // SettingsModal's z-50 backdrop, even though 20 < 50.
    <div
      className="relative isolate mx-auto flex w-full flex-col overflow-hidden rounded-xl bg-gradient-to-b from-green-950 to-slate-900 text-white"
      style={{ maxWidth: BATTLE_SCENE_MAX_WIDTH, aspectRatio: BATTLE_SCENE_ASPECT_RATIO }}
    >
      <div className="relative flex-1">
        <img
          src={backgroundSrc}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />

        <SilencedSongbeastPreview includesHandcuffs={includesHandcuffs} includesLegcuffs={includesLegcuffs} />

        <div
          className="absolute -translate-x-1/2 -translate-y-[80%] transition-all duration-75 ease-out z-20"
          style={{
            left: playerPosition.x,
            top: playerPosition.y,
            width: EXPLORATION_PLAYER_SPRITE_SIZE,
            height: EXPLORATION_PLAYER_SPRITE_SIZE,
          }}
        >
          <img
            src={BATTLE_ASSETS.player.walking}
            alt="Player"
            className="w-full h-full object-contain drop-shadow-xl"
            style={{ transform: playerFacing === 'left' ? 'scaleX(-1)' : 'scaleX(1)' }}
          />
        </div>

        {/* D-PAD CONTROLS - same convention as the overworld quest maps
            (see components/quests/Crossroads/CrossroadsMap.tsx et al.). */}
        <DirectionalPad onStartMove={onStartMove} onStopMove={onStopMove} />

        <RestorePrompt visible={showRestorePrompt} onConfirm={onConfirmRestore} />
      </div>
    </div>
  );
}
