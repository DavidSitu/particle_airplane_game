# Provenance and Usage

## Technical source

Media was recovered from the user-supplied compiled Unity WebGL build `Preston vs particles 2.zip`.

## Separation rules

- Preserve `source-originals/` without editing it in place.
- Copy only `runtime/` into the new application’s `public/assets/` directory.
- Keep `references/`, `provenance/`, `checksums/`, and `docs/` outside the deployed public asset directory.
- Load runtime files through stable keys in `runtime/asset-manifest.json`.
- Do not load Unity WebAssembly, loader, framework, or data files in the remake.

## Generated variants

OGG/MP3 files are transcoded browser variants. Mirror supertiles and fixed portrait backgrounds are generated/derived implementations of recovered Unity tiling behavior. They are not additional original source assets.

## Fonts

Font binaries and glyph atlases are excluded. Use a separately approved and properly licensed web font or a system fallback.

## Legal boundary

Successful checksum, decoding, build, or deployment verification proves technical integrity only. It does not prove copyright, music licensing, likeness consent, privacy compliance, or redistribution rights.
