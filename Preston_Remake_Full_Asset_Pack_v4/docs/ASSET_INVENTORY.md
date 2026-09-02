# Asset Inventory Summary

- Total tracked package files before checksum file: 73
- Decodable images: 45
- Decodable audio files: 18
- Source-original game images: 9
- Source-original audio masters: 6
- Runtime images/derived backgrounds: 13
- Runtime audio fallbacks: 12

See `provenance/INVENTORY.json` for byte size, SHA-256, image dimensions, audio codec, channel count, sample rate, and duration per file.

## Runtime keys

The authoritative runtime paths are in `runtime/asset-manifest.json`. The game should not hard-code these paths outside the manifest loader.

## Exclusions

See `provenance/excluded-assets.json` and `references/metadata/font-references.json`. No font binary or glyph atlas is included.
