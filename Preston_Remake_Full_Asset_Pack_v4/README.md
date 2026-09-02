# Preston Remake Full Asset Pack v4

This is the validated handoff package for rebuilding the supplied Unity WebGL game as a browser-native Phaser/TypeScript application.

## Start here

- `docs/Preston_Remake_Detailed_Code_Plan.md` — decision-complete product/system/code plan.
- `runtime/asset-manifest.json` — stable Phaser-facing asset keys and background behavior.
- `runtime/` — only the files intended to be copied to the web app’s `public/assets/` directory.
- `source-originals/` — byte-preserved recovered PNG/M4A media; keep outside the deployed public directory.
- `references/` — background reconstruction, extraction metadata, and generic Unity UI/template references.
- `provenance/` and `checksums/` — mapping, exclusions, technical inventory, and integrity evidence.

## Included game-specific media

- 1 original player image.
- 4 original enemy images.
- 1 bullet image.
- 2 original background tiles.
- mirror supertiles and fixed 1080×1920 background fallbacks.
- 1 relevant game UI knob image.
- 2 music tracks.
- 1 shooting sound effect.
- 3 voice clips.
- OGG and MP3 browser-ready variants of every audio clip.

## Background parity

- Opening: original 168×288 tile, Unity mirror wrap, 10×10 original-tile repetition.
- Gameplay: original 131×169 tile, Unity mirror wrap, 2×2 original-tile repetition.
- The preferred runtime files are the supplied mirror supertiles. Fixed portrait reconstructions are fallbacks and visual references.

## Deliberate exclusion

No font binary, SDF font atlas, or emoji glyph atlas is included. Metadata-only records remain under `references/metadata/` and `provenance/`.

## Limits

The source was a compiled Unity WebGL build, not the original C# project. Exact gameplay constants, C# logic, Unity particle parameters, shaders, and animator behavior must be recaptured or intentionally recreated as described in the code plan.

## Rights

Technical extraction does not establish permission to publish personal photos, voices, music, or other media. Confirm all rights, likeness consent, privacy, and redistribution permissions before public deployment.
