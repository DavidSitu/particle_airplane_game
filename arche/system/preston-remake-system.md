# Preston vs Particles V1 — Canonical System Document

Date: 2026-09-03  
System status: **IMPLEMENTED and LOCALLY VERIFIED**  
Hosted status: **NOT RUN**  
Production status: **NOT RUN**

This is the canonical post-implementation description of the browser remake. The supplied detailed plan remains the product-intent source; this document records what the repository actually implements and what has been verified.

## Product Flow

```text
Opening
  -> Start Game (unlocks audio, starts opening music, plays Leon voice)
  -> Question 1: Is David handsome? [Yes]
  -> Question 2: Is David handsome? [Yes | No]
       No  -> Access Denied -> Main Menu (no gameplay runtime is mounted)
       Yes -> Secret Code
  -> trim(input) === "basic" (case-sensitive)
  -> Character Setup
       original or uploaded player
       original four or up to eight uploaded enemies
  -> Enter Arena
  -> Gameplay <-> Pause
  -> Game Over
       Retry | Change Characters | Main Menu
```

Main Menu resets the gate session. Retry creates a fresh gameplay simulation and Phaser runtime while retaining the current character selection. Change Characters retains locally saved uploads and returns to setup.

## System Thesis and State Authority

DOM Presentation dispatches typed commands to the Application Controller. The controller authorizes the product flow and composes five independent systems. Each system owns its state and exposes a typed public contract. Browser and Phaser behavior sits behind adapters. Phaser renders public gameplay snapshots and forwards input; it is never authoritative for entities, collisions, health, score, spawning, difficulty, or game over.

| Boundary | Authoritative responsibility | Public inputs / outputs | Adapter or external authority |
| --- | --- | --- | --- |
| DOM Presentation | Semantic screens, forms, accessibility, HUD, unsaved crop preview | User events / rendered `AppState` | DOM and CSS |
| Application Controller | Top-level phase, legal transitions, async guards, runtime creation/disposal | `AppCommand` / `AppState`, typed result | Public system entrypoints and `GameRuntimePort` |
| Gate System | Ordered opening/question/rejection/code state machine | `GateAction` / immutable gate snapshot and transition | None; this is a playful client-side gate, not authentication |
| Asset Catalog | Manifest validation, semantic IDs, asset readiness and URL resolution | Asset key / typed descriptor or failure | Fetch manifest loader; supplied runtime manifest owns paths |
| Audio System | Gesture unlock, one music role, voice/SFX policy, mute, visibility pause, disposal | Semantic audio command / result and snapshot | Browser audio driver and local mute preference |
| Customization System | Upload rules, normalized assets, selected roster, persistence schema, stale-write protection | Upload/select/delete/clear/load / typed result and snapshot | Canvas image processor and character-store port |
| Gameplay System | Deterministic fixed-step state, player, bullets, enemies, collision, health, score, difficulty, result | Input frame and time step / immutable snapshot and semantic events | Injected RNG only |
| Phaser Adapter | Canvas lifecycle, texture selection, mirrored background, sprite/FX views, input plumbing | Public gameplay snapshots and semantic input/events | Phaser 4 and browser canvas |
| IndexedDB Adapter | Versioned durable record reads/writes/clear | `CharacterStorePort` | Browser IndexedDB |

The supplied asset manifest is authoritative for packaged file paths. The Customization System is authoritative for persistence schema and selection policy; IndexedDB only stores that record. Gameplay appearance references never influence simulation geometry.

## Public Entrypoints and Dependency Rules

The systems expose their contracts through `src/systems/<system>/index.ts`. The app talks only to those public entrypoints and the runtime port. Adapters implement ports declared by their owning boundary.

```text
presentation -> app controller -> public system contracts -> owned ports
browser adapters -> Canvas / Audio / Fetch / IndexedDB / lifecycle APIs
Phaser adapter -> public gameplay snapshots + semantic input
```

Forbidden and mechanically checked boundaries include:

- Gameplay or Gate importing Phaser, DOM, Canvas, or IndexedDB.
- Systems importing another system's private implementation.
- Presentation importing system-private code.
- Feature code scattering physical asset paths instead of semantic IDs.
- Unity, Unity WebGL, C#, WASM, backend, auth, or Supabase dependencies in the application/distribution.
- Circular ownership or gate-bypass flags.

## Lifecycle and Failure Handling

| Event or failure | Implemented behavior | Recovery |
| --- | --- | --- |
| Initial boot | Load and validate the complete runtime asset manifest, restore customization, prepare audio | Fatal screen on required asset contract failure |
| Browser audio policy | Unlock is captured synchronously from Start Game; failures are typed and surfaced | Retry sound or continue muted |
| Arena entry/retry | Dispose an existing runtime, create a fresh simulation, then mount one Phaser canvas | Mount timeout/failure returns a recoverable app error path |
| Visibility loss or explicit pause | Pause simulation/runtime and audio consistently | Resume command or visibility return |
| Game over | Freeze simulation/runtime, report score/defeats/survival, play one seeded Jimmy/Zac terminal voice | Retry, customize, or reset to opening |
| Invalid upload | Reject unsupported, spoofed, oversized, corrupt, too-small/large, or invalid crop input | Previous valid selection remains intact |
| IndexedDB missing/read/write failure | Report a warning and preserve safe defaults/session state | Continue in memory; reset remains available |
| Corrupt/version-mismatched record | Reject the record and clear it when recoverable | Defaults are restored and may be saved again |
| Stale async operation/write | Revision and in-flight guards reject stale completion | Latest selection remains authoritative |
| Disposal | Remove DOM/lifecycle/input subscriptions, RAF/Phaser objects, audio voices, and object URLs | Idempotent teardown |

## Assets and Original Parity

Application code resolves stable IDs from `public/assets/asset-manifest.json`; it does not reach into the immutable source pack.

### Exact recovered inputs

- One original player image, four enemy images, one projectile, and the recovered UI knob.
- Opening and gameplay music, shoot SFX, Leon start voice, and Jimmy/Zac voice clips. OGG is preferred with MP3 fallback.
- Runtime shipping copies are byte-identical to their v4 pack sources.
- Thirteen image keys and six semantic audio keys resolve to twenty-five media files.

### Reconstructed from supplied evidence

- Opening background: supplied 168×288 source tile, mirror wrap, bilinear filter, and original 10×10 tile intent. The supplied 2×2 mirror supertile repeats 5×5 in the centered portrait composition; the reconstructed fixed portrait is a failure fallback.
- Gameplay background: supplied 131×169 source tile, mirror wrap, bilinear filter, and original 2×2 tile intent. One supplied 2×2 mirror supertile fills the arena; the reconstructed fixed portrait is a failure fallback.
- Both screens maintain a centered 9:16 composition while safely letterboxing desktop and narrow mobile viewports.

### Tuned approximation

The pack contains extracted assets and metadata but no runnable original or reviewable C# gameplay rules. Movement, combat, spawn balance, UI layout, visual effects, exact type treatment, volume mix, and the Jimmy/Zac terminal-event mapping are evidence-informed recreations. They must not be presented as exact Unity parity.

Public redistribution rights for the supplied personal images, voices, music, and effects were not established by technical verification.

## Customization and Persistence

- Accepted declared and signature-checked types: PNG, JPEG/JPG, and WebP.
- Maximum upload: 10 MiB. Decoded dimensions: 128–8192 pixels on each edge.
- Crop controls allow pan from −1 to 1 and zoom from 1× to 3×.
- Output is a centered 512×512 normalized WebP, with PNG encoding fallback where WebP is unavailable.
- One custom player and a selected roster of up to eight custom enemy images are supported. The original player/four-enemy roster remains available.
- Enemy appearance selection is RNG-driven from the selected roster and does not affect entity stats.
- All player and enemy collision radii come from gameplay configuration, never source/normalized image dimensions.
- Schema version 1 is stored in IndexedDB database `preston-character-customization`, object store `customization`, record key `current`.
- Reload restores normalized blobs and selection. Clear/reset removes the durable record and returns to packaged defaults. Missing, corrupt, unavailable, version-mismatched, and stale records have typed recovery behavior.
- Temporary object URLs are replaced/revoked and disposed rather than accumulating without bound.

Uploads never leave the browser.

## Gameplay

The framework-independent simulation uses a fixed 60 Hz step and injected RNG. It implements keyboard/touch movement, pointer/touch aim and fire, bounded bullet/enemy creation, bullet travel/lifetime, enemy approach/rotation/scale variants, circle collisions, enemy destruction, contact damage with invulnerability, score, health, progressive spawn pressure/speed, game over, result metrics, pause/resume, reset, and disposal. Renderer-only sprites, trails, explosions, damage tint, and background effects are driven from snapshots/events.

All unprovable balance values live in `src/config/gameplayDefaults.ts` and are labeled `TUNED APPROXIMATION`:

| Parameter | Value |
| --- | ---: |
| Simulation / logical world | 60 Hz / 540×960 |
| Player start / speed / radius / health | (270, 880) / 320 units/s / 24 / 100 |
| Bullet speed / radius / damage / cooldown / life | 720 units/s / 8 / 20 / 180 ms / 2,000 ms |
| Enemy radius / health / contact damage | 28 / 20 / 20 |
| Enemy speed / visual scale / angular velocity | 72–150 units/s / 0.78–1.28 / −1.5–1.5 rad/s |
| Spawn interval | 1,000 ms, falling to 280 ms |
| Difficulty | Every 15 s, max level 4, +6 enemy speed/level |
| Contact invulnerability / score | 900 ms / 100 per defeat |
| Runtime caps | 64 enemies / 128 bullets / 192 total entities |

## Accessibility, Responsive Behavior, and Controls

- Non-game screens use semantic buttons, labeled forms, keyboard-operable controls, visible focus styles, status/error roles, readable contrast, and reduced-motion handling for nonessential effects.
- Desktop: WASD/arrows move; mouse aims; press/hold fires.
- Touch: the left arena half is a virtual movement stick and the right half aims/fires. Page gestures are suppressed only over the arena.
- HUD shows health, score, wave, pause, and mute without changing logical world geometry.
- CSS fits an exact 9:16 game frame within desktop, 390×844, 360×740, and wide layouts.

## Verification Record

Evidence recorded on 2026-09-03 against the production-preview path:

| Layer | Verified result |
| --- | --- |
| Asset contract | 13 image keys, 6 audio keys, and 25 media files verified; supplied pack checksums passed |
| Static | TypeScript, ESLint, and dependency-boundary checks passed |
| Unit/contract | 58 passed, 0 failed across Gate, Assets, Audio, Customization, Persistence, and Gameplay |
| System | 4 passed, 0 failed for Application Controller flow/lifecycle |
| E2E | 9 passed, 0 failed, 3 intentionally skipped duplicate persistence cases across 4 Chromium projects |
| Build | Vite production build passed; final distribution audit found 26 byte-identical source assets among 29 production files and no Unity/runtime/source-map contamination |
| Browser | Chromium at 1440×1000, 1920×1080, 390×844, and 360×740; opening, both questions, rejection, invalid/valid code, customization, default/custom gameplay, damage, pause, game over, retry, change characters, reload persistence, and main-menu return exercised |
| Hosted | Not run |
| Production | Not run |

Playwright verified successful audio asset requests for opening/gameplay music, Leon voice, shoot SFX, and Jimmy/Zac terminal voice. Headless automation cannot prove perceived loudness or speaker output. No serious console or page errors were observed. Safari, Firefox, and physical devices were not tested.

Vite reports its standard large-chunk warning for the Phaser-containing JavaScript bundle; this is not a build failure and is retained as an optimization opportunity.

## Development and Deployment

Requires Node 24 or newer.

```sh
npm install
npm run dev
npm run check
npm run test:e2e
npm run build
```

The static production bundle is `dist/`. `vercel.json` selects the Vite build and `dist` output and applies immutable caching to packaged assets. The application has no backend, auth, server runtime, localhost assumption, or Unity dependency. A public deployment remains gated by explicit authorization and independent media-rights/likeness review.

## Planned, Implemented, and Verified

| State | Meaning here |
| --- | --- |
| PLANNED | The supplied detailed plan and intentionally deferred backlog describe desired or possible behavior; they are not runtime claims. |
| IMPLEMENTED | The source tree contains the app flow, five systems, adapters, renderer, tests, scripts, styles, and deployment configuration described above. |
| VERIFIED | The local static, contract, system, build, distribution, and Chromium evidence in the verification table passed. Hosted behavior, other browser engines, physical devices, audible output, and redistribution rights are not verified. |

## Deferred Backlog / V1 Non-Goals

Accounts, login/authentication, Supabase, backend/cloud storage, multiplayer, online leaderboards, public game sharing, a custom question builder, mid-game character switching, character-specific abilities, AI background removal, admin tools, monetization, analytics, bosses, maps, and progression/economy remain deliberately outside V1.
