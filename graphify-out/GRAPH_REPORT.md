# Graph Report - particle_airplane_game  (2026-09-03)

## Corpus Check
- 86 files · ~359,849 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1383 nodes · 2895 edges · 69 communities (64 shown, 5 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 23 edges (avg confidence: 0.77)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `65344e13`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- AppController.ts
- GameScene
- AppController
- AudioCoordinator
- AssetDescriptor
- assets/index.ts
- AppPresenter
- 11. Implementation slices
- 11. Implementation slices
- scripts
- CanvasImageProcessor.ts
- createApp.ts
- gameplay/index.ts
- compilerOptions
- 4. System qualification and ownership map
- 4. System qualification and ownership map
- CharacterStorePort
- app/contracts.ts
- CustomizationRecord
- customization/contracts.ts
- verify-assets.mjs
- Preston vs Particles V1 — Completed Build Plan
- PlaneShooterSimulation
- Preston vs Particles V1 — Canonical System Document
- docs/Preston_Remake_Detailed_Code_Plan.md
- Preston Plane-Shooter Parity Correction — Completed Build Ledger
- 1. Product definition
- 1. Product definition
- PlaneShooterSnapshot
- 5. Typed public contracts
- 5. Typed public contracts
- Preston_Remake_Detailed_Code_Plan.md
- game-flow.spec.ts
- PlaneShooterSimulation.test.ts
- 12. Verification strategy and evidence ladder
- 12. Verification strategy and evidence ladder
- verify-dist.mjs
- 8. Technology decisions
- 8. Technology decisions
- Vector2
- 6. State authority and lifecycle
- 6. State authority and lifecycle
- check-boundaries.mjs
- PlaneShooterSimulationApi
- 00-index.md
- Provenance and Usage
- Preston Remake Full Asset Pack v4
- CustomizationError
- XorShift32
- vercel.json
- 15. Product and technical guardrails
- 2. Current evidence
- 15. Product and technical guardrails
- 2. Current evidence
- 13. Documentation and evidence policy
- 14. Branch, worktree, and multi-agent plan
- 13. Documentation and evidence policy
- 14. Branch, worktree, and multi-agent plan
- Preston vs Particles
- 17. Definition of Done
- 7. Dependency design
- Asset Inventory Summary
- 17. Definition of Done
- EnemyDefinition
- createPlaneShooterSimulation

## God Nodes (most connected - your core abstractions)
1. `AppController` - 63 edges
2. `CharacterCustomizer` - 34 edges
3. `PlaneShooterSimulation` - 33 edges
4. `AppPresenter` - 30 edges
5. `AssetDescriptor` - 30 edges
6. `BrowserAudioDriver` - 29 edges
7. `AudioCoordinator` - 28 edges
8. `PlaneShooterSnapshot` - 26 edges
9. `GameScene` - 25 edges
10. `AudioDriverResult` - 25 edges

## Surprising Connections (you probably didn't know these)
- `FakeAudio` --implements--> `AppAudioPort`  [EXTRACTED]
  tests/integration/AppController.test.ts → src/app/AppController.ts
- `FakeCustomization` --references--> `CustomAssetRecord`  [EXTRACTED]
  tests/integration/AppController.test.ts → src/systems/customization/contracts.ts
- `SnapshotCountingSimulation` --inherits--> `PlaneShooterSimulation`  [EXTRACTED]
  tests/gameplay/PlaneShooterSimulation.test.ts → src/systems/gameplay/PlaneShooterSimulation.ts
- `FakeSimulation` --references--> `PlaneShooterAppearance`  [EXTRACTED]
  tests/integration/AppController.test.ts → src/systems/gameplay/contracts.ts
- `FakeSimulation` --references--> `GameEvent`  [EXTRACTED]
  tests/integration/AppController.test.ts → src/systems/gameplay/contracts.ts

## Import Cycles
- None detected.

## Communities (69 total, 5 thin omitted)

### Community 0 - "AppController.ts"
Cohesion: 0.05
Nodes (46): AppControllerDependencies, clearLocalData(), DEFAULT_AUDIO_ROLE_BY_PHASE, deleteUpload(), loadSelection(), processUpload(), selectPlayer(), setEnemyRoster() (+38 more)

### Community 1 - "GameScene"
Cohesion: 0.05
Nodes (15): createPhaserConfig(), KeySet, PhaserInputAdapter, TOUCH_FIRE_RADIUS, TOUCH_JOYSTICK_RADIUS, TouchControlSnapshot, PhaserRuntimeAdapter, GameScene (+7 more)

### Community 2 - "AppController"
Cohesion: 0.09
Nodes (13): AppController, AppObjectUrlPort, commandApplied(), commandFailed(), commandInvalid(), getAsset(), getSelection(), getSnapshot() (+5 more)

### Community 3 - "AudioCoordinator"
Cohesion: 0.07
Nodes (20): AssetCatalogPort, AudioCoordinator, createAudioCoordinator(), failureForDriver(), AUDIO_ROLE_ASSET_KEYS, AudioCommandResult, AudioCommands, AudioCoordinatorOptions (+12 more)

### Community 4 - "AssetDescriptor"
Cohesion: 0.07
Nodes (14): BrowserAudioDriver, BrowserAudioDriverOptions, clamp(), errorMessage(), formatOf(), isBlockedError(), mimeTypeOf(), MusicTrack (+6 more)

### Community 5 - "assets/index.ts"
Cohesion: 0.08
Nodes (43): FetchAssetManifestLoader, FetchAssetManifestLoaderOptions, AssetCatalog, AUDIO_FORMATS, createAssetCatalog(), extensionOf(), failure(), freezeBackground() (+35 more)

### Community 6 - "AppPresenter"
Cohesion: 0.08
Nodes (20): AppControllerPort, AppState, controller, presenter, root, shell, AppPresenter, AppPresenterElements (+12 more)

### Community 7 - "11. Implementation slices"
Cohesion: 0.04
Nodes (49): 11. Implementation slices, Acceptance gate, Acceptance gate, Acceptance gate, Acceptance gate, Acceptance gate, Acceptance gate, Acceptance gate (+41 more)

### Community 8 - "11. Implementation slices"
Cohesion: 0.04
Nodes (49): 11. Implementation slices, Acceptance gate, Acceptance gate, Acceptance gate, Acceptance gate, Acceptance gate, Acceptance gate, Acceptance gate (+41 more)

### Community 9 - "scripts"
Cohesion: 0.05
Nodes (41): eslint, @eslint/js, fake-indexeddb, globals, dependencies, phaser, devDependencies, eslint (+33 more)

### Community 10 - "CanvasImageProcessor.ts"
Cohesion: 0.08
Nodes (25): CanvasDrawingContext, CanvasImageProcessor, CanvasImageProcessorOptions, coverCrop(), DecodedImageSource, encodeCanvas(), RenderCanvas, AllowedImageMimeType (+17 more)

### Community 11 - "createApp.ts"
Cohesion: 0.07
Nodes (12): BrowserLifecycleAdapter, BrowserLifecycleCallbacks, LocalAudioPreferenceStore, ObjectUrlRegistry, AppAudioPort, AppLifecyclePort, createApp(), CreateAppOptions (+4 more)

### Community 12 - "gameplay/index.ts"
Cohesion: 0.15
Nodes (26): CAMERA, ENEMY_DEFINITIONS, EnemyDefinitionId, EnemyScaleRule, INFERRED_TUNING_EVIDENCE, PLANE_SHOOTER_PARITY, PlaneShooterConfig, RECOVERED_PARITY_EVIDENCE (+18 more)

### Community 13 - "compilerOptions"
Cohesion: 0.07
Nodes (29): DOM, DOM.Iterable, e2e, ES2022, playwright.config.ts, src, tests, vite/client (+21 more)

### Community 14 - "4. System qualification and ownership map"
Cohesion: 0.07
Nodes (29): 4.1 App Flow owner, 4.2 Gate System, 4.3 Asset Catalog System, 4.4 Audio System, 4.5 Character Customization System, 4.6 Gameplay System, 4.7 Phaser Runtime Adapter, 4. System qualification and ownership map (+21 more)

### Community 15 - "4. System qualification and ownership map"
Cohesion: 0.07
Nodes (29): 4.1 App Flow owner, 4.2 Gate System, 4.3 Asset Catalog System, 4.4 Audio System, 4.5 Character Customization System, 4.6 Gameplay System, 4.7 Phaser Runtime Adapter, 4. System qualification and ownership map (+21 more)

### Community 16 - "CharacterStorePort"
Cohesion: 0.09
Nodes (11): CharacterCustomizerOptions, CharacterStorePort, ImageProcessorPort, ImageUploadInput, NormalizedCharacterImage, CorruptThenClearStore, DeferredImageProcessor, DeferredStore (+3 more)

### Community 17 - "app/contracts.ts"
Cohesion: 0.21
Nodes (10): AppFailure, AppFailureCode, AppPhase, GateAction, GateSessionPort, GateSnapshot, GateTransition, createGateSession() (+2 more)

### Community 18 - "CustomizationRecord"
Cohesion: 0.17
Nodes (9): asRecordError(), asStorageError(), IndexedDbCharacterStore, IndexedDbCharacterStoreOptions, MemoryCharacterStore, SessionMemoryStore, assertCustomizationRecord(), cloneCustomizationRecord() (+1 more)

### Community 19 - "customization/contracts.ts"
Cohesion: 0.16
Nodes (21): assertCharacterSelection(), assertCustomAssetRecord(), assertNormalizedCharacterImage(), cloneCharacterSkinRef(), CUSTOMIZATION_SCHEMA_VERSION, CustomizationErrorCode, CustomizationFailure, CustomizationLoadSuccess (+13 more)

### Community 20 - "verify-assets.mjs"
Cohesion: 0.11
Nodes (12): expectedDimensions, failures, manifest, manifestPath, normalizeRelative(), publicAssets, referenced, requiredAudio (+4 more)

### Community 21 - "Preston vs Particles V1 — Completed Build Plan"
Cohesion: 0.11
Nodes (19): Accepted System Design Protocol, Allowed Dependency Direction, Centralized Tuning Decision, Completion Evidence, Evidence Baseline, Failures and Recovery, Invariants, Non-Goals and Deployment Boundary (+11 more)

### Community 22 - "PlaneShooterSimulation"
Cohesion: 0.27
Nodes (4): GameEvent, PlaneShooterCommandResult, cloneVector(), PlaneShooterSimulation

### Community 23 - "Preston vs Particles V1 — Canonical System Document"
Cohesion: 0.11
Nodes (18): Accessibility and Responsive Web Quality, Assets and Background Reconstruction, Customization and Local Persistence, Deferred Backlog / V1 Non-Goals, Development and Deployment, Gameplay Contract, INFERRED/TUNED, Lifecycle and Failure Handling (+10 more)

### Community 24 - "docs/Preston_Remake_Detailed_Code_Plan.md"
Cohesion: 0.12
Nodes (16): 0. Protocol and planning basis, 10. Exact file actions, 16. Risks and mitigations, 18. Status vocabulary, 19. Initial coding-agent execution order, 20. Final architectural outcome, 3. System design thesis, 7.1 Allowed dependency direction (+8 more)

### Community 25 - "Preston Plane-Shooter Parity Correction — Completed Build Ledger"
Cohesion: 0.12
Nodes (16): Accepted System Design Protocol, Exact File Actions, Inferred or tuned, Invariants, Non-Goals and Guardrails, Preston Plane-Shooter Parity Correction — Completed Build Ledger, Public operations, Qualification (+8 more)

### Community 26 - "1. Product definition"
Cohesion: 0.12
Nodes (16): 1.1 Product statement, 1.2 Target player, 1.3 Core player promise, 1.4 Product pillars, 1.5 Exact V1 player journey, 1.6 “Kick out” behavior, 1.7 V1 scope by priority, 1.8 Release milestones (+8 more)

### Community 27 - "1. Product definition"
Cohesion: 0.12
Nodes (16): 1.1 Product statement, 1.2 Target player, 1.3 Core player promise, 1.4 Product pillars, 1.5 Exact V1 player journey, 1.6 “Kick out” behavior, 1.7 V1 scope by priority, 1.8 Release milestones (+8 more)

### Community 28 - "PlaneShooterSnapshot"
Cohesion: 0.19
Nodes (4): PlaneShooterSnapshot, StartRunCommand, FakeSimulation, openGate()

### Community 29 - "5. Typed public contracts"
Cohesion: 0.14
Nodes (14): 5.1 App commands and state, 5.2 Gate contract, 5.3 Asset catalog contract, 5.4 Audio contract, 5.5 Customization contract, 5.6 Gameplay contract, 5.7 Runtime adapter contract, 5. Typed public contracts (+6 more)

### Community 30 - "5. Typed public contracts"
Cohesion: 0.14
Nodes (14): 5.1 App commands and state, 5.2 Gate contract, 5.3 Asset catalog contract, 5.4 Audio contract, 5.5 Customization contract, 5.6 Gameplay contract, 5.7 Runtime adapter contract, 5. Typed public contracts (+6 more)

### Community 31 - "Preston_Remake_Detailed_Code_Plan.md"
Cohesion: 0.15
Nodes (12): 0. Protocol and planning basis, 10. Exact file actions, 16. Risks and mitigations, 18. Status vocabulary, 19. Initial coding-agent execution order, 20. Final architectural outcome, 3. System design thesis, 9. Proposed repository structure (+4 more)

### Community 32 - "game-flow.spec.ts"
Cohesion: 0.23
Nodes (7): authorize(), canvasNumber(), dragTouch(), ENEMY_FIXTURES, exercisePlaneControls(), reachQuestionTwo(), reachSecretCode()

### Community 33 - "PlaneShooterSimulation.test.ts"
Cohesion: 0.18
Nodes (5): ENEMY_DEFINITION_IDS, advance(), expectApplied(), SequenceRandom, SnapshotCountingSimulation

### Community 34 - "12. Verification strategy and evidence ladder"
Cohesion: 0.18
Nodes (11): 12.1 Standard commands, 12.2 Evidence levels, 12.3 Required unit test matrix, 12.4 Required E2E journeys, 12.5 Visual parity review, 12.6 Performance gates, 12. Verification strategy and evidence ladder, Audio (+3 more)

### Community 35 - "12. Verification strategy and evidence ladder"
Cohesion: 0.18
Nodes (11): 12.1 Standard commands, 12.2 Evidence levels, 12.3 Required unit test matrix, 12.4 Required E2E journeys, 12.5 Visual parity review, 12.6 Performance gates, 12. Verification strategy and evidence ladder, Audio (+3 more)

### Community 36 - "verify-dist.mjs"
Cohesion: 0.18
Nodes (6): dist, distAssets, failures, indexPath, publicAssets, root

### Community 37 - "8. Technology decisions"
Cohesion: 0.20
Nodes (10): 8.1 Runtime stack, 8.2 Why no React, 8.3 Logical playfield, 8.4 Simulation timing, 8.5 Collision model, 8.6 Asset loading strategy, 8.7 Background implementation, 8.8 Audio implementation (+2 more)

### Community 38 - "8. Technology decisions"
Cohesion: 0.20
Nodes (10): 8.1 Runtime stack, 8.2 Why no React, 8.3 Logical playfield, 8.4 Simulation timing, 8.5 Collision model, 8.6 Asset loading strategy, 8.7 Background implementation, 8.8 Audio implementation (+2 more)

### Community 39 - "Vector2"
Cohesion: 0.31
Nodes (8): Vector2, clamp(), clampUnit(), MovingCircle, movingCirclesOverlap(), normalizeMoveVector(), randomRange(), MutableProjectile

### Community 40 - "6. State authority and lifecycle"
Cohesion: 0.25
Nodes (8): 6.1 App lifecycle, 6.2 Gate lifecycle, 6.3 Audio lifecycle, 6.4 Gameplay lifecycle, 6.5 Persistence ownership, 6.6 Duplicate and concurrency behavior, 6. State authority and lifecycle, Invalid transitions

### Community 41 - "6. State authority and lifecycle"
Cohesion: 0.25
Nodes (8): 6.1 App lifecycle, 6.2 Gate lifecycle, 6.3 Audio lifecycle, 6.4 Gameplay lifecycle, 6.5 Persistence ownership, 6.6 Duplicate and concurrency behavior, 6. State authority and lifecycle, Invalid transitions

### Community 42 - "check-boundaries.mjs"
Cohesion: 0.25
Nodes (5): failures, packageJson, packages, root, sourceRoot

### Community 45 - "Provenance and Usage"
Cohesion: 0.29
Nodes (6): Fonts, Generated variants, Legal boundary, Provenance and Usage, Separation rules, Technical source

### Community 46 - "Preston Remake Full Asset Pack v4"
Cohesion: 0.29
Nodes (7): Background parity, Deliberate exclusion, Included game-specific media, Limits, Preston Remake Full Asset Pack v4, Rights, Start here

### Community 47 - "CustomizationError"
Cohesion: 0.33
Nodes (3): CustomizationError, openDatabase(), putRaw()

### Community 49 - "vercel.json"
Cohesion: 0.29
Nodes (6): buildCommand, cleanUrls, framework, headers, outputDirectory, $schema

### Community 50 - "15. Product and technical guardrails"
Cohesion: 0.33
Nodes (6): 15.1 Scope guardrails, 15.2 Architecture guardrails, 15.3 Privacy/security guardrails, 15.4 Rights guardrails, 15.5 Failure and recovery guardrails, 15. Product and technical guardrails

### Community 51 - "2. Current evidence"
Cohesion: 0.33
Nodes (6): 2.1 Verified source evidence, 2.2 Verified audio inventory, 2.3 Verified background behavior, 2.4 Verified asset-package state, 2.5 Known unknowns that must not be invented as “original”, 2. Current evidence

### Community 52 - "15. Product and technical guardrails"
Cohesion: 0.33
Nodes (6): 15.1 Scope guardrails, 15.2 Architecture guardrails, 15.3 Privacy/security guardrails, 15.4 Rights guardrails, 15.5 Failure and recovery guardrails, 15. Product and technical guardrails

### Community 53 - "2. Current evidence"
Cohesion: 0.33
Nodes (6): 2.1 Verified source evidence, 2.2 Verified audio inventory, 2.3 Verified background behavior, 2.4 Verified asset-package state, 2.5 Known unknowns that must not be invented as “original”, 2. Current evidence

### Community 54 - "13. Documentation and evidence policy"
Cohesion: 0.40
Nodes (5): 13.1 Active plan, 13.2 Canonical system document, 13.3 Completion evidence, 13.4 Asset evidence, 13. Documentation and evidence policy

### Community 55 - "14. Branch, worktree, and multi-agent plan"
Cohesion: 0.40
Nodes (5): 14.1 Rules, 14.2 Recommended branch sequence, 14.3 Safe parallel work after Slice 1, 14.4 Integration checklist, 14. Branch, worktree, and multi-agent plan

### Community 56 - "13. Documentation and evidence policy"
Cohesion: 0.40
Nodes (5): 13.1 Active plan, 13.2 Canonical system document, 13.3 Completion evidence, 13.4 Asset evidence, 13. Documentation and evidence policy

### Community 57 - "14. Branch, worktree, and multi-agent plan"
Cohesion: 0.40
Nodes (5): 14.1 Rules, 14.2 Recommended branch sequence, 14.3 Safe parallel work after Slice 1, 14.4 Integration checklist, 14. Branch, worktree, and multi-agent plan

### Community 58 - "Preston vs Particles"
Cohesion: 0.40
Nodes (5): Build and Vercel, Preston vs Particles, Project documentation, Run locally, Verification

### Community 59 - "17. Definition of Done"
Cohesion: 0.50
Nodes (4): 17.1 Milestone A — original-plus-gate playable, 17.2 Milestone B — full local-customization V1, 17.3 Release evidence requirements, 17. Definition of Done

### Community 60 - "7. Dependency design"
Cohesion: 0.50
Nodes (4): 7.1 Allowed dependency direction, 7.2 Forbidden dependencies, 7.3 Boundary enforcement, 7. Dependency design

### Community 61 - "Asset Inventory Summary"
Cohesion: 0.50
Nodes (3): Asset Inventory Summary, Exclusions, Runtime keys

### Community 62 - "17. Definition of Done"
Cohesion: 0.50
Nodes (4): 17.1 Milestone A — original-plus-gate playable, 17.2 Milestone B — full local-customization V1, 17.3 Release evidence requirements, 17. Definition of Done

## Knowledge Gaps
- **445 isolated node(s):** `ENEMY_FIXTURES`, `name`, `version`, `private`, `type` (+440 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AppController` connect `AppController` to `AppController.ts`, `createPlaneShooterSimulation`, `AppPresenter`, `PlaneShooterSimulationApi`, `gameplay/index.ts`, `createApp.ts`, `app/contracts.ts`, `PlaneShooterSnapshot`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Why does `AssetCatalog` connect `assets/index.ts` to `AudioCoordinator`, `AppController.ts`, `createApp.ts`, `AssetDescriptor`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Why does `AudioCommands` connect `AudioCoordinator` to `AppController.ts`, `createApp.ts`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **What connects `ENEMY_FIXTURES`, `name`, `version` to the rest of the system?**
  _445 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `AppController.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05442176870748299 - nodes in this community are weakly interconnected._
- **Should `GameScene` be split into smaller, more focused modules?**
  _Cohesion score 0.05136986301369863 - nodes in this community are weakly interconnected._
- **Should `AppController` be split into smaller, more focused modules?**
  _Cohesion score 0.09026915113871635 - nodes in this community are weakly interconnected._