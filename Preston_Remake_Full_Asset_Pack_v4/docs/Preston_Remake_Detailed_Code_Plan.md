# Preston vs Particles Browser Remake — Decision-Complete Code Plan

**Document status:** Proposed plan only  
**Implementation status:** Not started  
**Verification status:** Asset package verified; application behavior not yet implemented or browser-verified  
**Target:** Browser-native 2D game with no Unity runtime or Unity project dependency

---

## 0. Protocol and planning basis

This document follows the recovered planning structure of the supplied System Design Protocol: current evidence, system thesis, ownership boundary, typed inputs/outputs, state authority, allowed and forbidden dependencies, exact file actions, bounded vertical slices, verification gates, documentation/evidence, non-goals, risks, and definition of done.

The raw `system-design-protocol.zip` and `po.zip` archives were located in the prior file library, but direct archive materialization was permission-blocked in this session. The System Design Protocol itself was recoverable from an indexed copy, and the PO/file-management rules were recoverable from earlier accepted plan records. Therefore:

1. This plan applies those recovered rules directly.
2. The implementation agent must read the actual installed `system-design-protocol` and `po` skills before changing code.
3. If the actual skill text conflicts with this document, the actual skill text is authoritative and the plan must be amended before implementation.
4. No implementation should begin from memory alone.

### Mandatory preflight for the coding agent

Before creating or editing application files, the coding agent must:

1. Read repository-level instructions such as `AGENTS.md`.
2. Read the actual `system-design-protocol` skill.
3. Read the actual `po` skill.
4. Inspect the current branch, worktree status, existing files, and installed runtime versions.
5. Confirm that the requested slice does not overlap unrelated user changes.
6. State the exact slice, owned paths, non-goals, and verification gate before editing.

The plan is intentionally boundary-first and does not create a separate “manager,” “service,” “repository,” or “gateway” for every file. A new system exists only where it owns meaningful rules, state, lifecycle, a durable boundary, or an external technology adapter.

---

# 1. Product definition

## 1.1 Product statement

Rebuild **Preston vs Particles** as a lightweight browser arcade game that preserves the recognizable original gameplay, images, backgrounds, music, voice clips, shooting effect, score, health, game-over loop, and Start Game interaction, while adding a humorous three-step “David verification” gate and a future-proof character customization flow.

The product should feel like a personal, chaotic, shareable mini-game—not a generic shooter, SaaS dashboard, or large RPG.

## 1.2 Target player

The first target player is a friend opening a link on desktop or mobile who should be able to understand the joke, pass or fail the gate, enter the arena, play immediately, and retry without creating an account.

## 1.3 Core player promise

> Press Start Game, survive the David verification gate, choose who appears in the game, and fight increasingly difficult waves using the original Preston assets and audio.

## 1.4 Product pillars

1. **Recognizable parity:** the remake must preserve the original game’s media, core actions, and overall feel.
2. **Immediate personality:** the Start button, voice clip, David questions, secret code, and rejection screen establish the joke before gameplay.
3. **Fast arcade loop:** enter, shoot, survive, score, lose, retry.
4. **Customization without balance changes:** uploaded images change appearance, not physics or combat values.
5. **Browser-native delivery:** no Unity loader, WebAssembly build, Unity framework, C#, or Unity runtime files in the production application.

## 1.5 Exact V1 player journey

```text
Application boot
  -> opening assets load
  -> original opening screen appears
  -> opening background uses original mirror tiling
  -> Start Game button is visible

Player presses Start Game
  -> the real pointer/touch gesture unlocks browser audio
  -> opening music begins or resumes
  -> original Leon “David is so handsome” voice plays
  -> transition to Gate Question 1

Question 1: “Is David handsome?”
  -> only one option: Yes
  -> Yes advances to Question 2

Question 2: “Is David handsome?”
  -> Yes advances to the code gate
  -> No transitions to Access Denied

Access Denied
  -> gameplay and customization are inaccessible
  -> no “continue anyway” action
  -> reloading or returning to the opening restarts the experience

Secret code
  -> user enters text
  -> surrounding whitespace is trimmed
  -> comparison remains case-sensitive
  -> only exact value `basic` passes
  -> incorrect values stay on the same step with a visible error

Customization
  -> choose original player or locally uploaded player image
  -> choose original enemy set or up to eight local enemy images
  -> review previews
  -> press Enter Arena

Gameplay
  -> gameplay music crossfades in
  -> original background mirror tiling is used
  -> player aims, shoots, avoids enemies, loses health, and earns score
  -> enemies spawn continuously and difficulty increases
  -> shooting uses the original shoot effect
  -> player defeat uses the recovered reaction/death audio policy

Game over
  -> show score, defeated enemy count, and survival time
  -> Retry starts a clean session with the same selected skins
  -> Change Characters returns to customization
  -> Main Menu returns to the opening screen
```

## 1.6 “Kick out” behavior

A web page cannot reliably or appropriately close a browser tab it did not open. Therefore “kick the user out” means:

- transition to a dedicated `rejected` application state;
- destroy or never create the Phaser runtime;
- stop game-entry actions;
- show a humorous Access Denied screen;
- provide only a return-to-opening action, or require reload, according to final visual design;
- never permit a hidden route or UI button to bypass the gate.

This is a comedic flow gate, not security. The secret code is present in client-delivered JavaScript and can be discovered by inspecting the bundle.

## 1.7 V1 scope by priority

### P0 — required for the first playable release

- Browser-native Phaser/TypeScript/Vite application.
- Original Start Game button behavior.
- Real user-gesture audio unlock.
- Original opening music, Start voice, gameplay music, shoot SFX, and player reaction/death voices.
- Question 1, Question 2, rejection state, and exact `basic` code gate.
- Original opening and gameplay background behavior, including mirror tiling.
- Original player, four enemies, bullet, and relevant game UI image.
- Player input, aiming, shooting, bullets, enemy spawning, enemy motion, rotation/scale variation, collisions, health, score, game over, and retry.
- Difficulty progression.
- Desktop pointer/keyboard input matching the observed original behavior after parity capture.
- Responsive portrait playfield.
- No Unity runtime in shipped output.

### P1 — required for full V1 customization release

- Pre-game character selection.
- One locally uploaded player image.
- Up to eight locally uploaded enemy images.
- Crop/position preview and game-safe image normalization.
- Fixed hitboxes independent of visual image dimensions.
- IndexedDB persistence with an in-memory fallback.
- Clear-local-customizations action.
- Touch controls on supported mobile browsers.
- Pause, mute, reduced-motion UI behavior, and page-visibility handling.

### P2 — explicitly deferred

- Mid-game character switching.
- Character-specific abilities or classes.
- Online accounts.
- Supabase storage.
- Shareable customized game links.
- Online leaderboards.
- AI background removal.
- Custom question authoring.
- Custom music or voice upload.
- Boss battles, multiple maps, weapon upgrade trees, achievements, or progression economy.

## 1.8 Release milestones

### Milestone A — Original-plus-gate playable

Completes P0. A player can pass the gate, play the original-asset remake, lose, and retry.

### Milestone B — Full local-customization V1

Completes P1. A player can locally select/upload character images, retain them in the browser, and play with fixed balance.

### Milestone C — Social creator V2

Not part of this plan’s implementation scope. Adds server-owned game configurations, shared links, upload moderation, and consent/privacy controls as separate systems.

## 1.9 Product acceptance outcomes

V1 is successful when a first-time player can:

1. See a functioning Start Game button.
2. Hear the correct opening/start audio after a real gesture.
3. Pass the exact three-stage gate or be rejected on Question 2 = No.
4. Reach gameplay without seeing Unity loading UI.
5. Understand movement/aim/fire within one play session.
6. Lose health, increase score, reach game over, and retry.
7. Use the original images and audio with the background tiling visually recognizable.
8. Select or upload character images without changing collision fairness.
9. Reopen the browser and retain local customization when IndexedDB is available.
10. Play on the supported browser matrix without a fatal console error.

---

# 2. Current evidence

## 2.1 Verified source evidence

The supplied artifact is a compiled Unity 6 WebGL build rather than the original Unity project. The recoverable build evidence includes:

- an opening scene and gameplay scene;
- a Start Game interaction;
- player, bullet, enemy spawner, enemy motion, enemy size/rotation, score, health/player manager, game-over/restart concepts;
- one original player image;
- four original enemy images;
- one bullet image;
- one game UI knob image;
- two game-specific photographic background tiles;
- six decoded audio clips;
- recoverable button-state animation clip names;
- Unity-specific runtime files that will not be copied into the remake.

## 2.2 Verified audio inventory

| Stable role | Recovered source | Approximate duration | Intended remake use |
|---|---|---:|---|
| Opening music | `j_rock_with_sakula.m4a` | 82.99 s | Opening/gate/customization music |
| Gameplay music | `sucksucker.m4a` | 31.14 s | Loop during active gameplay |
| Start voice | `Leon_ David is so handsome copy.m4a` | 5.86 s | Start Game interaction |
| Shoot SFX | `shoot.m4a` | 0.34 s | Each accepted shot, with overlap control |
| Player voice A | `Jimmy 屈死.m4a` | 1.01 s | Hurt/death reaction according to parity policy |
| Player voice B | `Zac 屈死 copy.m4a` | 1.10 s | Hurt/death reaction according to parity policy |

The asset package preserves the extracted M4A files and supplies normalized OGG/MP3 runtime fallbacks.

## 2.3 Verified background behavior

The original background images are tiles, not finished full-screen screenshots.

| Scene | Source size | Unity wrap | Original tile count |
|---|---:|---|---:|
| Opening | 168 × 288 | Mirror | 10 × 10 |
| Gameplay | 131 × 169 | Mirror | 2 × 2 |

The original scene uses a portrait playfield close to 9:16. The remake must not simply stretch either source image once.

## 2.4 Verified asset-package state

The v4 handoff package contains:

- byte-preserved extracted originals;
- normalized runtime image names;
- OGG and MP3 browser audio variants;
- stable runtime asset manifest;
- background reconstruction configuration and previews;
- original-to-runtime path mapping;
- extraction inventory and SHA-256 checksums;
- no font binaries or font/glyph atlas data.

The package passed:

- ZIP integrity validation;
- JSON parsing for all manifests;
- image decoding for all included images;
- complete audio decoding for M4A, OGG, and MP3 files;
- checksum verification;
- forbidden-font-file scan.

## 2.5 Known unknowns that must not be invented as “original”

The compiled build does not provide a clean, reviewable C# source tree. The following require black-box parity capture, deeper serialized-data recovery, or an explicit approximation decision:

- exact player movement behavior and numeric speed;
- exact aiming rules;
- whether firing is click-only or supports hold-to-fire;
- exact fire cooldown;
- bullet speed, lifetime, hitbox, and damage;
- enemy spawn positions, weights, interval, acceleration, and maximum count;
- exact enemy motion formula per type;
- enemy health, contact damage, and score values;
- exact collision shapes;
- invulnerability/hit-stop behavior;
- difficulty curve;
- whether Jimmy/Zac clips are selected by event, enemy, sequence, or randomness;
- exact audio volumes, loop points, fades, and start timing;
- exact UI labels, typography, button animation timing, and Game Over layout;
- exact particle effect parameters and shaders.

No plan or code comment may label an approximation as recovered original behavior.

---

# 3. System design thesis

The remake will be one browser application composed from a small set of independently owned systems. Each meaningful system has one responsibility, typed public inputs and outputs, explicit state authority, one public entrypoint, controlled dependencies, and independently testable rules. Phaser, browser audio, Canvas image processing, IndexedDB, and DOM rendering remain technology-specific adapters; they do not own product rules. The pure gameplay simulation owns combat state and transitions, while Phaser owns rendering, input plumbing, visual effects, and audio playback implementation. Text-heavy screens and HUD use accessible DOM UI rather than being embedded in the game canvas. Assets are loaded through stable manifest keys, with source originals, shipping copies, generated variants, provenance, and distribution status kept distinct.

The top-level dependency direction is:

```text
DOM presentation / physical input
  -> App public controller
  -> Gate, Asset, Audio, Customization, and Gameplay public contracts
  -> ports required by those systems
  -> browser/Phaser adapters
  -> DOM, Canvas, IndexedDB, Web Audio/Phaser Audio, filesystem-served assets

Phaser adapter
  -> reads immutable or snapshot gameplay state
  -> sends semantic input actions back to the application/gameplay boundary
  -> never becomes the source of truth for score, health, spawning, or game-over rules
```

---

# 4. System qualification and ownership map

Not every screen is a system. Screens that merely render state remain presentation components. The following capabilities justify independent ownership because they own rules, state transitions, lifecycle, external boundaries, or durable data.

## 4.1 App Flow owner

### Owns

- composition and orchestration between systems;
- the current top-level application phase;
- transition permission between opening, gate, customization, gameplay, and game over;
- construction/disposal of the Phaser runtime;
- one public command surface for the UI.

### Does not own

- gate answer validation;
- audio playback implementation;
- image decoding and persistence;
- gameplay rules;
- Phaser scene internals;
- asset path details.

### Public entrypoint

`src/app/index.ts`

## 4.2 Gate System

### Owns

- ordered gate definition;
- current gate step;
- valid actions at each step;
- Question 2 rejection rule;
- exact secret-code normalization and comparison;
- typed gate result and failure reason.

### Does not own

- screen layout;
- browser navigation;
- audio;
- gameplay;
- real authentication or authorization.

### Public entrypoint

`src/systems/gate/index.ts`

## 4.3 Asset Catalog System

### Owns

- typed asset keys;
- manifest schema and validation;
- required-versus-optional assets;
- source/runtime/reference classification;
- logical background-rendering metadata;
- load readiness and typed load failures.

### Does not own

- Phaser cache internals;
- HTTP implementation;
- image editing;
- gameplay rules;
- licensing approval.

### Public entrypoint

`src/systems/assets/index.ts`

## 4.4 Audio System

### Owns

- semantic audio commands;
- audio readiness/locked/blocked/failed state;
- mute state;
- current music role;
- crossfade and stop policy;
- overlap policy for rapid SFX;
- recovery commands after browser autoplay blocking.

### Does not own

- browser/Phaser audio objects;
- asset URLs;
- Start button presentation;
- gameplay defeat rules;
- licensing.

### Public entrypoint

`src/systems/audio/index.ts`

## 4.5 Character Customization System

### Owns

- original versus local-upload skin references;
- upload validation policy;
- normalized image output specification;
- selected player skin and enemy roster;
- maximum enemy-upload count;
- local persistence lifecycle;
- typed recovery when persistence is unavailable.

### Does not own

- `<input type=file>` presentation;
- Canvas implementation;
- IndexedDB implementation;
- gameplay hitboxes or combat values;
- server upload or moderation.

### Public entrypoint

`src/systems/customization/index.ts`

## 4.6 Gameplay System

### Owns

- authoritative game-session state;
- player health and combat state;
- bullet creation and lifetime;
- enemy spawning and entity state;
- motion rules;
- collision and damage rules;
- score;
- difficulty progression;
- pause/game-over transitions;
- deterministic simulation time;
- session result.

### Does not own

- sprites, tweens, emitters, camera, or Phaser physics bodies;
- physical keyboard/pointer/touch mapping;
- DOM HUD rendering;
- audio playback;
- image files;
- IndexedDB;
- network services.

### Public entrypoint

`src/systems/gameplay/index.ts`

## 4.7 Phaser Runtime Adapter

This is an adapter, not a business-rule system.

### Owns

- Phaser game construction and destruction;
- scene lifecycle;
- texture/audio loading into Phaser caches;
- mapping gameplay snapshots to disposable views;
- pointer/keyboard/touch mapping to semantic input;
- camera, mirror-tiled backgrounds, particles, trails, flashes, shake, and other visual effects;
- object pooling for renderer objects;
- render interpolation.

### Does not own

- score, health, damage, spawn eligibility, difficulty, or game-over decisions;
- gate state;
- customization persistence;
- asset identity beyond catalog keys.

### Adapter entrypoint

`src/adapters/phaser/PhaserRuntimeAdapter.ts`

---

# 5. Typed public contracts

The exact names may be refined during Slice 1, but the semantic boundary must remain stable.

## 5.1 App commands and state

```ts
export type AppCommand =
  | { type: 'START_PRESSED' }
  | { type: 'GATE_ACTION'; action: GateAction }
  | { type: 'CUSTOMIZATION_SAVED'; selection: CharacterSelection }
  | { type: 'ENTER_ARENA' }
  | { type: 'PAUSE_REQUESTED' }
  | { type: 'RESUME_REQUESTED' }
  | { type: 'RETRY_REQUESTED' }
  | { type: 'CHANGE_CHARACTERS_REQUESTED' }
  | { type: 'MAIN_MENU_REQUESTED' }
  | { type: 'MUTE_CHANGED'; muted: boolean };

export type AppState =
  | { kind: 'booting'; progress: number }
  | { kind: 'opening'; audio: AudioSnapshot }
  | { kind: 'gate'; gate: GateSnapshot; audio: AudioSnapshot }
  | { kind: 'rejected'; reason: 'question-2-no' }
  | { kind: 'customizing'; draft: CharacterSelectionDraft; warning?: string }
  | { kind: 'loading-game'; progress: number }
  | { kind: 'playing'; sessionId: string; hud: GameHudSnapshot }
  | { kind: 'paused'; sessionId: string; hud: GameHudSnapshot }
  | { kind: 'game-over'; result: GameSessionResult }
  | { kind: 'fatal-error'; error: AppFailure };
```

### App guarantee

A presentation component may dispatch a typed command and subscribe to state. It may not mutate a system object or Phaser scene directly.

## 5.2 Gate contract

```ts
export type GateAction =
  | { type: 'ANSWER_Q1_YES' }
  | { type: 'ANSWER_Q2'; answer: 'yes' | 'no' }
  | { type: 'SUBMIT_CODE'; value: string }
  | { type: 'RESET' };

export type GateSnapshot =
  | { step: 'question-1' }
  | { step: 'question-2' }
  | { step: 'secret-code'; error?: 'incorrect-code' }
  | { step: 'passed' }
  | { step: 'rejected'; reason: 'question-2-no' };

export type GateTransition =
  | { status: 'advanced'; snapshot: GateSnapshot }
  | { status: 'rejected'; snapshot: GateSnapshot }
  | { status: 'invalid-action'; snapshot: GateSnapshot }
  | { status: 'passed'; snapshot: GateSnapshot };
```

### Gate invariants

- Question 1 cannot receive a No action.
- Question 2 = No always produces rejection.
- Code evaluation occurs only in the code step.
- Code input is trimmed, then compared case-sensitively with `basic`.
- Failed code submission never advances.
- Gate state is session-only and is not persisted across full page reloads.

## 5.3 Asset catalog contract

```ts
export type AssetKey =
  | 'player.default'
  | 'enemy.01'
  | 'enemy.02'
  | 'enemy.03'
  | 'enemy.04'
  | 'projectile.default'
  | 'background.openingTile'
  | 'background.openingMirrorSupertile'
  | 'background.gameplayTile'
  | 'background.gameplayMirrorSupertile'
  | 'ui.knob'
  | 'music.opening'
  | 'music.gameplay'
  | 'sfx.shoot'
  | 'voice.start.leon'
  | 'voice.player.jimmy'
  | 'voice.player.zac';

export interface AssetCatalog {
  loadManifest(): Promise<AssetManifestResult>;
  getRequired(key: AssetKey): AssetDescriptor;
  getOptional(key: string): AssetDescriptor | undefined;
  snapshot(): AssetCatalogSnapshot;
}
```

### Asset guarantee

Gameplay and UI code refer to `AssetKey` values. Direct production asset paths are confined to the manifest and loading adapter.

## 5.4 Audio contract

```ts
export type AudioState = 'locked' | 'unlocking' | 'ready' | 'blocked' | 'failed';

export interface AudioCommands {
  unlockFromUserGesture(): Promise<AudioCommandResult>;
  playMusic(role: 'opening' | 'gameplay', options?: { fadeMs?: number }): Promise<AudioCommandResult>;
  playVoice(role: 'start-leon' | 'player-jimmy' | 'player-zac'): Promise<AudioCommandResult>;
  playSfx(role: 'shoot'): AudioCommandResult;
  setMuted(muted: boolean): void;
  pauseForVisibility(): void;
  resumeFromVisibility(): Promise<AudioCommandResult>;
  stopAll(options?: { fadeMs?: number }): Promise<void>;
  snapshot(): AudioSnapshot;
}
```

### Audio guarantees

- No playback attempt that depends on autoplay occurs before the Start button gesture.
- A blocked or failed audio state does not corrupt gate or gameplay state.
- Rapid shoot SFX uses a bounded voice pool; it does not create unlimited audio objects.
- Music roles are mutually exclusive except during a bounded crossfade.
- Mute state affects playback output but does not silently pretend a failed unlock succeeded.

## 5.5 Customization contract

```ts
export type CharacterSkinRef =
  | { kind: 'packaged'; assetKey: AssetKey }
  | { kind: 'local-upload'; id: string; revision: number };

export interface CharacterSelection {
  player: CharacterSkinRef;
  enemies: readonly CharacterSkinRef[];
}

export interface CharacterCustomizer {
  loadSelection(): Promise<CustomizationLoadResult>;
  processUpload(input: ImageUploadInput): Promise<ImageProcessingResult>;
  saveSelection(selection: CharacterSelection): Promise<CustomizationSaveResult>;
  deleteUpload(id: string): Promise<CustomizationDeleteResult>;
  clearLocalData(): Promise<CustomizationClearResult>;
}
```

### Upload policy

- Accepted MIME types: `image/png`, `image/jpeg`, `image/webp`.
- SVG, GIF animation, HEIC, executable formats, and arbitrary blobs are rejected in V1.
- Maximum input size: 10 MB per image.
- Maximum decoded edge: 8192 px.
- Minimum decoded edge: 128 px.
- Normalized output: 512 × 512 WebP or PNG blob, generated by browser Canvas.
- User can pan/zoom within the crop/fit frame before save.
- Canvas re-encoding strips original metadata such as EXIF.
- One selected player image and at most eight selected enemy images.
- The system stores image blobs and selection metadata locally only.

## 5.6 Gameplay contract

```ts
export interface StartGameCommand {
  sessionId: string;
  seed: number;
  config: GameplayConfig;
  appearance: CharacterSelection;
}

export interface GameInputFrame {
  moveX: number;       // normalized -1..1
  moveY: number;       // normalized -1..1
  aimWorldX: number;
  aimWorldY: number;
  fireHeld: boolean;
  firePressed: boolean;
  pausePressed: boolean;
}

export interface GameSimulation {
  start(command: StartGameCommand): GameSnapshot;
  advanceFixedStep(input: GameInputFrame): readonly GameEvent[];
  pause(): GameSnapshot;
  resume(): GameSnapshot;
  end(reason: GameEndReason): GameSessionResult;
  snapshot(): GameSnapshot;
  dispose(): void;
}
```

### Gameplay guarantees

- Simulation advances on a fixed timestep, proposed at 60 Hz.
- Randomness is supplied by an injected seeded `RandomSource`.
- Score and health are simulation-owned and deterministic for a given seed and input sequence.
- Renderer object existence cannot change game rules.
- Uploaded image dimensions never alter collision shape, health, speed, damage, or score.
- Visual particles are effects, not authoritative collision entities.
- A session is not resumable after `ended` or `disposed`; Retry creates a new session ID and state.

## 5.7 Runtime adapter contract

```ts
export interface GameRuntimePort {
  mount(input: RuntimeMountInput): Promise<RuntimeMountResult>;
  render(snapshot: GameSnapshot, events: readonly GameEvent[], alpha: number): void;
  setInputSink(sink: (input: PhysicalInputSnapshot) => void): void;
  pause(): void;
  resume(): void;
  dispose(): Promise<void>;
}
```

The application owns when a runtime may mount or dispose. Phaser cannot navigate the DOM flow by itself.

---

# 6. State authority and lifecycle

## 6.1 App lifecycle

```text
booting
  -> opening

opening
  -> gate                         on START_PRESSED
  -> fatal-error                  only on unrecoverable boot failure

gate
  -> gate                         valid advance or invalid code
  -> rejected                     Question 2 = No
  -> customizing                  Gate passed

rejected
  -> opening                      explicit return/reload only

customizing
  -> loading-game                 valid selection + Enter Arena
  -> opening                      Main Menu

loading-game
  -> playing                      runtime mounted + gameplay started
  -> customizing                 recoverable load failure
  -> fatal-error                 unrecoverable application failure

playing
  -> paused                       pause/visibility rule
  -> game-over                    simulation emits session ended

paused
  -> playing                      resume
  -> game-over                    explicit end if required

 game-over
  -> loading-game                 Retry
  -> customizing                 Change Characters
  -> opening                      Main Menu
```

### Invalid transitions

Invalid commands return a typed no-op/failure and do not mutate state. Examples:

- Enter Arena while gate is incomplete.
- Retry while playing.
- Gate answer while in customization.
- Resume after game over.

## 6.2 Gate lifecycle

```text
question-1
  -- Yes --> question-2

question-2
  -- Yes --> secret-code
  -- No  --> rejected

secret-code
  -- trim(value) === "basic" --> passed
  -- otherwise               --> secret-code + incorrect-code error
```

## 6.3 Audio lifecycle

```text
locked
  -> unlocking                Start Game gesture
  -> ready                    context/resume succeeds
  -> blocked                  browser policy still blocks
  -> failed                   decode/device/runtime failure

blocked
  -> unlocking                explicit visible Enable Sound action

failed
  -> unlocking                bounded Retry action

ready
  <-> muted                   output policy only
  -> paused-by-visibility
  -> ready                    visibility resumes with user-safe rules
```

No infinite automatic retries. Audio retry is explicit and bounded.

## 6.4 Gameplay lifecycle

```text
idle
  -> starting
  -> running
  -> paused
  -> running
  -> ended
  -> disposed
```

The renderer may be recreated without changing a running simulation only if the runtime adapter explicitly supports that recovery; V1 may instead end the session with a typed runtime failure.

## 6.5 Persistence ownership

| State | Persisted? | Owner | Storage |
|---|---|---|---|
| Gate progress | No | Gate System | Memory only |
| Gate secret | Bundled config | Gate System | Frontend code; not secure |
| Selected original/custom skins | Yes | Customization System | IndexedDB |
| Processed local image blobs | Yes | Customization System | IndexedDB |
| Mute preference | Yes, optional P1 | Audio System | `localStorage` or settings port |
| Active gameplay session | No | Gameplay System | Memory only |
| High score | Deferred unless explicitly added | Not owned in V1 | None |
| Uploaded source file | No | Browser adapter | Never retained after processing |

## 6.6 Duplicate and concurrency behavior

- Double-clicking Start Game is deduplicated while audio unlock/transition is in progress.
- Repeated code submission is serialized by the app command queue.
- Enter Arena is disabled during runtime creation.
- Image processing operations carry operation IDs; a stale completion cannot replace a newer preview.
- IndexedDB writes are revisioned; a stale write cannot overwrite a newer selection.
- Fire events use simulation cooldown and cannot bypass fire-rate rules through high-frequency pointer events.
- Resize and render callbacks never advance simulation time independently.

---

# 7. Dependency design

## 7.1 Allowed dependency direction

```text
src/ui/**
  -> src/app/index.ts
  -> public system entrypoints only

src/app/**
  -> src/systems/*/index.ts
  -> runtime and storage ports

src/systems/gate/**
  -> TypeScript standard library only

src/systems/gameplay/**
  -> its own contracts/internal modules
  -> injected Clock/Random interfaces declared by the owning system

src/systems/assets/**
  -> its own manifest-loader port

src/systems/audio/**
  -> its own audio-driver port

src/systems/customization/**
  -> image-processor and character-store ports

src/adapters/browser/**
  -> implements system ports
  -> may use DOM, Canvas, IndexedDB, Fetch, localStorage

src/adapters/phaser/**
  -> implements runtime/audio ports
  -> may import Phaser
  -> may read public gameplay/asset/audio contracts
```

## 7.2 Forbidden dependencies

- `src/systems/**` importing `phaser`.
- `src/systems/**` importing DOM screen components.
- Gameplay importing image paths, texture keys from Phaser cache, audio objects, or IndexedDB.
- UI importing a private file under another system rather than that system’s `index.ts`.
- Phaser scenes mutating score, health, enemy eligibility, spawn timers, or game-over state directly.
- Gate System importing App Controller.
- Audio System importing Start Screen.
- Customization System deriving hitbox dimensions from uploaded pixels.
- Browser adapters importing feature screens.
- Any circular system dependency.
- Runtime code loading from `assets/source-original` or `reference` paths.
- Production code importing Unity loader, framework JavaScript, WebAssembly, `.data`, or Unity package files.
- Direct hard-coded asset URLs outside `public/assets/asset-manifest.json` and the manifest adapter.
- Temporary bypass flags such as `skipGate=true` in production code.
- A backend, Supabase SDK, authentication SDK, or upload API in V1.

## 7.3 Boundary enforcement

Use two mechanisms:

1. ESLint/import rules for routine development feedback.
2. A dependency-boundary check in CI that scans imports and rejects the forbidden edges above.

A green application test suite is not sufficient if a forbidden import bypasses system ownership.

---

# 8. Technology decisions

## 8.1 Runtime stack

- **Language:** TypeScript in strict mode.
- **Build/dev server:** Vite.
- **2D renderer/input/audio adapter:** Phaser 4.
- **UI:** semantic HTML + CSS + TypeScript DOM components; no React in V1.
- **Unit/integration tests:** Vitest.
- **End-to-end/browser tests:** Playwright.
- **Deployment:** static Vercel deployment after local verification.
- **Persistence:** IndexedDB through a small project-owned adapter; no external database.
- **Package manager:** npm with a committed lockfile.
- **CI:** GitHub Actions using the exact runtime pinned by the repository.

## 8.2 Why no React

The UI consists of a small state-driven set of screens and one HUD. Adding React would introduce another runtime and state boundary without solving a current product problem. DOM render functions/components remain sufficient. React can be reconsidered only if the product becomes a larger creator platform with account, library, and management surfaces.

## 8.3 Logical playfield

Use a fixed portrait logical arena, proposed at **540 × 960**, scaled with Phaser FIT/CENTER behavior:

- Mobile: fill available viewport while respecting safe areas.
- Desktop: center the portrait arena with neutral side gutters.
- Simulation uses logical world units, not CSS pixels.
- DOM overlays align to the same arena shell.
- Device pixel ratio is capped where necessary to avoid GPU waste.

The parity-capture slice may adjust the logical mapping, but the 9:16 contract should remain.

## 8.4 Simulation timing

- Fixed simulation timestep: proposed 1/60 second.
- Phaser frame delta is accumulated and converted into bounded fixed steps.
- Maximum catch-up steps per frame are capped to prevent a “spiral of death.”
- Paused or hidden pages do not accumulate unlimited simulation debt.
- Render interpolation is adapter-owned.

## 8.5 Collision model

Use pure TypeScript kinematic collision in the Gameplay System rather than Phaser Arcade Physics as the source of truth. This game requires simple projectile/enemy/player overlap tests and benefits from deterministic tests. Phaser may maintain lightweight view objects, but Phaser physics bodies must not decide authoritative results.

## 8.6 Asset loading strategy

Two-stage loading:

1. **Opening bundle:** opening background, Start voice, opening music, essential UI.
2. **Gameplay bundle:** player, enemies, bullet, gameplay background, gameplay music, shoot and reaction voices.

Customization images are loaded only after gate passage. This reduces first-action delay.

## 8.7 Background implementation

Preferred runtime approach:

- use the supplied 2×2 mirror supertile images;
- render them with a Phaser `TileSprite` or equivalent repeated texture;
- map opening to the equivalent of 10×10 original tiles (5×5 mirror supertiles);
- map gameplay to the equivalent of 2×2 original tiles (1×1 mirror supertile);
- compare against the supplied 1080×1920 references;
- retain a fixed-preview fallback only for browsers/renderers where exact repeat sampling differs.

## 8.8 Audio implementation

- The Start Game pointer/touch handler synchronously initiates `unlockFromUserGesture()` before asynchronous navigation work.
- OGG is preferred where supported; MP3 is fallback.
- M4A files remain source/provenance only and are not required in the deployed public directory.
- Opening music loops through gate/customization.
- Enter Arena crossfades to gameplay music.
- Shoot SFX uses a small fixed pool.
- Page hidden/blur behavior pauses or ducks playback according to tested browser behavior.
- A visible sound-recovery control appears for blocked/failed states.

## 8.9 Death/reaction clip fallback decision

Parity capture must determine the original mapping. If it cannot be recovered reliably, the intentional approximation is:

- play exactly one of Jimmy/Zac on terminal player defeat;
- choose with seeded randomness so tests are deterministic;
- do not play both simultaneously;
- document the approximation in the canonical system record.

---

# 9. Proposed repository structure

```text
preston-remake/
├── AGENTS.md
├── README.md
├── .editorconfig
├── .gitignore
├── .nvmrc
├── package.json
├── package-lock.json
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
├── playwright.config.ts
├── eslint.config.js
├── dependency-rules.cjs
├── index.html
│
├── docs/
│   ├── plans/
│   │   └── preston-remake-v1.md
│   ├── system/
│   │   └── preston-remake.md
│   └── evidence/
│       └── preston-remake-v1.md
│
├── assets/
│   ├── source-original/
│   │   ├── images/
│   │   └── audio/
│   ├── reference/
│   │   ├── backgrounds/
│   │   ├── animation/
│   │   └── unity-built-in-ui/
│   └── provenance/
│       ├── extraction-manifest.json
│       ├── excluded-assets.json
│       ├── source-to-runtime-map.json
│       ├── INVENTORY.json
│       └── SHA256SUMS.txt
│
├── public/
│   └── assets/
│       ├── asset-manifest.json
│       ├── images/
│       │   ├── backgrounds/
│       │   │   ├── opening_tile.png
│       │   │   ├── opening_mirror_supertile.png
│       │   │   ├── gameplay_tile.png
│       │   │   └── gameplay_mirror_supertile.png
│       │   ├── characters/
│       │   │   ├── player/default_player.png
│       │   │   └── enemies/
│       │   │       ├── enemy_01.png
│       │   │       ├── enemy_02.png
│       │   │       ├── enemy_03.png
│       │   │       └── enemy_04.png
│       │   ├── gameplay/bullet.png
│       │   └── ui/knob.png
│       └── audio/
│           ├── ogg/
│           │   ├── music/
│           │   ├── sfx/
│           │   └── voice/
│           └── mp3/
│               ├── music/
│               ├── sfx/
│               └── voice/
│
├── scripts/
│   └── verify-assets.mjs
│
├── src/
│   ├── main.ts
│   │
│   ├── app/
│   │   ├── index.ts
│   │   ├── contracts.ts
│   │   ├── AppController.ts
│   │   ├── AppStateStore.ts
│   │   └── createApp.ts
│   │
│   ├── config/
│   │   ├── gateDefinition.ts
│   │   ├── gameplayDefaults.ts
│   │   └── runtimeConfig.ts
│   │
│   ├── systems/
│   │   ├── gate/
│   │   │   ├── index.ts
│   │   │   ├── contracts.ts
│   │   │   └── GateSession.ts
│   │   ├── assets/
│   │   │   ├── index.ts
│   │   │   ├── contracts.ts
│   │   │   ├── ports.ts
│   │   │   └── AssetCatalog.ts
│   │   ├── audio/
│   │   │   ├── index.ts
│   │   │   ├── contracts.ts
│   │   │   ├── ports.ts
│   │   │   └── AudioCoordinator.ts
│   │   ├── customization/
│   │   │   ├── index.ts
│   │   │   ├── contracts.ts
│   │   │   ├── ports.ts
│   │   │   ├── uploadPolicy.ts
│   │   │   └── CharacterCustomizer.ts
│   │   └── gameplay/
│   │       ├── index.ts
│   │       ├── contracts.ts
│   │       ├── ports.ts
│   │       ├── GameSimulation.ts
│   │       ├── GameRules.ts
│   │       └── internal/
│   │           ├── entities.ts
│   │           ├── movement.ts
│   │           ├── collisions.ts
│   │           ├── spawning.ts
│   │           └── difficulty.ts
│   │
│   ├── adapters/
│   │   ├── browser/
│   │   │   ├── FetchAssetManifestLoader.ts
│   │   │   ├── IndexedDbCharacterStore.ts
│   │   │   ├── CanvasImageProcessor.ts
│   │   │   ├── LocalAudioPreferenceStore.ts
│   │   │   └── BrowserLifecycleAdapter.ts
│   │   └── phaser/
│   │       ├── PhaserRuntimeAdapter.ts
│   │       ├── PhaserAudioDriver.ts
│   │       ├── createPhaserConfig.ts
│   │       ├── scenes/
│   │       │   ├── BootScene.ts
│   │       │   └── GameScene.ts
│   │       ├── input/
│   │       │   └── PhaserInputAdapter.ts
│   │       └── views/
│   │           ├── BackgroundView.ts
│   │           ├── PlayerView.ts
│   │           ├── EnemyViews.ts
│   │           ├── BulletViews.ts
│   │           └── EffectsView.ts
│   │
│   ├── ui/
│   │   ├── AppPresenter.ts
│   │   ├── screens/
│   │   │   ├── OpeningScreen.ts
│   │   │   ├── GateScreen.ts
│   │   │   ├── RejectedScreen.ts
│   │   │   ├── CustomizerScreen.ts
│   │   │   ├── PauseScreen.ts
│   │   │   ├── GameOverScreen.ts
│   │   │   └── FatalErrorScreen.ts
│   │   ├── hud/
│   │   │   └── GameHud.ts
│   │   └── styles/
│   │       ├── tokens.css
│   │       ├── shell.css
│   │       ├── screens.css
│   │       └── hud.css
│   │
│   └── shared/
│       ├── Result.ts
│       ├── assertNever.ts
│       └── ids.ts
│
├── tests/
│   ├── systems/
│   │   ├── gate/GateSession.test.ts
│   │   ├── assets/AssetCatalog.test.ts
│   │   ├── audio/AudioCoordinator.test.ts
│   │   ├── customization/CharacterCustomizer.test.ts
│   │   └── gameplay/
│   │       ├── GameSimulation.test.ts
│   │       ├── collisions.test.ts
│   │       ├── spawning.test.ts
│   │       └── difficulty.test.ts
│   ├── adapters/
│   │   ├── IndexedDbCharacterStore.test.ts
│   │   ├── CanvasImageProcessor.test.ts
│   │   └── PhaserRuntimeAdapter.test.ts
│   ├── integration/
│   │   ├── app-flow.test.ts
│   │   ├── start-audio-flow.test.ts
│   │   └── gameplay-runtime-flow.test.ts
│   ├── architecture/
│   │   └── dependency-boundaries.test.ts
│   └── e2e/
│       ├── opening-gate.spec.ts
│       ├── rejected-flow.spec.ts
│       ├── gameplay.spec.ts
│       ├── audio.spec.ts
│       ├── custom-upload.spec.ts
│       └── responsive.spec.ts
│
└── .github/
    └── workflows/
        └── ci.yml
```

### Structure constraints

- No empty placeholder directories.
- No README in every folder.
- No temporary `TODO.md`, scratch plan, or duplicate architecture document.
- `docs/plans/preston-remake-v1.md` owns unfinished work.
- `docs/system/preston-remake.md` describes only implemented and appropriately verified current truth.
- `docs/evidence/preston-remake-v1.md` records commands, environments, results, and unrun gates.
- `dist/`, test reports, caches, coverage, and `node_modules/` remain ignored build outputs.

---

# 10. Exact file actions

The repository does not yet exist, so these actions are all proposed additions unless marked “Generate” or “Preserve.” During implementation, the agent must compare against the actual checkout and revise actions rather than overwriting an existing owner.

| Path | Action | Responsibility | Public/private | Verification |
|---|---|---|---|---|
| `AGENTS.md` | Add | Repository boundaries, commands, file ownership, skill preflight | Public project instruction | Manual review + CI commands match |
| `README.md` | Add | User/developer setup and current verified status | Public | Fresh-clone setup check |
| `.nvmrc` | Add | Pin selected supported Node runtime | Public config | CI uses same file |
| `package.json` | Add | Minimal scripts/dependencies | Public config | `npm run check` |
| `package-lock.json` | Generate | Exact dependency graph | Generated lock | `npm ci` clean install |
| `tsconfig.json` | Add | Strict TypeScript boundary | Public config | `npm run typecheck` |
| `vite.config.ts` | Add | Build/dev configuration and asset behavior | Public config | production build |
| `vitest.config.ts` | Add | Unit/integration test environment | Public config | tests run |
| `playwright.config.ts` | Add | Browser matrix/web server/screenshots | Public config | E2E run |
| `eslint.config.js` | Add | Lint and import restrictions | Public config | lint passes |
| `dependency-rules.cjs` | Add | Explicit allowed/forbidden import graph | Public config | boundary check passes |
| `.gitignore` | Add | Exclude rebuildable/local state | Public config | no generated state staged |
| `.editorconfig` | Add | Stable formatting baseline | Public config | diff review |
| `index.html` | Add | Single application mount shell | Public | build/E2E boot |
| `docs/plans/preston-remake-v1.md` | Add | Active implementation plan and slice status | Active task doc | updated per accepted slice |
| `docs/system/preston-remake.md` | Add after first verified slice | Canonical implemented system truth | Canonical doc | source/test mapping review |
| `docs/evidence/preston-remake-v1.md` | Add | Exact verification evidence and limitations | Evidence log | command/result audit |
| `assets/source-original/**` | Add from v4 pack | Byte-preserved extracted originals | Non-shipping source | checksum identity |
| `assets/reference/**` | Add from v4 pack | Background previews/config and Unity reference | Non-shipping reference | excluded from `dist` |
| `assets/provenance/**` | Add from v4 pack | Extraction, exclusions, mapping, checksums | Non-shipping evidence | checksum check |
| `public/assets/asset-manifest.json` | Add from v4 runtime | Stable shipping asset contract | Public runtime | schema + existence test |
| `public/assets/images/**` | Add from v4 runtime | Shipping images only | Public runtime | decode/dimensions/load tests |
| `public/assets/audio/**` | Add from v4 runtime | Shipping OGG/MP3 only | Public runtime | decode + headed playback |
| `scripts/verify-assets.mjs` | Add | Validate manifest paths, types, dimensions, no forbidden fonts | Private tooling | CI execution |
| `src/main.ts` | Add | Composition root only | Public app entry | boot integration test |
| `src/app/index.ts` | Add | Supported App API exports | Public | import boundary test |
| `src/app/contracts.ts` | Add | App commands/state/failures | Public | exhaustive type tests |
| `src/app/AppController.ts` | Add | Application transition orchestration | Private behind index | flow integration tests |
| `src/app/AppStateStore.ts` | Add | State publication/subscription | Private | transition/subscription tests |
| `src/app/createApp.ts` | Add | Construct systems/adapters once | Private composition | boot test |
| `src/config/gateDefinition.ts` | Add | Q1/Q2/`basic` product configuration | Public config | gate contract tests |
| `src/config/gameplayDefaults.ts` | Add | All measured/approved game tuning | Public config | config schema/parity tests |
| `src/config/runtimeConfig.ts` | Add | Arena, scaling, performance caps | Public config | resize/runtime tests |
| `src/systems/gate/index.ts` | Add | Gate public entrypoint | Public | external import test |
| `src/systems/gate/contracts.ts` | Add | Gate typed inputs/outputs | Public through index | contract tests |
| `src/systems/gate/GateSession.ts` | Add | Gate transitions and invariants | Private | full transition matrix |
| `src/systems/assets/index.ts` | Add | Asset Catalog public entrypoint | Public | external import test |
| `src/systems/assets/contracts.ts` | Add | Asset keys/manifest/failures | Public through index | schema tests |
| `src/systems/assets/ports.ts` | Add | Manifest loading port | Public to adapters | fake-port tests |
| `src/systems/assets/AssetCatalog.ts` | Add | Validation and readiness state | Private | required/missing/malformed tests |
| `src/systems/audio/index.ts` | Add | Audio public entrypoint | Public | external import test |
| `src/systems/audio/contracts.ts` | Add | Commands/results/snapshot | Public through index | contract tests |
| `src/systems/audio/ports.ts` | Add | Technology-neutral driver/settings ports | Public to adapters | fake-driver tests |
| `src/systems/audio/AudioCoordinator.ts` | Add | Unlock/music/mute/recovery policy | Private | lifecycle tests |
| `src/systems/customization/index.ts` | Add | Customization public entrypoint | Public | external import test |
| `src/systems/customization/contracts.ts` | Add | Skin/upload/selection results | Public through index | contract tests |
| `src/systems/customization/ports.ts` | Add | Image processor/store ports | Public to adapters | fake-port tests |
| `src/systems/customization/uploadPolicy.ts` | Add | MIME/size/dimension/count policy | Private | boundary cases |
| `src/systems/customization/CharacterCustomizer.ts` | Add | Selection/persistence lifecycle | Private | save/load/stale/fallback tests |
| `src/systems/gameplay/index.ts` | Add | Gameplay public entrypoint | Public | external import test |
| `src/systems/gameplay/contracts.ts` | Add | Config/input/snapshot/events/result | Public through index | serialization/type tests |
| `src/systems/gameplay/ports.ts` | Add | Clock/random interfaces | Public to fakes/adapters | deterministic tests |
| `src/systems/gameplay/GameSimulation.ts` | Add | Authoritative fixed-step session | Private | session tests |
| `src/systems/gameplay/GameRules.ts` | Add | Validate and apply tuning config | Private | config/invariant tests |
| `src/systems/gameplay/internal/*.ts` | Add | Entity, motion, collision, spawning, difficulty internals | Private | focused behavior tests |
| `src/adapters/browser/FetchAssetManifestLoader.ts` | Add | Fetch/JSON adapter | Private adapter | mocked HTTP tests |
| `src/adapters/browser/IndexedDbCharacterStore.ts` | Add | Durable local storage adapter | Private adapter | real browser adapter tests |
| `src/adapters/browser/CanvasImageProcessor.ts` | Add | Decode/crop/re-encode adapter | Private adapter | fixture image tests |
| `src/adapters/browser/LocalAudioPreferenceStore.ts` | Add | Mute preference adapter | Private adapter | storage tests |
| `src/adapters/browser/BrowserLifecycleAdapter.ts` | Add | Visibility/resize lifecycle events | Private adapter | DOM integration tests |
| `src/adapters/phaser/PhaserRuntimeAdapter.ts` | Add | Runtime port implementation | Private adapter | mount/dispose/runtime tests |
| `src/adapters/phaser/PhaserAudioDriver.ts` | Add | Audio driver implementation | Private adapter | fake catalog + headed test |
| `src/adapters/phaser/createPhaserConfig.ts` | Add | Phaser-only configuration | Private adapter | config test |
| `src/adapters/phaser/scenes/*.ts` | Add | Thin boot/game scenes | Private adapter | runtime smoke tests |
| `src/adapters/phaser/input/PhaserInputAdapter.ts` | Add | Physical-to-semantic action mapping | Private adapter | pointer/keyboard/touch tests |
| `src/adapters/phaser/views/*.ts` | Add | Disposable rendering and FX views | Private adapter | screenshot/runtime tests |
| `src/ui/AppPresenter.ts` | Add | Render AppState into one active DOM screen | Private presentation | app-flow tests |
| `src/ui/screens/*.ts` | Add | Screen-specific DOM rendering only | Private presentation | accessibility + E2E |
| `src/ui/hud/GameHud.ts` | Add | HUD render/update only | Private presentation | HUD integration test |
| `src/ui/styles/*.css` | Add | Theme, shell, screens, HUD | Public styling | screenshot/responsive review |
| `src/shared/*.ts` | Add only as used | Minimal cross-cutting primitives | Internal | no unused exports |
| `tests/systems/**` | Add | Public behavior and state evidence | Test | Vitest |
| `tests/adapters/**` | Add | Adapter contract evidence | Test | Vitest/browser environment |
| `tests/integration/**` | Add | Caller-to-system-to-adapter flows | Test | Vitest |
| `tests/architecture/**` | Add | Dependency restrictions | Test | CI boundary gate |
| `tests/e2e/**` | Add | Real browser journey evidence | Test | Playwright |
| `.github/workflows/ci.yml` | Add | Reproducible clean verification | CI | successful workflow |
| Unity build files | Preserve outside new repo | Reference only; never copy into shipping app | External | forbidden-file scan |
| Original asset pack v4 | Preserve | Handoff/provenance source | External | ZIP + checksum validation |

No material file is deleted or retired merely because a cleaner structure exists. Unity runtime exclusion is a new-project shipping rule, not deletion of the user’s supplied source archive.

---

# 11. Implementation slices

Every slice follows:

```text
Red      -> write failing public behavior tests
Green    -> implement the smallest complete behavior
Refine   -> improve internals without widening scope
Verify   -> run focused and required wider checks
Document -> record only verified current behavior
```

A slice is not complete because files exist. It is complete only after its acceptance gate passes.

## Slice 0 — Original behavior parity capture

### Goal

Turn the compiled build into an explicit parity specification before tuning the remake.

### Behavior/work

- Boot the original build in a headed browser.
- Record the opening screen, Start button, audio timing, gate-free original transition, gameplay, damage, score, game over, and restart.
- Capture input behavior with mouse, keyboard, and touch if supported.
- Measure or estimate, with confidence labels:
  - arena mapping;
  - player speed/path behavior;
  - fire rate;
  - bullet speed/lifetime;
  - enemy spawn cadence and active count;
  - enemy size/rotation/movement differences;
  - health/damage/score changes;
  - audio events and volumes;
  - game-over timing.
- Record screenshots/video and a parity table.
- Label each fact `verified`, `measured`, `inferred`, or `unknown`.

### Files

- Add/update `docs/plans/preston-remake-v1.md` parity appendix.
- Store approved reference captures under `assets/reference/original-runtime/` only if the user authorizes inclusion and the captures are useful.
- Do not create application code.

### Tests

None; this is evidence collection.

### Acceptance gate

- Every P0 mechanic has either a recorded original value/behavior or an explicit “unknown + fallback decision.”
- No unknown is silently converted into “original parity.”

### Documentation effect

Active plan only. Canonical system documentation does not yet describe a new implementation.

## Slice 1 — Repository foundation and asset boundary

### Goal

Create the minimal strict TypeScript project, import the sanitized v4 asset package, and establish the manifest boundary before UI or gameplay.

### Behavior

- Initialize Vite/TypeScript without React.
- Add strict scripts and CI configuration.
- Copy source/reference/provenance assets outside `public`.
- Copy only runtime assets into `public/assets`.
- Add runtime mirror supertiles to the manifest.
- Validate every required key and file.
- Reject font binaries, Unity runtime files, and direct source paths from production assets.
- Establish import-boundary rules.

### Tests

- Manifest schema valid.
- Every required asset path exists.
- All runtime images decode and have expected dimensions.
- All runtime audio files decode or are browser-loadable.
- No `.ttf`, `.otf`, `.woff`, `.woff2`, `.wasm`, Unity `.data`, or Unity loader/framework file exists under `public` or `src`.
- Source checksums match the v4 handoff.
- `npm ci`, typecheck, lint, unit test, and production build pass.

### Acceptance gate

A clean clone can install and build a blank shell that validates the complete runtime asset manifest without loading Unity code.

### Documentation effect

- Mark Slice 1 verified in the active plan.
- Create the canonical system document with only the verified foundation/asset boundary.
- Record exact commands and results in the evidence log.

## Slice 2 — Opening, Start interaction, Gate System, and audio lifecycle

### Goal

Deliver the complete pre-game flow with real browser-safe audio behavior.

### Behavior

- Render the opening background with correct mirror tiling.
- Show Start Game as the first primary action.
- On the same trusted gesture:
  - begin audio unlock;
  - play/resume opening music;
  - play the Leon Start voice;
  - deduplicate double activation.
- Implement Gate System transitions exactly.
- Implement Access Denied on Question 2 = No.
- Implement code input and exact `basic` contract.
- Show visible Enable Sound/Retry recovery for blocked or failed audio without blocking gate progression.
- Keep opening music through gate and customization.
- Add reduced-motion alternatives for screen transitions.

### Tests

- Complete gate transition matrix.
- Invalid commands are no-ops with typed results.
- ` basic ` passes after trim.
- `Basic`, `BASIC`, blank, and other values fail.
- No path reaches customization after Question 2 = No.
- Double Start does not duplicate state transition or create duplicate music sessions.
- Audio coordinator locked/ready/blocked/failed/muted/retry tests.
- E2E opening -> gate -> pass.
- E2E opening -> Question 2 No -> rejected.
- Headed Chrome Start gesture audibly starts the decoded clip, verified through audio state plus manual/automated browser evidence.

### Acceptance gate

A real browser user can press Start, hear or recover audio, pass or fail the gate exactly, and reach a placeholder customization screen. No Phaser game is required yet.

### Documentation effect

Update canonical current behavior only after browser verification. Do not claim Safari/mobile audio parity from Chrome evidence.

## Slice 3 — Framework-independent gameplay simulation

### Goal

Implement the complete combat loop as deterministic TypeScript without Phaser dependencies.

### Behavior

- Define approved `GameplayConfig` using measured original values or labeled approximations.
- Implement player state and arena bounds.
- Implement aim/fire intent and cooldown.
- Implement bullets.
- Implement four enemy archetypes or appearance variants with approved motion/size/rotation behavior.
- Implement spawn scheduling and difficulty progression.
- Implement collisions, damage, health, invulnerability if confirmed, score, enemy destruction, and game end.
- Emit semantic events such as:
  - `shot-fired`;
  - `enemy-spawned`;
  - `enemy-hit`;
  - `enemy-destroyed`;
  - `player-damaged`;
  - `difficulty-changed`;
  - `session-ended`.
- Use seeded randomness and fixed time.

### Tests

- Same seed/input sequence yields identical snapshots/events.
- Fire cooldown cannot be bypassed.
- Bullet expires correctly.
- Each enemy movement rule is bounded and deterministic.
- Collision is independent of sprite dimensions.
- Damage cannot apply after session end.
- Score increments exactly once per qualifying destruction.
- Difficulty changes only at configured thresholds.
- Pause freezes simulation.
- Game over occurs exactly once.
- Stress test advances the approved parity-load profile without unbounded entity growth.
- Architecture test proves no Phaser/DOM/browser import under Gameplay System.

### Acceptance gate

A headless test can simulate a complete session from start to game over and reproduce the same result from seed + input log.

### Documentation effect

Add implemented gameplay authority and explicit approximations to the canonical system document. Do not claim visual parity.

## Slice 4 — Phaser runtime adapter and original visual parity

### Goal

Render the authoritative simulation using the original assets while keeping Phaser scenes thin.

### Behavior

- Build Phaser runtime only after App Controller enters `loading-game`.
- Load assets from Asset Catalog keys.
- Render player, bullets, enemies, original gameplay background, and FX.
- Map physical input to `GameInputFrame`.
- Advance the pure simulation using bounded fixed steps.
- Render interpolation without mutating simulation state.
- Use renderer pools for bullets/enemies/effects.
- Implement original background mirror tiling.
- Add particle/trail/hit/death effects as non-authoritative views.
- Connect gameplay events to Audio System commands.
- Dispose Phaser cleanly when leaving gameplay.

### Tests

- Runtime mounts once and disposes without leaked canvas/listeners.
- Asset keys map to correct textures/audio.
- Input adapter emits normalized actions.
- View destruction does not change score/health.
- Resize preserves logical arena and DOM alignment.
- Screenshot comparison for opening/game background reconstruction.
- E2E can start a session, fire, destroy an enemy, take damage, and reach game over.
- No fatal console errors.

### Acceptance gate

The original-asset game is visibly playable in a headed desktop browser and all authoritative outcomes come from the Gameplay System.

### Documentation effect

Record Phaser as an adapter and list visual evidence separately from simulation evidence.

## Slice 5 — HUD, pause, game over, retry, and responsive controls

### Goal

Complete the repeatable game loop and supported input surfaces.

### Behavior

- DOM HUD shows health and score without covering the center/lower-middle playfield.
- Add pause/resume and mute controls.
- Page visibility pauses safely.
- Game Over shows score, defeated count, survival time.
- Retry creates a fresh session with same appearance.
- Change Characters returns to customization.
- Main Menu disposes runtime/audio roles and returns opening.
- Add touch movement/aim/fire controls according to the approved mobile scheme.
- Respect safe-area insets and reduced motion.

### Tests

- HUD reflects snapshots and cannot mutate them.
- Retry uses a new session ID and reset state.
- Change Characters disposes runtime exactly once.
- Hidden page does not continue damage/spawning.
- Keyboard and pointer focus do not fire while modal controls are active.
- Mobile viewport/safe-area E2E.
- Desktop and mobile screenshots keep critical playfield visible.

### Acceptance gate

A player can complete and repeat the full original-plus-gate loop on supported desktop browsers, with a mobile control path that passes the defined device/browser checks.

### Documentation effect

Mark Milestone A only after all P0 gates pass. “Code complete” and “hosted verified” remain separate statuses.

## Slice 6 — Local character customization

### Goal

Add appearance customization without changing mechanics or introducing a backend.

### Behavior

- Original player/enemy presets remain available.
- Accept one player upload and up to eight enemy uploads.
- Validate MIME, size, decode dimensions, and count.
- Show a pan/zoom crop/fit preview.
- Normalize to 512×512 through Canvas and remove metadata.
- Store processed blob + metadata in IndexedDB.
- Use object URLs with correct revocation.
- Fall back to session-only memory when persistence fails.
- Allow delete/replace/clear.
- Resolve selected skin references to Phaser textures at game load.
- Keep fixed collision bodies and gameplay config.

### Tests

- Valid PNG/JPEG/WebP success.
- Spoofed extension with invalid decoded content fails.
- SVG/GIF/HEIC/oversize/undersize/over-dimension files fail.
- Stale crop completion cannot replace latest image.
- Save/load/revision/delete/clear behavior.
- IndexedDB unavailable fallback.
- Custom image changes texture only, not snapshot hitbox or rules.
- E2E upload player + multiple enemies -> play -> reload -> selection restored.
- Object URLs are revoked on replacement/disposal.

### Acceptance gate

A player can customize locally, reload, and play with stable mechanics; no image or metadata leaves the device.

### Documentation effect

Mark Milestone B only after real browser IndexedDB and upload tests pass. Do not claim server privacy or moderation because no server exists.

## Slice 7 — Release hardening, hosted verification, and evidence synchronization

### Goal

Prove the release in widening environments and package only approved runtime files.

### Behavior/work

- Run all static, unit, integration, architecture, build, E2E, visual, audio, responsive, and performance checks.
- Inspect production `dist` contents.
- Confirm no Unity runtime, source-original, reference, font binary, or test artifact ships.
- Deploy preview to Vercel.
- Run hosted smoke tests.
- Run actual audio/interaction checks in supported browsers and real mobile devices where available.
- Review likeness/music/voice permissions before public exposure.
- Synchronize current system document and evidence log.

### Acceptance gate

All Definition of Done items are either passed with evidence or explicitly marked as a release blocker. There is no “mostly done” production claim.

### Documentation effect

Finalize evidence log and canonical current-state mapping. Keep future V2 behavior labeled deferred.

---

# 12. Verification strategy and evidence ladder

## 12.1 Standard commands

The final script names should support:

```bash
npm ci
npm run verify:assets
npm run typecheck
npm run lint
npm run check:boundaries
npm run test
npm run build
npm run test:e2e
npm run check
```

`npm run check` should run the non-interactive local quality gates in a stable order. Headed/manual audio and device verification remains separate and cannot be replaced by a unit test.

## 12.2 Evidence levels

| Level | Required evidence | What it proves | What it does not prove |
|---|---|---|---|
| Static | Typecheck, lint, boundary check, manifest validation | Source/type/import consistency | Runtime behavior or audible sound |
| Unit | Gate, gameplay, audio policy, customization tests | Rules and deterministic state transitions | Real Phaser/browser behavior |
| Adapter | Canvas, IndexedDB, manifest loader, Phaser adapter tests | Technology translation in controlled environment | Full user journey on devices |
| Integration | App Controller through fakes/real adapters | Cross-system wiring | Hosted/network/device quirks |
| Build | Vite production build + `dist` audit | Packaging succeeds and forbidden files excluded | Gameplay quality or browser compatibility |
| Headed browser | Playwright/manual interaction and screenshots | Real DOM/canvas/input/console behavior | Every device/browser |
| Device/browser | Safari/Chrome/Firefox and mobile checks | Supported matrix behavior | Production CDN/deployment state |
| Hosted preview | Vercel preview smoke | Deployed routing/assets/caching | Production domain or public rights approval |
| Production | Explicit release + smoke + monitoring | Actual released version behavior | Future regressions |

## 12.3 Required unit test matrix

### Gate

- every valid transition;
- every invalid action at every step;
- exact code normalization/case behavior;
- rejection permanence within session;
- reset.

### Gameplay

- start/reset/end lifecycle;
- fixed-step determinism;
- player bounds;
- fire cooldown;
- bullet lifetime/damage;
- enemy spawn/motion/rotation/size rules;
- collision fairness;
- score and health;
- difficulty progression;
- pause;
- game-over idempotency;
- entity cleanup/stress.

### Audio

- locked/unlocking/ready/blocked/failed;
- mute;
- crossfade sequencing;
- shoot overlap cap;
- visibility pause/resume;
- bounded retry;
- stop/dispose.

### Customization

- file policy;
- decode failures;
- crop output;
- persistence;
- revisions/stale operations;
- delete/clear;
- session fallback;
- no gameplay-value mutation.

## 12.4 Required E2E journeys

1. Start -> Q1 Yes -> Q2 Yes -> wrong code -> correct `basic` -> customization.
2. Start -> Q1 Yes -> Q2 No -> rejected -> no game canvas.
3. Original assets -> Enter Arena -> shoot -> score -> damage -> game over -> retry.
4. Game over -> Change Characters -> return without leaked canvas/audio.
5. Upload player and two enemies -> play -> reload -> restored selection.
6. Audio blocked simulation -> visible recovery -> ready.
7. Resize desktop portrait -> mobile portrait -> no critical overlap.
8. Page hidden while playing -> simulation/audio pause -> safe resume.
9. Production build served from preview -> asset paths resolve.

## 12.5 Visual parity review

Compare representative screenshots for:

- opening mirror tile density and orientation;
- gameplay 2×2 mirrored background;
- original player and enemy scale/silhouette;
- bullet orientation;
- Start button state/feedback;
- center playfield clarity;
- HUD overlap;
- Game Over readability;
- custom photo containment/cropping.

Visual review should distinguish:

- recovered parity;
- intentional improvement;
- unavoidable approximation;
- bug.

## 12.6 Performance gates

Do not invent a performance claim from a desktop developer machine. Establish and record:

- approved parity-load profile from Slice 0;
- active gameplay entity caps;
- renderer-pool caps;
- frame-time trace on reference desktop;
- frame-time trace on at least one real mobile device if mobile is a supported release target;
- texture memory and audio load behavior;
- no unbounded DOM nodes, Phaser objects, listeners, object URLs, or IndexedDB writes after repeated Retry cycles.

Target behavior:

- smooth 60 Hz presentation on supported desktop hardware under the parity-load profile;
- no game-breaking drop below the agreed mobile floor;
- deterministic simulation remains correct even when rendering drops frames.

Exact numerical performance budgets should be set after the parity/load capture and reference-device selection.

---

# 13. Documentation and evidence policy

## 13.1 Active plan

`docs/plans/preston-remake-v1.md` contains:

- goal;
- accepted scope;
- current slice;
- exact owned paths;
- planned actions;
- verification gates;
- unresolved decisions;
- status labels.

It does not become permanent architecture truth.

## 13.2 Canonical system document

`docs/system/preston-remake.md` contains only current implemented behavior:

- purpose;
- owns/does not own;
- public contracts;
- state authority;
- dependencies;
- entrypoints;
- lifecycle/recovery;
- implementation mapping;
- verification evidence;
- known gaps and intentional approximations.

Future features remain clearly marked and never appear as implemented current truth.

## 13.3 Completion evidence

`docs/evidence/preston-remake-v1.md` records per slice:

- date and branch/commit;
- files changed;
- exact commands;
- pass/fail counts;
- browser/device/hosted environment;
- screenshots or traces;
- environmental limitations;
- unrun gates;
- remaining blockers.

## 13.4 Asset evidence

Keep distinct:

- extracted source originals;
- runtime shipping copies;
- generated browser audio variants;
- reference previews;
- checksums/provenance;
- permission/licensing status.

A successful build proves technical packaging, not legal permission to distribute a person’s photo, voice, or music.

---

# 14. Branch, worktree, and multi-agent plan

## 14.1 Rules

- The main/root worktree is integration-only.
- One coding agent owns one branch and one worktree at a time.
- Every slice declares exact owned paths before editing.
- Shared files such as `package.json`, lockfile, App Controller, and canonical docs have one owner per slice.
- Agents never reset, clean, checkout, or overwrite unrelated changes.
- Generated/local state is never committed: `node_modules`, `dist`, coverage, Playwright reports, test results, caches, local IndexedDB artifacts, OS metadata.
- Broad formatters are not run across files outside the slice.
- Dependent slices integrate in order; do not parallelize merely to create activity.
- Before integration: update from main, resolve only owned conflicts, rerun the full slice gate, inspect scoped diff, then merge through review.

## 14.2 Recommended branch sequence

```text
codex/preston-s00-parity-capture
  -> codex/preston-s01-foundation-assets
  -> codex/preston-s02-opening-gate-audio
  -> codex/preston-s03-gameplay-core
  -> codex/preston-s04-phaser-runtime
  -> codex/preston-s05-loop-responsive
  -> codex/preston-s06-customization
  -> codex/preston-s07-release-hardening
```

Each branch should start from the latest reviewed/integrated main unless a deliberately stacked branch is documented.

## 14.3 Safe parallel work after Slice 1

Limited parallelism is possible only with explicit ownership:

| Agent | May own | Must not edit |
|---|---|---|
| Gate/audio agent | `src/systems/gate`, `src/systems/audio`, related UI/tests | Gameplay internals, Phaser gameplay views |
| Gameplay agent | `src/systems/gameplay`, gameplay tests | DOM screens, audio adapter, App Controller |
| Runtime agent | `src/adapters/phaser`, runtime tests | Gameplay rules/contracts without coordination |
| Customization agent | `src/systems/customization`, browser image/store adapters, customizer UI/tests | Gameplay config/hitboxes |
| Integration owner | `src/app`, `src/main.ts`, shared config, package/lockfile, canonical docs | Unreviewed subsystem internals |

If two tasks need the same public contract or composition file, they are not independent and should be sequenced or coordinated through a dedicated contract change first.

## 14.4 Integration checklist

Before merging a slice:

1. Confirm branch base and current main.
2. Confirm no unrelated dirty paths are staged.
3. Inspect `git diff --stat` and full scoped diff.
4. Run focused tests.
5. Run required wider checks.
6. Rebase or update against current main according to repository policy.
7. Rerun checks after conflict resolution.
8. Merge without force-pushing shared history.
9. Confirm main contains only intended files.
10. Update evidence with actual, not planned, results.

---

# 15. Product and technical guardrails

## 15.1 Scope guardrails

- Do not add a backend “because uploads may be useful later.”
- Do not add accounts, auth, analytics, database schema, or cloud storage in V1.
- Do not implement mid-game character switching until characters have meaningful abilities and a separate approved design.
- Do not redesign the game into a large progression system.
- Do not create a generic game engine or plugin framework.
- Do not introduce React, Redux, ECS libraries, dependency injection frameworks, or physics engines without a demonstrated need.
- Do not rewrite original media.
- Do not replace the original audio or backgrounds during parity work.

## 15.2 Architecture guardrails

- Public contracts before callers.
- Pure rules before Phaser integration.
- Vendor APIs remain in adapters.
- Stable asset keys, never scattered paths.
- One authoritative owner for each state.
- Renderer objects are disposable views.
- DOM owns text-heavy screens/HUD.
- No hidden global mutable game state.
- No scene-to-scene mutable bags.
- No magic gameplay numbers outside validated config.
- No system imports another system’s private files.

## 15.3 Privacy/security guardrails

- State clearly that `basic` is not secure authentication.
- Uploaded images remain local in V1.
- Re-encode images and discard source metadata.
- Reject SVG and unsupported formats.
- Bound file size, dimensions, count, processing concurrency, and storage use.
- Provide clear-local-data control.
- Revoke object URLs.
- Do not log image blobs, local paths, or personal filenames.
- Before any V2 cloud upload, define consent, retention, deletion, moderation, abuse reporting, and authorization as a separate approved system.

## 15.4 Rights guardrails

Before public deployment, verify permission for:

- every depicted person;
- every voice recording;
- both music tracks;
- shooting SFX;
- future user-uploaded likenesses;
- any reference/template asset accidentally included in production.

The build must ship only `public/assets` runtime files. `source-original`, Unity built-in reference, and extraction material do not ship by default.

## 15.5 Failure and recovery guardrails

- Asset failure: show typed fatal/retry state; never start with missing required gameplay assets.
- Audio failure: visible recovery, but game remains playable muted.
- IndexedDB failure: session-only fallback with warning.
- Image decode failure: reject only that upload; preserve prior valid selection.
- Phaser context/runtime failure: dispose safely and return a recoverable game-load error where possible.
- Stale async completion: ignored through operation/revision IDs.
- Retry: creates new simulation/runtime state; does not reuse ended entity objects.

---

# 16. Risks and mitigations

| Risk | Impact | Mitigation | Evidence gate |
|---|---|---|---|
| Compiled build hides exact constants | False parity claims | Slice 0 confidence-labelled capture; central config; intentional fallback labels | parity table reviewed |
| Browser autoplay blocks sound | Start feels broken | synchronous gesture unlock, visible recovery, headed browser tests | Chrome/Safari evidence separately |
| Phaser scene accumulates business rules | Untestable coupling | pure Gameplay System + boundary test | no Phaser imports in system |
| Custom images change fairness | Broken balance | fixed hitboxes and config independent of pixels | invariant test |
| Large/hostile image crashes tab | Reliability/security issue | MIME/decode/size/dimension/concurrency caps and re-encode | upload boundary tests |
| IndexedDB unavailable/full | Lost customization | typed warning + session fallback | real browser failure test |
| Background rendered incorrectly | Remake no longer recognizable | mirror supertiles/config/reference screenshot review | visual parity gate |
| Rapid SFX creates resource leak | Audio distortion/performance issue | bounded pool and cooldown-aligned event handling | stress test |
| Retry leaks canvases/listeners/object URLs | Degrades every session | explicit disposal ownership + repeated-cycle test | leak inspection |
| Over-engineering a small game | Slow delivery | only six meaningful systems; no speculative backend/plugin architecture | file/scope review |
| Asset package mistaken for licensing approval | Legal/privacy exposure | rights notice and separate distribution approval gate | release checklist |
| Plan presented as implemented | Misleading status | planned/implemented/verified/deferred labels | evidence audit |
| Local success overstated as hosted/device proof | Release failure | evidence ladder and per-environment reporting | hosted/device gates |
| Multi-agent shared-file conflict | Lost or mixed work | single owner, isolated worktrees, sequential contracts | diff/integration checklist |

---

# 17. Definition of Done

## 17.1 Milestone A — original-plus-gate playable

Milestone A is complete only when:

- Start Game remains present and is the first primary action.
- Start gesture correctly attempts audio unlock and triggers the recovered Start voice.
- Opening and gameplay music roles work with mute/recovery.
- Gate Question 1, Question 2, rejection, and exact `basic` code behavior pass unit and E2E tests.
- The original player, enemies, bullet, and backgrounds render from stable asset keys.
- Opening and gameplay mirror tiling match approved references.
- Authoritative pure gameplay includes input, shooting, bullets, enemy spawn/motion/variation, collision, health, score, difficulty, game over, and retry.
- Phaser remains an adapter and passes dependency checks.
- Desktop headed-browser complete-loop test passes.
- Production build contains no Unity runtime or forbidden source/reference/font files.
- Canonical documentation reflects only verified behavior.

## 17.2 Milestone B — full local-customization V1

Milestone B is complete only when Milestone A is complete and:

- one player and up to eight enemy uploads work for PNG/JPEG/WebP;
- normalization, crop/fit, metadata stripping, and size/dimension policy pass;
- custom images affect appearance only;
- IndexedDB persistence and session fallback pass;
- replacement/delete/clear and URL disposal pass;
- custom selection survives reload where storage is available;
- supported mobile interaction and responsive layout pass defined device/browser gates;
- privacy copy correctly states that files remain local;
- public distribution permissions have been separately reviewed.

## 17.3 Release evidence requirements

The final handoff must report:

- branch and commit;
- implemented milestone/slices;
- public inputs and outputs;
- ownership decisions;
- exact changed files/grouped paths;
- static/test/build results;
- headed-browser results;
- device results;
- hosted results;
- unrun checks;
- known approximations/gaps;
- deployment status;
- production mutation status;
- preservation of unrelated changes.

No release may be called “production-ready” based solely on code review, unit tests, or local build success.

---

# 18. Status vocabulary

Use only these labels:

- **Proposed:** decision exists in an approved plan but no implementation evidence.
- **Implemented:** code exists but required verification may remain.
- **Verified locally:** required local static/test/build/browser gates passed.
- **Verified on device:** named real-device/browser gate passed.
- **Verified hosted:** named deployed-preview gate passed.
- **Production verified:** explicit released environment passed smoke/monitoring.
- **Deferred:** intentionally outside the accepted scope.
- **Unknown:** insufficient evidence; no guess may replace it.
- **Blocked:** required evidence or dependency is unavailable.

Current truthful status at the time of this document:

| Area | Status |
|---|---|
| Sanitized recoverable asset package | Verified locally |
| Product flow and architecture | Proposed |
| Original parity constants | Unknown pending Slice 0 |
| Browser application code | Not implemented |
| Vercel deployment | Not performed |
| Device/browser support | Not verified |
| Online sharing/backend | Deferred |
| Mid-game character switching | Deferred |

---

# 19. Initial coding-agent execution order

The coding agent should start with **Slice 0**, not scaffold the entire tree immediately.

```text
1. Read actual system-design-protocol and PO skills.
2. Inspect repository/worktree and asset handoff.
3. Create/update the active plan with the accepted Slice 0 scope.
4. Capture original runtime behavior and unknowns.
5. Review the parity/fallback table.
6. Only then execute Slice 1 foundation and assets.
7. Build each later vertical slice through its acceptance gate.
8. Do not pre-create files for later slices.
9. Do not add backend, auth, sharing, or character switching.
10. Report proven evidence and unrun gates at every handoff.
```

## Paste-ready implementation instruction

```text
Build the Preston vs Particles browser remake according to
Preston_Remake_Detailed_Code_Plan.md.

Mandatory method:
- read the actual system-design-protocol and PO skills first;
- inspect repository instructions and current worktree before editing;
- work only on the next accepted vertical slice;
- define/confirm typed public contracts before callers;
- keep gameplay rules and state independent from Phaser;
- keep Phaser/browser/IndexedDB/Canvas behind adapters;
- use stable asset-manifest keys;
- preserve source assets and provenance, but ship only public/assets runtime copies;
- do not add React, backend, Supabase, authentication, online uploads, leaderboards,
  mid-game switching, character abilities, or unrelated cleanup;
- never claim an original behavior when it is only inferred or approximated;
- do not create temporary TODO/scratch/duplicate architecture files;
- preserve unrelated worktree changes;
- run the slice’s focused and wider verification gates;
- update canonical documentation only with implemented and appropriately verified truth;
- report exact files, checks, results, unrun environments, and known gaps.

Start with Slice 0 parity capture. Do not implement later slices until its
parity/fallback table is reviewed.
```

---

# 20. Final architectural outcome

```text
Start Game DOM action
  -> App Controller
  -> Audio System unlock/start voice/opening music
  -> Gate System
  -> Character Customization System
  -> App Controller authorizes arena entry
  -> Gameplay System starts deterministic session
  -> Phaser Runtime Adapter renders snapshot and collects input
  -> Gameplay events drive Audio System and HUD
  -> Gameplay System ends session
  -> App Controller shows Game Over and owns retry/navigation

Asset Catalog
  -> stable keys for every original/runtime asset

Browser adapters
  -> Fetch / Canvas / IndexedDB / lifecycle

Phaser adapter
  -> canvas / input / audio driver / visual FX

No Unity runtime
No backend in V1
No gameplay rules inside Phaser scenes
No uploaded-image influence on balance
```

This is the smallest architecture that keeps the game complete, testable, customizable, and ready for a later social creator version without prematurely building that future version now.
