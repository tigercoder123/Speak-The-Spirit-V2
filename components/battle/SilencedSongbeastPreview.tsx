'use client';

import React from 'react';
import { BATTLE_ASSETS } from '../../config/battleAssets';
import {
  SILENCED_PREVIEW_PLACEMENT,
  SILENCER_BOX,
  SILENCER_OVERLAP_PX,
  SILENCER_VERTICAL_OFFSET,
  SONGBEAST_BOX,
} from '../../config/battleApproach';

// Static, non-GSAP render of the silenced Songbeast (gear fully ON) with the
// Silencer standing just behind it - the zoomed-out exploration background's
// preview group the player walks up to. Purely presentational: no
// animation, no state, just the ON-state composite laid out with the exact
// z-order confirmed against components/battle/SongbeastBattleAvatar.tsx
// (glasses/headphones "add" layers behind the head, "main" layers in front
// of it; Silencer behind the Songbeast as a whole). Placement/scale come
// from config/battleApproach.ts, not hardcoded here.
export default function SilencedSongbeastPreview() {
  const { anchor, scale } = SILENCED_PREVIEW_PLACEMENT;

  // Both boxes scale from their own bottom-left corner (transformOrigin
  // '0% 100%'), so the Songbeast's own VISUAL (post-scale) width is exactly
  // SONGBEAST_BOX.width * scale - that's the real gap to clear when placing
  // the Silencer beside it, not a raw pre-scale pixel guess (which would
  // put them nowhere near each other once `scale` shrinks both boxes down).
  const songbeastVisualWidth = SONGBEAST_BOX.width * scale;
  const silencerLeft = songbeastVisualWidth - SILENCER_OVERLAP_PX;

  return (
    <div className="pointer-events-none absolute" style={{ left: anchor.x, bottom: anchor.y }}>
      {/* Establishes the containing block both children below position
          against - without this, their `left`/`bottom` would resolve
          against the scene's own outer container instead of this anchor. */}
      <div className="relative">
        {/* Silencer - behind the Songbeast (lower z-index), offset just past
            its scaled width so the two read as standing beside each other
            without meaningfully overlapping (a small intentional overlap is
            still allowed, per SILENCER_OVERLAP_PX). */}
        <div
          className="absolute opacity-90"
          style={{
            left: silencerLeft,
            bottom: SILENCER_VERTICAL_OFFSET,
            width: SILENCER_BOX.width,
            height: SILENCER_BOX.height,
            zIndex: 0,
            transform: `scale(${scale})`,
            transformOrigin: '0% 100%',
          }}
>
          <img
            src={BATTLE_ASSETS.silencer.body}
            alt="Silencer, standing behind the Songbeast"
            className="absolute inset-0 h-full w-full object-contain object-bottom"
            style={{ zIndex: 0 }}
          />
          <img
            src={BATTLE_ASSETS.silencer.arm}
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full object-contain object-bottom"
            style={{ zIndex: 1 }}
          />
        </div>

        {/* Songbeast - in front, gear fully ON. */}
        <div
          className="absolute"
          style={{
            left: 0,
            bottom: 0,
            width: SONGBEAST_BOX.width,
            height: SONGBEAST_BOX.height,
            zIndex: 1,
            transform: `scale(${scale})`,
            transformOrigin: '0% 100%',
          }}
        >
          <img
            src={BATTLE_ASSETS.songbeast.base.legsTail}
            alt=""
            className="absolute inset-0 h-full w-full object-contain object-bottom"
            style={{ zIndex: 2 }}
          />
          <img
            src={BATTLE_ASSETS.songbeast.base.body}
            alt="The silenced Songbeast"
            className="absolute inset-0 h-full w-full object-contain object-bottom"
            style={{ zIndex: 3 }}
          />
          <img
            src={BATTLE_ASSETS.songbeast.gear.glasses.add}
            alt=""
            className="absolute inset-0 h-full w-full object-contain object-bottom"
            style={{ zIndex: 4 }}
          />
          <img
            src={BATTLE_ASSETS.songbeast.gear.headphones.add}
            alt=""
            className="absolute inset-0 h-full w-full object-contain object-bottom"
            style={{ zIndex: 5 }}
          />
          <img
            src={BATTLE_ASSETS.songbeast.base.head}
            alt=""
            className="absolute inset-0 h-full w-full object-contain object-bottom"
            style={{ zIndex: 6 }}
          />
          <img
            src={BATTLE_ASSETS.songbeast.base.muzzle}
            alt=""
            className="absolute inset-0 h-full w-full object-contain object-bottom"
            style={{ zIndex: 7 }}
          />
          <img
            src={BATTLE_ASSETS.songbeast.gear.glasses.main}
            alt=""
            className="absolute inset-0 h-full w-full object-contain object-bottom"
            style={{ zIndex: 8 }}
          />
          <img
            src={BATTLE_ASSETS.songbeast.gear.headphones.main}
            alt=""
            className="absolute inset-0 h-full w-full object-contain object-bottom"
            style={{ zIndex: 9 }}
          />
        </div>
      </div>
    </div>
  );
}
