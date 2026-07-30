# Battle art assets

Drop files with these exact names/extensions into this folder to replace the
Silencer battle's art. No code changes are needed - `config/battleAssets.ts`
is the only place these paths are referenced.

| File | Role |
| --- | --- |
| `Battle_Background_Songbeast.png` | Battle scene background |
| `Player_Girl_Body.png` | Player avatar - body |
| `Player_Girl_Arm.png` | Player avatar - arm (animates independently for the Speak Truth gesture) |
| `Silencer_Body.png` | The Silencer - body |
| `Silencer_Arm.png` | The Silencer - arm (animates independently for the re-silence attack) |
| `Songbeast_Legs_Tail.png` | Songbeast - legs and tail (never animated) |
| `Songbeast_Body.png` | Songbeast - torso (breathes/sways) |
| `Songbeast_Head.png` | Songbeast - head (pivots for the dip-and-whip) |
| `Songbeast_Glasses_Main.png` / `Songbeast_Glasses_Add.png` | Songbeast gear piece - glasses, front/back layers |
| `Songbeast_Headphones_Main.png` / `Songbeast_Headphones_Add.png` | Songbeast gear piece - headphones, front/back layers |
| `Songbeast_Muzzle.png` | Songbeast gear piece - muzzle |
| `Songbeast_Restored_Body.png` / `Songbeast_Restored_Head.png` / `Songbeast_Restored_Legs.png` | Swapped in at the peak of the final-restoration flash |

To point at a differently-named file instead of replacing one of the above,
edit the corresponding path in `config/battleAssets.ts`.

## Adding rounds or challenge types

- Round content (verse reference, difficulty curve, response tones, and
  temptation line) lives in `config/silencerBattleRounds.ts` - the curve is
  sized by a handful of constants there; no component or hook changes are
  required to retune it.
- Challenge types are defined behind the `ChallengeType`/`Challenge` interface
  in `utils/challengeGenerator.ts`. To add a new type, add it to the
  `ChallengeType` union, teach `generateChallenge` how to build its
  `segments`, and add a case to the rendering switch in
  `components/battle/VerseParchment.tsx`.
