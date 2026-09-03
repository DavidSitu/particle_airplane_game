# Preston vs Particles V1 — Completed Build Plan

> Superseded in part on 2026-09-03: the cursor-aimed arena gameplay, tuning, HUD, and related verification claims in this historical plan are replaced by [`preston-plane-shooter-parity-correction.md`](preston-plane-shooter-parity-correction.md). Gate, assets, audio, customization, persistence, build, and deployment boundaries remain applicable.

Date: 2026-09-03  
Mode: Build / Goal Mode — complete locally  
Primary product plan: [`../../Preston_Remake_Detailed_Code_Plan.md`](../../Preston_Remake_Detailed_Code_Plan.md)

This is the compact execution ledger required by the installed System Design Protocol and Project Orchestrator. It records accepted boundaries, file ownership, slice gates, and evidence state without duplicating the primary product plan.

## Requested Outcome

Build and verify a Unity-free, browser-native Preston vs Particles remake with the original recovered visual/audio assets, the David gate, deterministic gameplay, local custom-character persistence, responsive controls, a complete retry/navigation loop, and a static Vercel-compatible production bundle.

## Evidence Baseline

### Verified

- The initial worktree was clean on `main` at `524c7b0`; only the supplied plan and v4 asset pack existed.
- The root plan and the plan copy inside the pack are byte-identical (`eeb86d68...dc08d2`).
- All 73 files listed by the pack checksum manifest pass SHA-256 verification.
- Runtime media includes thirteen images and twelve browser audio variants behind a semantic manifest.
- Opening background evidence is a 168×288 bilinear mirror-wrapped tile repeated 10×10; gameplay evidence is a 131×169 bilinear mirror-wrapped tile repeated 2×2.
- The original extraction identifies one player, four enemies, one projectile, one game UI knob, two music tracks, one shoot sound, and three voice clips.
- No font binary or glyph atlas is supplied or authorized for shipping.
- The installed package registry currently exposes Phaser `4.2.1` as `latest`.

### Recovered or Inferred

- The recovered compiled metadata names gameplay concepts but does not expose reviewable C# rules.
- A fixed 540×960 logical arena, fixed 60 Hz simulation, kinematic circle collisions, and portrait-fit renderer are appropriate implementations of the supplied 9:16 evidence.
- Jimmy/Zac clips will be used once on terminal defeat, selected by seeded randomness, because the original event mapping is not recoverable.

### Unknown / Evidence Limit

- No runnable original Unity WebGL artifact is present, so black-box measurements of movement, cooldown, damage, spawn cadence, particle effects, exact typography, and audio mix cannot be performed.
- Exact Unity constants must remain labelled `TUNED APPROXIMATION`; they must not be described as recovered parity.
- Public redistribution rights for personal photos, voices, music, and sound remain outside technical verification and block public production release, not local implementation or preview-readiness.

## Accepted System Design Protocol

### System Thesis

Preston Remake App Flow owns the authorized user journey and composes five independent capability systems. Each system accepts typed commands and returns snapshots, events, or typed failures through one public `index.ts`. Gate and Gameplay own their in-memory state machines; Asset Catalog owns semantic media resolution; Audio owns playback policy; Customization owns selection and persistence policy. Browser and Phaser capabilities are reached through owned ports implemented by adapters. DOM presentation observes app state and dispatches app commands. Phaser renders Gameplay snapshots and forwards semantic input; it never owns score, health, collision, spawning, or game-over truth.

### Ownership and Authority

| Owner | Owns | Public input/output | External authority / port | Does not own |
| --- | --- | --- | --- | --- |
| App Flow | Top-level phases, transition authorization, runtime construction/disposal | `AppCommand` → `AppState` or typed no-op/failure | System entrypoints and runtime port | Gate rules, media paths, combat rules, vendor objects |
| Gate | Ordered question/code state machine | `GateAction` → `GateTransition` + snapshot | Client gate definition | UI, security/auth, persistence, gameplay |
| Asset Catalog | Manifest schema, stable keys, readiness and path resolution | manifest load/get → descriptor or typed failure | Supplied runtime manifest through fetch loader | Phaser caches, licensing, game rules |
| Audio | Unlock, one active music role, voice/SFX overlap, mute/pause/disposal | semantic commands → result/snapshot | Audio driver and preference port | App navigation, browser objects, asset URLs |
| Customization | Upload policy, normalized local assets, selected roster, revision and recovery rules | upload/select/save/load/clear → typed results | Canvas processor and character store ports | File-input UI, hitboxes, server upload |
| Gameplay | Authoritative deterministic session, entities, movement, collisions, health, score, difficulty, result | start/fixed-step/pause/resume/snapshot/dispose | Injected seeded RNG | Phaser, DOM, audio, persistence, image dimensions |
| Phaser adapter | Canvas lifecycle, texture views, input plumbing, backgrounds, visual FX | runtime mount/render/input/dispose | Phaser 4 and browser canvas | Product flow and simulation rules |

External authority conflicts: none. The supplied asset manifest owns packaged asset paths; the systems own only semantic interpretation. IndexedDB is durable storage, while the Customization System owns schema and conflict policy.

### State and Lifecycle

```text
booting -> opening
opening --START--> gate:q1 -> gate:q2
gate:q2 --NO--> rejected --RETURN--> opening
gate:q2 --YES--> gate:secretCode --basic--> customizing
customizing --ENTER_ARENA--> loading-game -> playing <-> paused
playing --health=0--> game-over
game-over --RETRY--> loading-game
game-over --CHANGE_CHARACTERS--> customizing
game-over --MAIN_MENU--> opening
```

- Invalid commands are typed no-ops and do not mutate state.
- Gate state and game sessions are memory-only. Main Menu resets the gate.
- Custom selection and normalized blobs use versioned IndexedDB records; unavailable/corrupt storage falls back safely to defaults or session memory with a warning.
- Retry creates a fresh simulation and renderer while retaining the selected appearance.
- Leaving gameplay disposes RAF, Phaser, listeners, pooled views, audio role, and object URLs.

### Invariants

- `trim(input) === "basic"` is the only passing code comparison and remains case-sensitive.
- Rejection never mounts gameplay through normal UI.
- Uploaded pixels never alter hitboxes, speed, health, damage, projectile behavior, score, or difficulty.
- Runtime feature code uses semantic asset IDs, not arbitrary physical paths.
- Music roles are mutually exclusive outside a bounded transition; listeners and SFX voices are bounded.
- The domain systems do not import Phaser, DOM, Canvas, IndexedDB, or one another's private implementation.
- Source originals and the supplied pack remain untouched; only runtime copies ship from `public/assets`.

### Allowed Dependency Direction

```text
presentation -> app public entrypoint -> system public entrypoints -> owned ports
adapters -> implement owned ports -> DOM / Canvas / IndexedDB / Web Audio / Phaser
Phaser adapter -> public gameplay snapshots + semantic input
```

Forbidden: domain-to-vendor imports, UI-to-private-system imports, adapter-to-presentation imports, direct asset paths outside the manifest adapter, circular dependencies, Unity runtime references, gate bypass flags, or backend/auth dependencies.

### Failures and Recovery

| Failure | Stable handling | Recovery |
| --- | --- | --- |
| Required asset missing/malformed | Boot failure with diagnostic | Retry reload after assets are repaired |
| Audio autoplay/device failure | `blocked` or `failed`, never false success | Visible Enable Sound; game remains playable muted |
| Unsupported/oversize/corrupt image | Typed upload rejection | Keep prior valid selection |
| IndexedDB unavailable/corrupt | Typed warning and safe fallback | Session memory/defaults; clear local data |
| Renderer/runtime failure | Dispose partial runtime | Return to customization with error where possible |
| Duplicate/stale async action | In-flight/revision guard | Ignore stale completion; command may be retried |

### Proof Target

A headed browser user can start, pass or fail the exact gate, customize or keep defaults, enter a deterministic playable Phaser arena, shoot and score, take damage, reach Game Over, retry/change characters/return home, reload persisted custom images, and complete the flow without Unity files or serious console errors. Static checks, contract/system tests, production build audit, browser screenshots, and E2E journeys are all required; hosted and physical-device claims remain separate.

## Target File Ownership

| Paths | Action | Owner / role | Verification |
| --- | --- | --- | --- |
| `package.json`, lockfile, TypeScript/Vite/Vitest/Playwright/ESLint configs, `index.html` | Add | Reproducible project foundation | install, typecheck, lint, test, build |
| `public/assets/**` | Copy from pack `runtime/**` | Shipping media and manifest | checksum/schema/existence/decode/build audit |
| `src/app/**`, `src/main.ts` | Add | Composition, phase state, lifecycle | app-flow integration and E2E |
| `src/systems/gate/**` | Add | Gate state machine | transition matrix |
| `src/systems/assets/**` | Add | Asset catalog contract | schema/key/failure tests |
| `src/systems/audio/**` | Add | Semantic playback policy | fake-driver lifecycle tests |
| `src/systems/customization/**` | Add | Validation, normalized assets, selection policy | unit/contract tests |
| `src/systems/gameplay/**`, `src/config/gameplayDefaults.ts` | Add | Deterministic simulation and centralized tuning | deterministic/system/stress tests |
| `src/adapters/browser/**` | Add | Fetch, Canvas, IndexedDB, lifecycle/audio implementations | adapter/browser tests |
| `src/adapters/phaser/**` | Add | Renderer/input/audio integration and FX | runtime/E2E/screenshot evidence |
| `src/presentation/**`, `src/styles/**` | Add | Semantic DOM screens, HUD, responsive styling | accessibility/E2E/visual QA |
| `tests/**`, `e2e/**`, `scripts/**` | Add | Contract, system, architecture, asset and browser evidence | exact test counts and reports |
| `arche/system/preston-remake-system.md` | Add after verification | Single canonical architecture/system truth | implementation mapping and evidence audit |
| `arche/00-index.md`, `README.md` | Add after verification | Navigation and developer/operator handoff | command/path review |
| `arche/plans/preston-remake-v1.md` | Maintain | Accepted unfinished work and slice gates | status/evidence review |
| `Preston_Remake_Detailed_Code_Plan.md`, `Preston_Remake_Full_Asset_Pack_v4/**` | Preserve | Supplied plan, source, provenance, and references | clean scoped diff and pack checksums |

Build outputs, caches, reports, dependencies, and browser profiles remain ignored. No source-original duplication is needed because the supplied pack stays immutable in the repository.

## Vertical Slices and Exit Gates

- [x] Slice 0 — Evidence/parity audit: pack checksum, manifest, provenance, metadata, and visual references inspected. Runnable-original capture unavailable and explicitly classified; fallback constants will be tuned approximations.
- [x] Slice 1 — Foundation/assets: strict project, shipping copy, semantic catalog, import/forbidden-file checks; typecheck, lint, tests, and build pass.
- [x] Slice 2 — Opening/gate/audio: exact gate matrix, gesture unlock, original opening/voice assets, rejection path, accessibility and browser flow pass.
- [x] Slice 3 — Gameplay domain: seeded fixed-step combat session proves player, bullets, enemies, collisions, health, scoring, game over, reset, and difficulty without Phaser imports.
- [x] Slice 4 — Phaser runtime: snapshots render with original assets and mirror backgrounds; physical input and semantic events integrate; runtime mounts/disposes cleanly.
- [x] Slice 5 — Complete UI loop: HUD, pause/visibility, Game Over metrics and Retry/Change Characters/Main Menu work on desktop and touch viewports.
- [x] Slice 6 — Customization: validate/normalize one player and up to eight enemies; fixed hitboxes; IndexedDB persistence/corruption/clear/fallback and reload E2E pass.
- [x] Slice 7 — Release hardening: all checks, build audit, Chromium E2E, responsive screenshots, console/performance/leak review, documentation synchronization, and preview decision complete.

## Centralized Tuning Decision

Until browser playtesting refines them, all unprovable values live in `src/config/gameplayDefaults.ts` as `TUNED APPROXIMATION` with this initial playable baseline: 540×960 world, 320 units/s player speed, 720 units/s projectile speed, 180 ms cooldown, 100 health, 20 contact damage, 900 ms invulnerability, 1,000 ms initial spawn interval trending to 280 ms, enemy speeds 72–150 units/s, scale 0.78–1.28, rotation −1.5–1.5 rad/s, 100 points per defeat, and difficulty increases every 15 seconds. These values are implementation decisions, not recovered Unity constants.

## Non-Goals and Deployment Boundary

Deferred: accounts, authentication, Supabase/backend/cloud storage, multiplayer, online leaderboard/sharing, custom question builder, live skin switching, character abilities, AI background removal, admin, monetization, analytics, bosses/maps/progression economy.

A Vercel preview may be created only if the local release gates pass and credentials/tooling permit it without a production release. Production deployment is excluded without explicit permission and an independent media-rights review.

## Completion Evidence

All repository-local acceptance criteria are implemented. The final verification record is maintained in [`../system/preston-remake-system.md`](../system/preston-remake-system.md) so evidence is not duplicated across documents.

- Static, dependency-boundary, asset, production-build, and distribution checks passed.
- Vitest: 58 unit/contract and 4 application-system tests passed, 0 failed.
- Playwright: 9 production-preview Chromium scenarios passed, 0 failed, with 3 intentional duplicate custom-persistence skips.
- Visual QA covered 1440×1000, 1920×1080, 390×844, and 360×740 viewports and every material product state.
- Hosted preview was not created. Public publication would expose personal likeness/voice/music assets whose redistribution rights are not established in the supplied evidence.
- Production deployment was not run or authorized.
