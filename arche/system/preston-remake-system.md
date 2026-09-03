# Preston vs Particles V1 — Canonical System Document

Date: 2026-09-03
System status: **IMPLEMENTED AND LOCALLY VERIFIED**
Hosted status: **NOT RUN**
Production status: **NOT RUN**

This is the one canonical description of the implemented browser remake. The supplied detailed plan is preserved product input. The later plane-shooter correction supersedes every conflicting arena-gameplay statement.

## Product Flow

```text
Opening: “Start Shooting!” / “BGM: David So HandSome”
  -> trusted click unlocks audio, starts opening music, plays Leon voice
  -> Question 1: “Is David handsome?” [Yes]
  -> Question 2: “Is David handsome?” [Yes | No]
       No  -> Access Denied -> Main Menu; Phaser/gameplay never mounts
       Yes -> Secret Code
  -> trim(input) === "basic", case-sensitive
  -> Character Setup
       packaged or one uploaded player appearance
       packaged four or up to eight uploaded enemy appearances
  -> Enter Arena
  -> fixed-camera vertical plane shooter <-> Pause
  -> GAME OVER / Final Score
       Shooting Again! | Change Characters | Main Menu
```

`Shooting Again!` creates a clean simulation and renderer. Change Characters keeps locally saved uploads. Main Menu disposes the run and resets the gate session.

## System Thesis and State Authority

DOM Presentation dispatches typed commands to the Application Controller. The controller owns the product phase and composes five independent systems through public entrypoints. Browser and Phaser capabilities sit behind adapters.

| Boundary | Authoritative responsibility | Typed inputs / outputs | Does not own |
| --- | --- | --- | --- |
| DOM Presentation | Opening, gate forms, setup, HUD, pause and game-over controls, accessible feedback | DOM events / rendered `AppState` | Gameplay rules or renderer objects |
| Application Controller | Legal product transitions, async serialization, system composition, runtime/audio lifecycle | `AppCommand` / `AppState` and typed command result | Private system implementations |
| Gate System | Ordered question/rejection/code state machine | `GateAction` / immutable `GateSnapshot` | Authentication; the code is intentionally client-side |
| Asset Catalog | Manifest validation and semantic asset resolution | `AssetKey` / descriptor or typed failure | Feature logic |
| Audio System | Gesture unlock, one music role, semantic voice/SFX policy, mute/pause/disposal | Audio commands / result and snapshot | Game rules |
| Customization System | File policy, normalization, appearance selection, versioned persistence state | Upload/select/delete/clear/load / typed result | Hitboxes or enemy definitions |
| Plane Shooter Gameplay System | Player position/health, move vector, projectiles, four enemy mechanics, spawning, movement/lifetime, collisions, score, game over, restart | `SetMoveVector`, `FirePressed`, `AdvanceFrame`, `RestartRun` / immutable snapshot, events, failures | Phaser, DOM, audio, files, IndexedDB |
| Phaser Adapter | World-to-screen projection, textures, scrolling background, sprite/FX presentation, keyboard/touch plumbing | Public gameplay snapshots and input commands | Health, damage, score, spawning, collision, game over |
| IndexedDB Adapter | Durable versioned customization record | `CharacterStorePort` | Selection rules or gameplay |

The only Gameplay System port is injectable `[0,1)` randomness. Appearance references are opaque renderer keys. No image dimension crosses into collision or statistics.

## Gameplay Contract

`PlaneShooterSimulation` has lifecycle `idle -> running <-> paused -> gameOver`, with `RestartRun -> running` and terminal `dispose`. During `running`:

- Arrow/WASD input becomes a normalized four-direction `MoveVector`; positive world Y is up.
- `FirePressed` is an edge command. It creates one projectile above the player with no cursor, held-fire, cooldown, spread, homing, or angle input.
- `AdvanceFrame` moves and clamps the player, moves projectiles and enemies, advances the fixed spawn clock, decrements enemy lifetimes, resolves collision, changes score/health, and emits semantic events.
- A projectile is removed on its first hit. Continuous circle collision prevents fast projectile/enemy tunnelling.
- A contacting enemy is removed and can damage the player only once.
- At health zero, `GameOver` is emitted exactly once; later movement, fire, damage, score, and spawn mutation are rejected.
- Restart resets position, health, score, entity collections/IDs, elapsed/spawn clocks, RNG sequence, terminal result, renderer, scrolling offsets, and transient listeners.

There are no waves, progressive difficulty, survival-time rules, mouse aim, automatic rapid fire, bosses, upgrades, or power-ups.

## Recovered Parity Configuration

The typed source of truth is `src/config/planeShooterParity.ts`.

| Mechanic | Value | Evidence |
| --- | ---: | --- |
| Fixed simulation step | 60 Hz | Implementation choice |
| Player start | `(0, -3)` | Recovered serialized Unity data |
| Player speed / health | `5` / `3` | Recovered serialized Unity data |
| Projectile direction / speed / damage | `(0, +1)` / `20` / `1` | Recovered serialized Unity data |
| Firing | One projectile per discrete press | Running-build observation and correction |
| Spawn interval / area | `0.5 s` / width `2`, height `6` | Recovered serialized Unity data |
| Enemy roster | `enemy.base`, `enemy.1`, `enemy.2`, `enemy.3` | Recovered serialized Unity data |
| Background speeds | `2.5`, `3.0` | Recovered serialized Unity data |
| Camera world | x `±2.8125`, y `±5` | Inferred from orthographic size 5 and 9:16 |
| Bounds padding | serialized `50` interpreted as `50/96` world units | Inferred/tuned; field semantics unproven |
| Player/enemy/projectile hitbox radii | `0.32` / `0.32` / `0.09` | Inferred/tuned, appearance-independent |
| Player muzzle offset | `+0.62` world Y | Inferred/tuned |
| Runtime caps | 64 enemies / 128 projectiles | Defensive implementation choice |

| Enemy | HP | Down speed | Life | Score | Contact | Visual scale | Rotation |
| --- | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| `enemy.base` | 2 | 15 | 8 s | 1 | 1 | random 1.0–4.0 | 100°/s |
| `enemy.1` | 3 | 4 | 8 s | 2 | 1 | random 1.0–1.2 | 0 |
| `enemy.2` | 4 | 5 | 8 s | 4 | 1 | fixed; displayed as 1.0 | 0 |
| `enemy.3` | 10 | 2 | 8 s | 5 | 1 | random 0.2–1.2 | 0 |

The fixed visual scale used for `enemy.2` is tuned because its exact scale value was not supplied. Scale and rotation are presentation fields only; all instances keep the definition’s health, speed, score, contact damage, lifetime, and fixed gameplay hitbox.

## Parity Evidence Labels

### VERIFIED IN RUNNING BUILD

- Fixed-camera vertical/top-down plane-shooter composition and bottom-center player start.
- Four-direction movement, Arrow controls, WASD alternatives, camera-bound clamping, and no cursor dependency.
- Discrete Space firing, one projectile per held key-down edge, and straight-up projectile travel.
- Enemies spawning above and moving down; health and score HUD; `3 -> 2 -> 1 -> 0` damage path.
- Gapless vertically scrolling mirrored photographic background.
- GAME OVER, Final Score, `Shooting Again!`, clean retry, Change Characters, and Main Menu.
- Opening screen with `Start Shooting!` and the supplied subtitle.

These were exercised in the built production preview and captured at 1440×1000, 1920×1080, 390×844, and 360×740. Straight direction, exact damage and per-definition hit counts are also asserted at the framework-independent contract boundary.

### RECOVERED FROM SERIALIZED UNITY DATA

- Player speed 5 and starting health 3.
- Projectile speed 20 and damage 1.
- Spawn interval 0.5 seconds and configured area 2 by 6.
- The four enemy definitions and all statistics in the table above.
- Background scroll values 2.5 and 3.0.

### INFERRED/TUNED

- Meaning and pixel/world conversion of PlayerMovement’s additional serialized value 50.
- Exact camera-edge clamp, hitbox radii, muzzle offset, sprite display sizes, layer blend/offset, and the fixed display scale for `enemy.2`.
- Exact Jimmy/Zac reaction/death selection rule; the remake alternates nonterminal reactions and deterministically selects the terminal clip from seed plus final score.

`reference-unity-build/Preston vs particles 2.zip` was absent from the filesystem, current Git tree, and Git history. It could not be launched. The pack’s extracted metadata and previews are evidence, but are not reported as fresh running-original verification.

## Assets and Background Reconstruction

Application code resolves semantic IDs from `public/assets/asset-manifest.json`; it never imports long pack paths. Runtime copies remain byte-identical to the supplied v4 pack. Source originals and provenance under `Preston_Remake_Full_Asset_Pack_v4/` remain untouched.

- Exact supplied runtime media: original player, four enemies, projectile, knob, opening/gameplay music, shoot SFX, Leon voice, and Jimmy/Zac clips. OGG is first choice with MP3 fallback.
- Opening reconstruction: the 168×288 source’s mirror wrap and 10×10 intent are represented by the supplied mirror supertile repeated 5×5 in the portrait DOM background.
- Gameplay reconstruction: the supplied 131×169 tile’s 2×2 mirror intent is represented by the mirror supertile. Two renderer layers move at recovered values 2.5 and 3.0 and repeat vertically without gaps; the portrait reconstruction is a load-failure fallback.
- A centered 9:16 composition is fitted/letterboxed without changing world geometry.

Technical verification does not establish rights to publicly redistribute the supplied personal media.

## Customization and Local Persistence

- PNG, JPEG/JPG, and WebP are declaration- and signature-checked; unsupported, corrupt, oversized, or invalid-dimension files are rejected with useful errors.
- Maximum input is 10 MiB and 128–8192 pixels per edge. Pan is −1 to 1, zoom 1× to 3×, and output is normalized to centered 512×512 WebP with PNG fallback.
- One custom player and up to eight selected enemy images are supported.
- Packaged selection maps the original four appearances to their four mechanical definitions. A custom pool is chosen only after the original mechanical definition is selected.
- IndexedDB database `preston-character-customization`, store `customization`, key `current`, schema version 1 persists normalized blobs and selection across reload.
- Missing, corrupt, unavailable, version-mismatched, read/write-failed, and stale records have tested recovery. Clear restores packaged defaults. Temporary object URLs are retained/revoked by one registry.

Uploads never leave the browser.

## Lifecycle and Failure Handling

| Situation | Implemented response |
| --- | --- |
| Asset boot contract failure | Typed fatal screen; no partially initialized runtime |
| Browser autoplay block | Trusted Start click performs unlock; retry/mute path remains available |
| Rejected gate | No Gameplay System or Phaser runtime is created |
| Arena mount failure/timeout | Runtime teardown and recoverable return to customization |
| Pause/visibility loss | Simulation, renderer scrolling, and audio pause consistently |
| Invalid gameplay command | Typed `run-not-active`, `invalid-delta`, `capacity-reached`, or `disposed` failure |
| Game over | Exactly-once terminal result; renderer and spawning stop |
| Retry/navigation | Idempotent runtime/input/audio/object cleanup before the next surface |
| IndexedDB failure | Safe defaults/in-memory session with warning and reset path |

## Accessibility and Responsive Web Quality

All non-game surfaces use semantic buttons and labeled forms, keyboard operation, visible focus, error/status roles, readable contrast, and reduced-motion handling. The canvas has an accessible label and suppresses browser gestures only over gameplay. The DOM HUD avoids the player’s central lane; fixed touch targets are shown only on touch-capable devices.

Desktop uses Arrow/WASD plus Space. Mouse movement/clicking does not aim or fire. Mobile uses a fixed joystick and FIRE button mapped to the same `SetMoveVector`/`FirePressed` commands.

## Verification Record

Evidence recorded locally on 2026-09-03 against the Vite production-preview path:

| Layer | Result |
| --- | --- |
| Asset contract | 13 semantic image keys, 6 semantic audio keys, and 25 media files verified; source checksums passed |
| Static | TypeScript, ESLint, and dependency-boundary checks passed |
| Unit / contract | 65 passed, 0 failed across Gate, Assets, Audio, Customization, Persistence, and Plane Shooter |
| System | 4 passed, 0 failed for Application Controller composition/lifecycle/audio routing |
| E2E | 9 passed, 0 failed, 3 intentional duplicate-persistence skips across four Chromium projects |
| Browser | Chromium 1440×1000, 1920×1080, 390×844, 360×740; opening, Q1/Q2, rejection, invalid/valid code, setup, default/custom play, pointer non-fire, Space edge, touch move/fire, scrolling/pause, damage, game over, retry, Change Characters, persistence reload, Main Menu, and console capture exercised |
| Build | Vite production build passed; distribution audit passed with no Unity/WASM/C#/source-original artifact |
| Hosted | **NOT RUN** |
| Production | **NOT RUN** |

Playwright observed successful requests for opening/gameplay music, Leon voice, shoot SFX, and Jimmy/Zac terminal audio. Headless automation does not prove audible loudness or subjective mix. No serious page or console errors were observed. Safari, Firefox, physical-device input, hosted Vercel behavior, and media redistribution rights remain unverified.

Vite reports a non-fatal large-chunk warning for the Phaser bundle; this is a later loading optimization, not a correctness failure.

## Development and Deployment

Node 24 or newer:

```sh
npm install
npm run dev
npm run check
npm run test:e2e
npm run build
```

The static bundle is `dist/`. `vercel.json` selects the Vite build and `dist` output and provides asset caching. There is no backend, auth, environment variable, localhost runtime assumption, Unity loader, Unity data, Unity WASM, or C# dependency. Public/production deployment was not authorized and remains separate from local readiness and media-rights review.

## Planned, Implemented, Verified

| State | Meaning |
| --- | --- |
| PLANNED | Supplied plans and deferred ideas only; not runtime claims |
| IMPLEMENTED | Present in application source and integrated through the public boundaries above |
| VERIFIED | Passed the exact local static, contract, system, build, distribution, and Chromium evidence stated above |

## Deferred Backlog / V1 Non-Goals

Accounts, login/auth, Supabase, backend/cloud storage, multiplayer, leaderboards, public game sharing, custom question builder, mid-game character switching, character abilities, AI background removal, admin tools, monetization, analytics, waves, progressive difficulty, bosses, upgrades, power-ups, and survival mechanics remain intentionally excluded.
