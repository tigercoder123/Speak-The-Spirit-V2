// Single source of truth for Silencer-battle art. Components import paths
// from here only, so swapping art is a file drop-in (or a one-line path
// change here) with no component changes needed.
//
// To replace an asset: drop a new file at the same path with the same
// filename/extension shown below, or edit the path for that key here.
// See public/battle/README.md for the full asset list.
export const BATTLE_ASSETS = {
  // The battle scene is a single mount that owns both a zoomed-out
  // exploration view (the silenced Songbeast+Silencer seen from a
  // distance, before the player confirms the Restore prompt) and the
  // zoomed-in battle view (the Challenge/gear-removal fight itself) - see
  // hooks/useSilencerBattle.ts's EXPLORING/INTRO phases, which swap between
  // these two, and components/SilencerBattleScene.tsx, the one mount for
  // both.
  backgrounds: {
    zoomedOut: '/battle.png',
    zoomedIn: '/battle/Battle_Background_Songbeast.png',
    // The post-"Weapon Forged" free-roam scene (components/ChestReturnScene.tsx)
    // reached via QuestRiddle's CONTINUE button - same file the Crossroads
    // quest's own chest stage uses, but otherwise unrelated to it.
    chestReturn: '/chest.png',
  },
  player: {
    // A single flat sprite (no separate arm layer) - used for the
    // zoomed-out exploration walk-up and the intro cinematic's
    // characters-arriving beat. Deliberately NOT the Player_Girl_* battle
    // assets below, which are a different, two-layer sprite.
    walking: '/characters/girlnobackground.png',
    // The existing battle-framed avatar's own two-layer sprite - body plus
    // a separately-animated arm for the Speak-Truth gesture (see
    // components/battle/SongbeastBattleAvatar.tsx). Unrelated to `walking`
    // above; kept under its own keys since it serves a different rendering
    // (arm-gesture animation, not free walking).
    battleBody: '/battle/Player_Girl_Body.png',
    battleArm: '/battle/Player_Girl_Arm.png',
  },
  silencer: {
    body: '/battle/Silencer_Body.png',
    arm: '/battle/Silencer_Arm.png',
  },
  songbeast: {
    // Anatomy that isn't gear - never swapped out, just individually
    // animatable (legs/tail plant in place, torso breathes/sways, head
    // pivots for the dip-and-whip, muzzle sits over the mouth).
    base: {
      body: '/battle/Songbeast_Body.png',
      head: '/battle/Songbeast_Head.png',
      legsTail: '/battle/Songbeast_Legs_Tail.png',
      muzzle: '/battle/Songbeast_Muzzle.png',
    },
    // Each gear piece the Silencer fitted the Songbeast with, individually
    // addressable by the ON/HALF_ON/REMOVED state machine in
    // hooks/useSilencerBattle.ts (GearPieceState). "main"/"add" are NOT a
    // state - they're a permanent z-depth split of that ONE piece's own
    // artwork around the head (confirmed against
    // components/battle/SongbeastBattleAvatar.tsx's existing rendering):
    // "add" renders behind the head, "main" in front of it. Both layers of
    // a piece always move together across every state. The muzzle (in
    // `base` above) has no such split - it doesn't need one.
    gear: {
      glasses: {
        main: '/battle/Songbeast_Glasses_Main.png',
        add: '/battle/Songbeast_Glasses_Add.png',
      },
      headphones: {
        main: '/battle/Songbeast_Headphones_Main.png',
        add: '/battle/Songbeast_Headphones_Add.png',
      },
    },
    // Swapped in at the peak of the final-restoration flash, replacing
    // `base` above for the rest of the battle.
    restored: {
      body: '/battle/Songbeast_Restored_Body.png',
      head: '/battle/Songbeast_Restored_Head.png',
      legs: '/battle/Songbeast_Restored_Legs.png',
    },
  },
} as const;

// Songbeast_Restored_Head.png is exported on the SAME full-body canvas as
// every other Songbeast layer above (so all layers align when stacked
// h-full/w-full inside SongbeastBattleAvatar.tsx's own box) - the actual
// visible head only fills a small sub-region of that canvas. A plain
// object-contain render of this asset by itself (e.g. as a standalone
// portrait - see components/battle/DebriefSpeakerPortrait.tsx) shows the
// head tiny and off-center rather than filling the frame, so that component
// crops/zooms into this measured region instead. Measured directly against
// the PNG's non-transparent pixels (alpha > ~15%), not eyeballed.
export const SONGBEAST_RESTORED_HEAD_PORTRAIT_CROP = {
  naturalWidth: 666,
  naturalHeight: 375,
  visibleBox: { left: 183, top: 44, right: 306, bottom: 204 },
} as const;
