# Preston Plane-Shooter Parity Correction — Completed Build Ledger

Date: 2026-09-03  
Mode: Build / authoritative gameplay correction — complete locally  
Supersedes: the arena-gameplay portions of [`preston-remake-v1.md`](preston-remake-v1.md) and `Preston_Remake_Detailed_Code_Plan.md`

This plan records the accepted System Design Protocol and PO execution ledger for replacing the incorrect cursor-aimed arena core with the recovered fixed-camera vertical plane shooter. It does not modify the supplied plan or asset-pack evidence.

## Slice 0 Baseline Evidence

### Verified in the browser remake before the correction

- Gate, semantic asset catalog, audio lifecycle, customization, IndexedDB, application phases, Phaser lifecycle, responsive 9:16 shell, build tooling, and Vercel static packaging are working boundaries that remain in scope but retain their authority.
- At that baseline, the Gameplay System was the source of truth but was incorrect for parity: pointer aiming, held rapid fire, four-edge spawns, homing enemies, 100 health, generic 100-point scoring, invulnerability, difficulty waves, and a static gameplay background.
- Supplied metadata records an orthographic Unity camera size of 5, a near-9:16 background quad, mirror-wrapped 2×2 gameplay material tiling, and the original photographic source texture.

### Recovered from serialized Unity data supplied by the correction

- Player start `(0, -3)`, movement speed `5`, and health `3`.
- Projectile direction `(0, 1)`, speed `20`, damage `1`, and one shot per discrete press.
- Spawn interval `0.5` seconds, configured area width `2`, configured area height `6`, and four mechanical enemy definitions.
- Enemy health/speed/lifetime/score/contact/scale/rotation values exactly as listed in the authoritative correction.
- Background scroll values `2.5` and `3.0`.

### Inferred or tuned

- The additional serialized PlayerMovement value `50` is retained as evidence and interpreted as screen-edge padding only for the renderer/world clamp conversion.
- With orthographic size `5` and a 9:16 camera, the implementation uses world bounds `x = ±2.8125`, `y = ±5`; `50` logical pixels maps to approximately `0.520833` world units at 96 pixels per world unit.
- Collision radii, muzzle offset, visual pixel sizes, the fixed scale of `enemy.2`, layer blend/offset, and Jimmy/Zac selection are implementation values because their exact meanings are not present in the available evidence.

### Unavailable evidence

- `reference-unity-build/Preston vs particles 2.zip` is absent from the filesystem, current Git tree, and Git history, so the original cannot be launched or directly measured in this run.
- The supplied asset pack states it was extracted from that build, but extracted metadata is not equivalent to running-build observation.

## Accepted System Design Protocol

### Qualification

This is an extension/replacement inside the existing independently owned Gameplay System. It owns a meaningful state machine, collision/scoring rules, deterministic spawning, lifecycle, public contract, and independent tests. No additional manager or repository is justified.

### System thesis

`PlaneShooterSimulation` owns player position and health, move-vector state, projectile creation/movement, four mechanical enemy definitions, spawn timing, enemy movement/lifetime, collisions, damage, enemy-specific scoring, game-over, and clean restart. It accepts typed `SetMoveVector`, `FirePressed`, `AdvanceFrame`, and `RestartRun` commands and returns immutable snapshots, semantic events, or typed command failures. It reaches randomness only through the existing `RandomSource` port. The Application Controller and Phaser runtime consume the public gameplay entrypoint and do not import private implementation. It does not own DOM, keyboard/touch APIs, rendering, audio playback, persisted image pixels, asset paths, or deployment.

### State authority and lifecycle

```text
idle --RestartRun/start--> running <-> paused
running --third valid contact--> gameOver
gameOver --RestartRun--> running
any non-disposed state --dispose--> disposed
```

- `SetMoveVector` changes the stored normalized movement vector only while running.
- `FirePressed` creates exactly one upward projectile only while running; holding a key creates no additional command.
- `AdvanceFrame` advances player, projectiles, spawn clock, enemies/lifetimes, collisions, score, and terminal state.
- Game Over is emitted once, freezes score/health/entities/spawn mutation, and rejects movement/fire.
- Restart reconstructs initial player state, score, clocks, entities, IDs, terminal flags, and RNG sequence.
- Renderer background offsets are ephemeral adapter state and reset when the fresh Phaser runtime is mounted.

### Public operations

| Trigger | Typed input | Output/failure | Guarantee |
| --- | --- | --- | --- |
| Start/retry | `StartRunCommand` / `RestartRun` | Initial `PlaneShooterSnapshot` | Player is `(0,-3)`, health 3, score/entities/clocks zero |
| Direction change | `SetMoveVector` | Snapshot or `run-not-active` | Four-direction vector is normalized and later clamped to camera bounds |
| Discrete fire edge | `FirePressed` | `ProjectileSpawned` or typed failure | One projectile at the muzzle, direction `(0,1)`, speed 20, damage 1 |
| Fixed advance | `AdvanceFrame` | Snapshot plus semantic events or invalid-delta failure | Deterministic order and exactly-once collision/terminal mutation |
| Pause/resume | lifecycle operations | Snapshot | No simulation mutation while paused |
| Dispose | lifecycle operation | terminal snapshot | Idempotent entity/resource release |

### Invariants

- Up/W means positive world Y; Down/S means negative world Y. Renderer Y is an adapter projection only.
- No cursor coordinate or held-fire boolean enters the gameplay contract.
- Projectiles always travel `(0, +20)` and disappear on hit or after leaving the playfield.
- Every spawn chooses one of `enemy.base`, `enemy.1`, `enemy.2`, or `enemy.3`; custom images never replace the definition.
- Enemies move only downward, expire after eight seconds, and award no score on expiry/off-screen removal.
- Contact removes the enemy and applies one damage once; no invented invulnerability window is needed.
- Definition-specific health and score are authoritative; visual scale never changes hitbox, health, speed, score, or damage.
- No wave, progressive difficulty, survival-time product rule, automatic fire, pointer aim, boss, upgrade, or power-up remains.

## Exact File Actions

| Path | Action | Ownership / purpose | Verification |
| --- | --- | --- | --- |
| `src/config/gameplayDefaults.ts` | Retire | Remove incorrect arena tuning source | No imports/callers remain |
| `src/config/planeShooterParity.ts` | Add | One typed recovered/inferred parity configuration | Exact constant assertions |
| `src/systems/gameplay/GameSimulation.ts` | Retire | Remove incorrect arena implementation | No imports/callers remain |
| `src/systems/gameplay/PlaneShooterSimulation.ts` | Add | Authoritative plane-shooter state/rules/lifecycle | Focused parity tests |
| `src/systems/gameplay/contracts.ts` | Replace contract | Typed commands, snapshots, events, failures, enemy definitions | Typecheck and contract tests |
| `src/systems/gameplay/GameRules.ts` | Retire | Remove difficulty-era helpers | No imports/callers remain |
| `src/systems/gameplay/PlaneShooterRules.ts` | Add | Pure clamp/normalization/continuous collision helpers | Unit tests |
| `src/systems/gameplay/index.ts` | Modify | One supported public plane-shooter entrypoint | Boundary check |
| `src/systems/gameplay/internal/collision.ts` | Retire | Replaced by continuous moving-circle collision in the owned rules module | No caller remains; collision tests pass |
| `src/app/AppController.ts`, `src/app/createApp.ts`, `src/app/runtimePort.ts`, `src/app/contracts.ts` | Modify | Compose typed plane simulation and route semantic audio/runtime state | Integration tests |
| `src/adapters/phaser/input/PhaserInputAdapter.ts` | Replace behavior | Arrow/WASD vector, Space edge, touch joystick/fire button; no mouse aim | Browser/E2E |
| `src/adapters/phaser/scenes/GameScene.ts` | Modify | World-to-screen projection, vertical sprites, scrolling view, runtime diagnostics | Browser/E2E/screenshots |
| `src/adapters/phaser/views/ScrollingBackgroundView.ts` | Add | Two gapless mirror-photo renderer layers at 2.5/3.0 | Browser offset/visual evidence |
| `src/adapters/phaser/views/EffectsView.ts` | Modify | Consume projected plane-shooter events | E2E/visual QA |
| `src/presentation/AppPresenter.ts`, `src/styles/main.css` | Modify | Exact opening/game-over/HUD/control copy; remove wave/survival claims | E2E/accessibility/visual QA |
| `tests/gameplay/GameSimulation.test.ts` | Retire | Remove tests that canonize incorrect mechanics | No old assertions remain |
| `tests/gameplay/PlaneShooterSimulation.test.ts` | Add | Full corrected parity matrix | Vitest exact count |
| `tests/integration/AppController.test.ts` | Modify | New snapshot/event/restart contract | Integration suite |
| `e2e/game-flow.spec.ts` | Modify | Space, no mouse fire, touch button, 3 HP, scrolling, final score/restart | Four Chromium projects |
| `README.md`, `arche/00-index.md`, `arche/system/preston-remake-system.md`, `arche/plans/preston-remake-v1.md` | Modify after verification | Replace stale arena truth and mark supersession | Documentation audit |
| `Preston_Remake_Detailed_Code_Plan.md`, `Preston_Remake_Full_Asset_Pack_v4/**`, `public/assets/**` | Preserve | Supplied input, provenance, and shipping bytes | Git status/checksums |

## Vertical Slices

- [x] Slice 0 — Inspect current worktree, source/runtime evidence, Unity-reference availability, existing state authority, callers, tests, and documentation drift.
- [x] Slice 1 — RED: replaced arena tests with the recovered parity configuration, typed plane commands, exact enemy-definition, movement, firing, spawn, collision, score, game-over, appearance, and restart expectations.
- [x] Slice 2 — GREEN/REFINE: implemented `PlaneShooterSimulation`, retired difficulty/aim/cooldown/invulnerability behavior, and integrated the Application Controller under focused and wider tests.
- [x] Slice 3 — Integrated Space-edge and mobile joystick/fire input, world projection, vertical rendering, two scrolling background layers, exact opening/HUD/Game Over copy, and appearance-only texture mapping.
- [x] Slice 4 — Passed local static/unit/system/build gates and four-viewport production-preview E2E/visual QA, corrected unstable HUD replacement and deterministic-test clock issues, synchronized canonical docs, and re-audited Unity absence/source-pack preservation.

## Verification Gates

- Static: typecheck, ESLint, dependency-boundary check, obsolete-symbol search.
- Unit/contract: every parity test listed in the authoritative correction, including four definition hit counts and stable score/game-over state.
- System: AppController event-to-audio, appearance mapping, pause, fresh retry, and disposal.
- E2E/browser: exact opening copy, gate, 3 HP, Space edge, no mouse fire, touch fire control, scrolling offsets, Final Score, “Shooting Again!”, Change Characters, Main Menu, custom persistence, one-canvas restart, and no serious console error at 1440×1000, 1920×1080, 390×844, and 360×740.
- Build/package: Vite production build, public asset byte identity, forbidden Unity/WASM/C#/source-original audit.
- Hosted/production: not authorized by this correction.

## Non-Goals and Guardrails

- Do not alter Gate, persistence schema, upload normalization, asset-pack media, backend scope, or Vercel production state.
- Do not add a pre-game `3-2-1-0` countdown; `3 → 2 → 1 → 0` is the health transition contract.
- Do not preserve compatibility fields for pointer aim, held fire, generic score, difficulty, or survival metrics when all repository callers are migrated in the same slice.
- Do not claim the missing Unity ZIP was run, or label inferred pixel/world placement as recovered fact.
