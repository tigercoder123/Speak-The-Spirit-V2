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
    // 4 interchangeable scenery themes for the exploration (zoomedOut) and
    // battle (zoomedIn) views - hooks/useSilencerBattle.ts randomly picks
    // ONE theme per battle (fresh on every mount, i.e. every time the player
    // clicks Battle) and uses that same pair for both views, so the scene
    // reads as one consistent place rather than switching art mid-battle.
    themes: [
      { zoomedOut: '/battle.png', zoomedIn: '/battle/Battle_Background_Songbeast.png' },
      { zoomedOut: '/Hope_Background.jpg', zoomedIn: '/battle/Hope_Battle_Background.png' },
      { zoomedOut: '/Joy_Background.png', zoomedIn: '/battle/Joy_Battle_Background.png' },
      { zoomedOut: '/Love_Background.png', zoomedIn: '/battle/Love_Battle_Background.png' },
    ],
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
      // The lower body used to be one flat Songbeast_Legs_Tail.png layer -
      // now 4 independently-stacked full-canvas (666x375, same coordinate
      // space as body/head) parts so each can be positioned/animated on its
      // own. See components/battle/SongbeastBattleAvatar.tsx's stacking
      // order for how these 4 combine with `body` between them.
      frontLegs: '/battle/Songbeast_Legs_Front.png',
      backLegs: '/battle/Songbeast_Legs_Back.png',
      belly: '/battle/Songbeast_Belly.png',
      tail: '/battle/Songbeast_Tail.png',
      muzzle: '/battle/Songbeast_Muzzle.png',
    },
    // Each gear piece the Silencer fitted the Songbeast with, individually
    // addressable by the ON/HALF_ON/REMOVED state machine in
    // hooks/useSilencerBattle.ts (GearPieceState). "main"/"add" are NOT a
    // state - they're a permanent z-depth split of that ONE piece's own
    // artwork (confirmed against components/battle/SongbeastBattleAvatar.tsx's
    // existing rendering): "add" renders behind its anchor (the head, for
    // glasses/headphones), "main" in front of it. Both layers of a piece
    // always move together across every state (handcuffs' half-on pose is
    // the one deliberate exception - see SongbeastBattleAvatar.tsx). The
    // muzzle (in `base` above) has no such split - it doesn't need one.
    gear: {
      glasses: {
        main: '/battle/Songbeast_Glasses_Main.png',
        add: '/battle/Songbeast_Glasses_Add.png',
      },
      headphones: {
        main: '/battle/Songbeast_Headphones_Main.png',
        add: '/battle/Songbeast_Headphones_Add.png',
      },
      // Only present/rendered when config/silencerBattleRounds.ts's
      // getGearPieceOrder(...) includes 'handcuffs' for this battle's verse
      // (see SongbeastBattleAvatar.tsx's `includesHandcuffs` prop) - the
      // Songbeast's wrists, near the front leg rather than the head.
      // `main` is Arm_Back (renders IN FRONT, per explicit art direction)
      // and `add` is Arm_Front (renders BEHIND) - inverted from their own
      // filenames, same as glasses/headphones' main/add naming describes
      // z-depth role, not which file is which.
      handcuffs: {
        main: '/battle/Songbeast_Arm_Back.png',
        add: '/battle/Songbeast_Arm_Front.png',
      },
      // Only present/rendered when getGearPieceOrder(...) includes
      // 'legcuffs' (see SongbeastBattleAvatar.tsx's `includesLegcuffs`
      // prop) - anchored near the back leg instead of the front. Same
      // main/add z-depth convention as handcuffs: `main` (Leg_Back) renders
      // IN FRONT and stays fixed during the half-on pose; `add` (Leg_Front)
      // renders BEHIND and is the one that goes askew.
      legcuffs: {
        main: '/battle/Songbeast_Leg_Back.png',
        add: '/battle/Songbeast_Leg_Front.png',
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
