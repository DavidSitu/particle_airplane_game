# Preston vs Particles

A Unity-free browser remake of Preston vs Particles, built with Phaser 4, TypeScript, Vite, DOM overlays, and IndexedDB. The game preserves the supplied recovered media, recreates the mirrored portrait backgrounds, implements the two-question/code gate, and adds locally persisted custom player and enemy images.

## Run locally

Node 24 or newer is required.

```sh
npm install
npm run dev
```

Open the URL printed by Vite. The non-game screens are keyboard accessible. In the arena:

- Move with WASD or the arrow keys.
- Aim and hold the mouse button to fire.
- On touch screens, use the left half to move and the right half to aim/fire.
- Use the HUD button to pause or mute.

## Verification

```sh
npm run check
npm run test:e2e
```

`npm run check` verifies the packaged asset contract, TypeScript, lint, dependency boundaries, Vitest suites, the production build, and the final distribution contents. `npm run test:e2e` builds the app and exercises the production preview in Chromium at desktop, wide-desktop, and two mobile portrait viewports.

Individual commands are also available:

```sh
npm run verify:assets
npm run typecheck
npm run lint
npm run check:boundaries
npm run test:run
npm run build
npm run verify:dist
```

## Build and Vercel

```sh
npm run build
```

The deployable static site is emitted to `dist/`. `vercel.json` declares the Vite build and static output directory; no Unity runtime, backend, environment variable, or server process is required.

The supplied voices, photos, music, and sound effects may carry rights or likeness restrictions. Technical deployment readiness does not establish public redistribution permission; complete a media-rights review before publishing the site publicly.

## Project documentation

- [Canonical system document](arche/system/preston-remake-system.md)
- [Completed build plan and acceptance ledger](arche/plans/preston-remake-v1.md)
- [Documentation index](arche/00-index.md)
- [Supplied detailed implementation plan](Preston_Remake_Detailed_Code_Plan.md)
- [Supplied asset-pack notes](Preston_Remake_Full_Asset_Pack_v4/README.md)

The supplied asset pack is evidence/source input and must not be edited. Runtime shipping copies live under `public/assets/` and are registered through semantic keys in its manifest.
