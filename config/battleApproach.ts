import type { Position } from '../hooks/usePlayerWalker';

// The Silencer battle's own scene container is a `h-[520px] w-full
// max-w-4xl` box (see components/battle/SongbeastBattleAvatar.tsx) - the
// exploration view shares that SAME mount, so its walkable canvas is sized
// to match (896x520, the container's own max width x height) rather than
// the 800x600 convention the separate quest maps use.
export const EXPLORATION_CANVAS_BOUNDS = { minX: 0, maxX: 896, minY: 0, maxY: 520 };

export const EXPLORATION_PLAYER_SPEED = 9;

// Rendered size (px) of the player sprite on the exploration view - kept
// here rather than hardcoded in the component so it's tunable.
export const EXPLORATION_PLAYER_SPRITE_SIZE = 115.2;

// Player starts on the right, walking left toward the captive Songbeast -
// mirrors the battle-framed scene's own left-to-right player/Songbeast
// arrangement (see SongbeastBattleAvatar.tsx), just reversed since here the
// player is approaching rather than already in position.
export const EXPLORATION_PLAYER_SPAWN: Position = { x: 760, y: 380 };

// Native box each composite is laid out in, before SILENCED_PREVIEW_PLACEMENT.scale
// shrinks the whole group down - matches SongbeastBattleAvatar.tsx's own
// songbeastGroupRef (h-44 w-80) and silencerGroupRef (h-72 w-52) boxes.
// Shared here (not redeclared in the component) so both
// components/battle/SilencedSongbeastPreview.tsx and the hook's own
// proximity-center math stay in sync with the same numbers.
export const SONGBEAST_BOX = { width: 320, height: 176 };
export const SILENCER_BOX = { width: 208, height: 288 };

/**
 * Placement of the silenced Songbeast+Silencer preview group on the
 * zoomed-out exploration background (battle.png), scaled slightly down from
 * the full battle-framed size. `anchor` is the bottom-LEFT corner of the
 * Songbeast's own box (matching how it's rendered - transformOrigin
 * '0% 100%'), aligned to the broken-down greenhouse ruin visible in that
 * background (roughly 70% across, just past its mid-height) - not an
 * abstract "left-middle" guess. Pixel coordinates are in the same
 * EXPLORATION_CANVAS_BOUNDS space above. Tunable here without touching
 * component code.
 */
export interface SilencedPreviewPlacement {
  /** Anchor point (bottom-left of the composite's own box) in exploration-canvas coordinates. */
  anchor: Position;
  /** Uniform scale applied to the whole composite, relative to its natural (battle-framed) size. */
  scale: number;
}

export const SILENCED_PREVIEW_PLACEMENT: SilencedPreviewPlacement = {
  anchor: { x: 512, y: 254 },
  scale: 0.6,
};

// The Songbeast's own visual CENTER (not its bottom-left anchor above) -
// what the proximity trigger below actually measures distance to, since
// centering on the anchor corner reads as noticeably off from the
// Songbeast itself once its box is large enough to matter.
export const SILENCED_PREVIEW_CENTER: Position = {
  x: SILENCED_PREVIEW_PLACEMENT.anchor.x - 20 + (SONGBEAST_BOX.width * SILENCED_PREVIEW_PLACEMENT.scale) / 2,
  y: SILENCED_PREVIEW_PLACEMENT.anchor.y - 50 + (SONGBEAST_BOX.height * SILENCED_PREVIEW_PLACEMENT.scale) / 2,
};

// How much (px, in POST-scale/visual pixels) the Silencer's box is allowed
// to overlap the Songbeast's own scaled width when placed beside it -
// deliberately small, per confirmed direction: they aren't meant to overlap,
// but if they do, only by a little, and the Silencer stays behind in
// z-order (see SilencedSongbeastPreview.tsx, which matches the same
// Silencer-behind stacking already established in SongbeastBattleAvatar.tsx).
export const SILENCER_OVERLAP_PX = 100;

// Slight vertical nudge (px, pre-scale) so the Silencer reads as standing
// just behind/above the Songbeast rather than perfectly level with it.
export const SILENCER_VERTICAL_OFFSET = -9;

// How close (px, in EXPLORATION_CANVAS_BOUNDS space) the player must walk to
// SILENCED_PREVIEW_CENTER before the Restore prompt appears - hidden again
// if they walk back out past this distance.
export const PROXIMITY_TRIGGER_DISTANCE = 130;

export interface RestorePromptCopy {
  flavorText: string;
  buttonLabel: string;
}

// Flavor text + button label for the Restore prompt (components/battle/RestorePrompt.tsx) -
// kept here, not hardcoded in the component, so writers can edit copy
// without touching component code.
export const RESTORE_PROMPT_COPY: RestorePromptCopy = {
  flavorText:
    "This Songbeast has been silenced — it's forgotten the verse it was made to sing. Sing its Scripture back to it, and remind it who it was created to be.",
  buttonLabel: 'Sing the Verse',
};

// --- Post-battle "return to chest scene" flow ---
// After the Weapon Forged popup's CONTINUE button, the player is dropped
// into a small free-roam scene using the chest.png background
// (components/ChestReturnScene.tsx) before walking back toward the
// pre-battle approach view. Same container/canvas-size convention as the
// Silencer battle's own EXPLORING view above.
export const CHEST_RETURN_CANVAS_BOUNDS = { minX: 0, maxX: 896, minY: 0, maxY: 520 };
export const CHEST_RETURN_PLAYER_SPAWN: Position = { x: 448, y: 380 };
export const CHEST_RETURN_PLAYER_SPEED = 9;
export const CHEST_RETURN_PLAYER_SPRITE_SIZE = 128;

// x position (position.x >= this) that counts as "reached the scene's right
// edge" - triggers the hand-off into the pre-battle scene. See
// hooks/useEdgeTransition.ts.
export const CHEST_RETURN_RIGHT_EDGE_THRESHOLD_X = CHEST_RETURN_CANVAS_BOUNDS.maxX - 40;

// Where the player spawns in the pre-battle exploration view when arriving
// via that right-edge transition, rather than a fresh cold entry (which
// spawns at EXPLORATION_PLAYER_SPAWN instead) - the scene's own left edge,
// so exiting right from the chest scene and entering from the left reads as
// one continuous walk. Only the x is fixed here; the y carries over from
// wherever the player was on the chest scene's own y-axis (see
// ChestReturnScene.tsx), clamped into EXPLORATION_CANVAS_BOUNDS by
// usePlayerWalker itself.
export const PRE_BATTLE_LEFT_EDGE_SPAWN_X = EXPLORATION_CANVAS_BOUNDS.minX + 80;

// How long (ms) the INTRO cinematic (scale-up + cross-fade push-in from the
// zoomed-out to the zoomed-in background, characters arriving) holds once
// it settles before the Scripture parchment (CHALLENGE phase) appears - see
// hooks/useSilencerBattle.ts.
export const INTRO_TO_CHALLENGE_DELAY_MS = 2500;

// Duration (ms) of the cinematic push-in itself (background cross-fade +
// scale-up) - the CSS transition components/battle/BattleIntroTransition.tsx
// (or equivalent) animates over.
export const INTRO_TRANSITION_DURATION_MS = 900;

// --- Post-restoration debrief dialogue (RESTORED -> DEBRIEF_PROMPT -> DIALOGUE -> COMPLETE) ---

// Peak scale (1 = no growth) the .animate-breathe CSS loop (app/globals.css)
// scales a portrait up to at the midpoint of each cycle, before easing back
// to 1 - applied to the Songbeast head and player portraits in
// components/battle/DebriefSpeakerPortrait.tsx via a CSS custom property, so
// the "how much" and "how fast" tuning below never needs touching CSS or
// component code.
export const DEBRIEF_BREATHE_SCALE = 1.04;
export const DEBRIEF_BREATHE_DURATION_MS = 2800;
