import type {
  AssetCatalogPort,
  AssetKey,
} from '../systems/assets';
import type {
  AudioCommandResult,
  AudioCommands,
  MusicRole,
} from '../systems/audio';
import {
  PACKAGED_ENEMY_ASSET_KEYS,
  PACKAGED_PLAYER_ASSET_KEY,
  type CharacterRole,
  type CharacterSelection,
  type CharacterSkinRef,
  type CropSettings,
  type CustomAssetRecord,
  type CustomizationClearResult,
  type CustomizationDeleteResult,
  type CustomizationLoadResult,
  type CustomizationMutationResult,
  type CustomizationSaveResult,
  type CustomizationSnapshot,
  type ImageProcessingResult,
} from '../systems/customization';
import {
  createPlaneShooterSimulation,
  PLANE_SHOOTER_PARITY,
  type GameEvent,
  type PlaneShooterAppearance,
  type PlaneShooterConfig,
  type PlaneShooterInputFrame,
  type PlaneShooterResult,
  type PlaneShooterSimulationApi,
  type PlaneShooterSimulationOptions,
  type PlaneShooterSnapshot,
} from '../systems/gameplay';
import { GateSession, type GateAction } from '../systems/gate';
import type {
  AppCommand,
  AppCommandResult,
  AppControllerPort,
  AppFailure,
  AppState,
} from './contracts';
import { AppStateStore } from './AppStateStore';
import type {
  GameRuntimePort,
  RuntimeMountInput,
  RuntimeStepResult,
  RuntimeTextureSet,
  RuntimeTextureSource,
} from './runtimePort';

/**
 * Narrow application-owned boundary for local image URL lifetime. The
 * browser implementation is intentionally not coupled into this coordinator.
 */
export interface AppObjectUrlPort {
  get(key: string, blob: Blob): string;
  retain(keys: ReadonlySet<string>): void;
  clear(): void;
}

/** The lifecycle hooks are deliberately narrower than the browser adapter. */
export interface AppLifecyclePort {
  mount(): void;
  dispose(): void;
}

export interface AppAudioPort extends AudioCommands {
  initialize?(): Promise<void>;
  dispose?(): Promise<void>;
  /** Optional non-visibility pause hooks for richer audio adapters/fakes. */
  pause?(): void;
  resume?(): Promise<unknown>;
}

export interface AppControllerDependencies {
  readonly assets: AssetCatalogPort;
  readonly audio: AppAudioPort;
  readonly customization: {
    loadSelection(): Promise<CustomizationLoadResult>;
    processUpload(
      input: { readonly file: Blob; readonly mimeType?: string; readonly role?: CharacterRole; readonly target?: CharacterRole },
      options: { readonly crop: CropSettings; readonly role: CharacterRole; readonly operationId?: string },
    ): Promise<ImageProcessingResult>;
    getSnapshot(): CustomizationSnapshot;
    getSelection(): CharacterSelection;
    getAsset(id: string): CustomAssetRecord | undefined;
    selectPlayer(ref: CharacterSkinRef): CustomizationMutationResult;
    setEnemyRoster(refs: readonly CharacterSkinRef[]): CustomizationMutationResult;
    setSelection(selection: CharacterSelection): CustomizationMutationResult;
    addEnemy(ref: CharacterSkinRef): CustomizationMutationResult;
    deleteUpload(id: string): Promise<CustomizationDeleteResult>;
    clearLocalData(): Promise<CustomizationClearResult>;
    saveSelection(selection?: CharacterSelection): Promise<CustomizationSaveResult>;
  };
  readonly runtime: GameRuntimePort;
  readonly runtimeContainer: HTMLElement;
  readonly objectUrls: AppObjectUrlPort;
  readonly lifecycle?: AppLifecyclePort;
  readonly simulationFactory?: (options?: PlaneShooterSimulationOptions) => PlaneShooterSimulationApi;
  readonly gameplayConfig?: PlaneShooterConfig;
  readonly sessionIdFactory?: () => string;
  readonly seedFactory?: () => number;
  readonly gate?: GateSession;
}

const GAME_PUBLISH_INTERVAL_MS = 120;
const DEFAULT_SESSION_PREFIX = 'preston-session';
const DEFAULT_AUDIO_ROLE_BY_PHASE: Partial<Record<AppState['kind'], MusicRole>> = {
  opening: 'opening',
  gate: 'opening',
  customizing: 'opening',
  playing: 'gameplay',
  paused: 'gameplay',
  'game-over': 'gameplay',
};

let fallbackSessionCounter = 0;

const defaultSessionIdFactory = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  fallbackSessionCounter += 1;
  return `${DEFAULT_SESSION_PREFIX}-${Date.now()}-${fallbackSessionCounter}`;
};

const defaultSeedFactory = (): number => {
  fallbackSessionCounter += 1;
  return (Date.now() + fallbackSessionCounter) >>> 0;
};

const commandApplied = (status: 'applied' | 'deduplicated' = 'applied'): AppCommandResult => ({
  ok: true,
  status,
});

const commandInvalid = (message: string): AppCommandResult => ({
  ok: false,
  status: 'invalid-state',
  message,
});

const commandFailed = (message: string): AppCommandResult => ({
  ok: false,
  status: 'failed',
  message,
});

/**
 * Owns the top-level application phase and composes the public system ports.
 * Runtime callbacks remain synchronous at the Phaser boundary; state
 * publication is throttled so a 60 Hz simulation cannot become a 60 Hz DOM
 * render loop.
 */
export class AppController implements AppControllerPort {
  private readonly stateStore: AppStateStore<AppState>;
  private readonly gate: GateSession;
  private readonly simulationFactory: (options?: PlaneShooterSimulationOptions) => PlaneShooterSimulationApi;
  private readonly gameplayConfig: PlaneShooterConfig;
  private readonly sessionIdFactory: () => string;
  private readonly seedFactory: () => number;

  private bootPromise?: Promise<void>;
  private commandTail?: Promise<void>;
  private disposePromise?: Promise<void>;
  private disposed = false;
  private lifecycleMounted = false;
  private runtimeActive = false;
  private runtimeMountPromise?: Promise<{ readonly ok: boolean; readonly error?: Error }>;
  private simulation?: PlaneShooterSimulationApi;
  private gameSnapshot?: PlaneShooterSnapshot;
  private customizationSnapshot?: CustomizationSnapshot;
  private pauseSource: 'user' | 'visibility' = 'user';
  private lastPublishedGameAtMs = Number.NEGATIVE_INFINITY;
  private reactionVoiceIndex = 0;
  private terminalAudioPromise?: Promise<void>;

  public constructor(private readonly dependencies: AppControllerDependencies) {
    this.gate = dependencies.gate ?? new GateSession();
    this.simulationFactory = dependencies.simulationFactory ?? ((options) => createPlaneShooterSimulation(options));
    this.gameplayConfig = dependencies.gameplayConfig ?? PLANE_SHOOTER_PARITY;
    this.sessionIdFactory = dependencies.sessionIdFactory ?? defaultSessionIdFactory;
    this.seedFactory = dependencies.seedFactory ?? defaultSeedFactory;
    this.stateStore = new AppStateStore<AppState>({ kind: 'booting', message: 'Loading Preston vs Particles…' });
  }

  public get state(): Readonly<AppState> {
    return this.stateStore.snapshot;
  }

  public boot(): Promise<void> {
    if (this.disposed) return Promise.resolve();
    if (this.bootPromise) return this.bootPromise;
    if (this.state.kind !== 'booting') return Promise.resolve();
    this.bootPromise = this.performBoot();
    return this.bootPromise;
  }

  public dispatch(command: AppCommand): Promise<AppCommandResult> {
    if (this.disposed) return Promise.resolve(commandFailed('Application controller is disposed.'));

    // Start and audio-retry are gesture commands. Start the unlock operation
    // before joining the serialized command queue so a prior async command
    // cannot move the call behind a promise microtask and lose the browser's
    // trusted gesture activation.
    const gestureUnlock = this.beginGestureUnlock(command);
    const execute = (): Promise<AppCommandResult> => this.handleCommand(command, gestureUnlock);
    const operation = this.commandTail === undefined
      ? execute()
      : this.commandTail.then(execute, execute);
    this.commandTail = operation.then(() => undefined, () => undefined);
    return operation;
  }

  public subscribe(listener: (state: Readonly<AppState>) => void): () => void {
    return this.stateStore.subscribe(listener);
  }

  public assetUrl(key: AssetKey): string {
    return this.dependencies.assets.getRequired(key).url;
  }

  public skinUrl(ref: CharacterSkinRef): string | undefined {
    if (ref.kind === 'packaged') {
      try {
        return this.assetUrl(ref.assetKey);
      } catch {
        return undefined;
      }
    }
    const asset = this.dependencies.customization.getAsset(ref.id);
    if (!asset || asset.revision !== ref.revision) return undefined;
    try {
      return this.dependencies.objectUrls.get(`${ref.id}:${ref.revision}`, asset.blob);
    } catch {
      return undefined;
    }
  }

  public async dispose(): Promise<void> {
    if (this.disposePromise) return this.disposePromise;
    this.disposed = true;
    this.disposePromise = this.performDispose();
    return this.disposePromise;
  }

  private async performBoot(): Promise<void> {
    try {
      const [assetResult, customizationResult] = await Promise.all([
        this.dependencies.assets.loadManifest(),
        this.dependencies.customization.loadSelection(),
      ]);
      if (!assetResult.ok) {
        this.publishFatal({
          code: 'asset-boot-failed',
          message: assetResult.failure.message,
          recoverable: true,
          cause: assetResult.failure,
        });
        return;
      }

      this.customizationSnapshot = customizationResult.snapshot;
      await this.dependencies.audio.initialize?.();
      if (this.dependencies.lifecycle && !this.lifecycleMounted) {
        this.dependencies.lifecycle.mount();
        this.lifecycleMounted = true;
      }
      this.publish({
        kind: 'opening',
        audio: this.dependencies.audio.snapshot(),
      });
    } catch (cause) {
      this.publishFatal({
        code: 'customization-failed',
        message: cause instanceof Error ? cause.message : 'Application boot failed.',
        recoverable: true,
        cause,
      });
    }
  }

  private beginGestureUnlock(command: AppCommand): Promise<AudioCommandResult> | undefined {
    if (command.type === 'START_PRESSED') {
      if (this.state.kind !== 'opening') return undefined;
      this.gate.reset();
      return this.invokeGestureUnlock();
    }
    if (command.type === 'AUDIO_RETRY') {
      if (this.state.kind === 'booting' || this.state.kind === 'fatal-error') return undefined;
      return this.invokeGestureUnlock();
    }
    return undefined;
  }

  private invokeGestureUnlock(): Promise<AudioCommandResult> {
    try {
      // Keep this call itself synchronous. Converting a synchronous adapter
      // throw into a rejected promise preserves the typed command result.
      return this.dependencies.audio.unlockFromUserGesture();
    } catch (cause: unknown) {
      return Promise.reject(cause);
    }
  }

  private async handleCommand(
    command: AppCommand,
    gestureUnlock?: Promise<AudioCommandResult>,
  ): Promise<AppCommandResult> {
    if (this.disposed) return commandFailed('Application controller is disposed.');
    switch (command.type) {
      case 'START_PRESSED':
        return this.handleStart(gestureUnlock);
      case 'AUDIO_RETRY':
        return this.handleAudioRetry(gestureUnlock);
      case 'GATE_ACTION':
        return this.handleGateAction(command.action);
      case 'RETURN_TO_OPENING':
        return this.handleReturnToOpening();
      case 'SELECT_DEFAULT_PLAYER':
        return this.handleSelectionMutation(() => this.dependencies.customization.selectPlayer({
          kind: 'packaged',
          assetKey: PACKAGED_PLAYER_ASSET_KEY,
        }));
      case 'SELECT_CUSTOM_PLAYER':
        return this.handleSelectionMutation(() => this.dependencies.customization.selectPlayer(command.ref));
      case 'SELECT_DEFAULT_ENEMIES':
        return this.handleSelectionMutation(() => this.dependencies.customization.setEnemyRoster(
          PACKAGED_ENEMY_ASSET_KEYS.map((assetKey) => ({ kind: 'packaged', assetKey })),
        ));
      case 'SELECT_CUSTOM_ENEMIES':
        return this.handleSelectionMutation(() => this.dependencies.customization.setEnemyRoster(command.refs));
      case 'PROCESS_UPLOAD':
        return this.handleUpload(command.target, command.file, command.crop);
      case 'DELETE_UPLOAD':
        return this.handleDeleteUpload(command.id);
      case 'CLEAR_CUSTOMIZATIONS':
        return this.handleClearCustomizations();
      case 'ENTER_ARENA':
        return this.handleEnterArena();
      case 'PAUSE_REQUESTED':
        return this.handlePause(command.source ?? 'user');
      case 'RESUME_REQUESTED':
        return this.handleResume();
      case 'RETRY_REQUESTED':
        return this.handleRetry();
      case 'CHANGE_CHARACTERS_REQUESTED':
        return this.handleChangeCharacters();
      case 'MAIN_MENU_REQUESTED':
        return this.handleMainMenu();
      case 'MUTE_CHANGED':
        return this.handleMute(command.muted);
    }
  }

  private handleStart(gestureUnlock?: Promise<AudioCommandResult>): Promise<AppCommandResult> {
    if (this.state.kind === 'gate') return Promise.resolve(commandApplied('deduplicated'));
    if (this.state.kind !== 'opening') return Promise.resolve(commandInvalid('Start is only available on the opening screen.'));

    this.gate.reset();
    // The normal dispatch path has already invoked this from the gesture
    // stack. The fallback keeps direct internal calls safe in tests.
    const unlockPromise = gestureUnlock ?? this.invokeGestureUnlock();
    return unlockPromise.then((unlock) => {
      if (unlock.ok) {
        this.triggerAudio('playMusic', 'opening');
        this.triggerAudio('playVoice', 'start-leon');
      }
      this.publish({
        kind: 'gate',
        gate: this.gate.snapshot(),
        audio: unlock.snapshot,
      });
      return commandApplied();
    }).catch((cause: unknown) => {
      // Unlock failure is recoverable and must not block the joke/gate flow.
      this.publish({
        kind: 'gate',
        gate: this.gate.snapshot(),
        audio: this.dependencies.audio.snapshot(),
      });
      return commandFailed(cause instanceof Error ? cause.message : 'Audio unlock failed.');
    });
  }

  private async handleAudioRetry(gestureUnlock?: Promise<AudioCommandResult>): Promise<AppCommandResult> {
    if (this.state.kind === 'booting' || this.state.kind === 'fatal-error') {
      return commandInvalid('Audio recovery is unavailable before application boot.');
    }
    try {
      const result = await (gestureUnlock ?? this.invokeGestureUnlock());
      if (result.ok) {
        const role = DEFAULT_AUDIO_ROLE_BY_PHASE[this.state.kind];
        if (role) this.triggerAudio('playMusic', role);
      }
      this.refreshAudioState();
      return result.ok ? commandApplied() : commandFailed(result.failure?.message ?? 'Audio remains unavailable.');
    } catch (cause: unknown) {
      this.refreshAudioState();
      return commandFailed(cause instanceof Error ? cause.message : 'Audio unlock failed.');
    }
  }

  private handleGateAction(action: GateAction): Promise<AppCommandResult> {
    if (this.state.kind !== 'gate') return Promise.resolve(commandInvalid('Gate actions are unavailable in the current screen.'));
    const transition = this.gate.dispatch(action);
    if (transition.status === 'rejected') {
      this.publish({
        kind: 'rejected',
        reason: 'question-2-no',
        audio: this.dependencies.audio.snapshot(),
      });
      return Promise.resolve(commandApplied());
    }
    if (transition.status === 'passed') {
      this.publishCustomizing();
      return Promise.resolve(commandApplied());
    }
    this.publish({
      kind: 'gate',
      gate: transition.snapshot,
      audio: this.dependencies.audio.snapshot(),
    });
    return Promise.resolve(
      transition.status === 'invalid-action'
        ? commandInvalid('The gate action is invalid at the current step.')
        : commandApplied(),
    );
  }

  private async handleReturnToOpening(): Promise<AppCommandResult> {
    if (this.state.kind !== 'rejected' && this.state.kind !== 'customizing') {
      return commandInvalid('Return to opening is unavailable in the current screen.');
    }
    await this.returnToOpening();
    return commandApplied();
  }

  private async handleSelectionMutation(
    mutate: () => CustomizationMutationResult,
  ): Promise<AppCommandResult> {
    if (this.state.kind !== 'customizing') return commandInvalid('Character selection is unavailable in the current screen.');
    const result = mutate();
    if (!result.ok) {
      this.publishCustomizing(undefined, result.error.message);
      return commandFailed(result.error.message);
    }
    const saved = await this.dependencies.customization.saveSelection(result.selection);
    if (!saved.ok) {
      this.customizationSnapshot = result.snapshot;
      this.publishCustomizing(undefined, saved.error.message);
      return commandFailed(saved.error.message);
    }
    this.customizationSnapshot = saved.snapshot;
    this.retainSelectedObjectUrls(saved.selection);
    this.publishCustomizing();
    return commandApplied();
  }

  private async handleUpload(target: CharacterRole, file: Blob, crop: CropSettings): Promise<AppCommandResult> {
    if (this.state.kind !== 'customizing') return commandInvalid('Uploads are unavailable in the current screen.');
    const processed = await this.dependencies.customization.processUpload(
      { file, mimeType: file.type, role: target, target },
      { crop, role: target },
    );
    if (!processed.ok) {
      this.publishCustomizing(undefined, processed.error.message);
      return commandFailed(processed.error.message);
    }

    const selection = this.dependencies.customization.getSelection();
    const nextSelection: CharacterSelection = target === 'player'
      ? { player: processed.ref, enemies: selection.enemies }
      : {
          player: selection.player,
          // The packaged roster is a default, not a prefix for uploaded
          // enemies. The first local enemy replaces it; later local uploads
          // extend the already-custom roster.
          enemies: selection.enemies.some((ref) => ref.kind === 'local-upload')
            ? [...selection.enemies, processed.ref]
            : [processed.ref],
        };
    const selected = this.dependencies.customization.setSelection(nextSelection);
    if (!selected.ok) {
      this.publishCustomizing(undefined, selected.error.message);
      return commandFailed(selected.error.message);
    }
    const saved = await this.dependencies.customization.saveSelection(selected.selection);
    if (!saved.ok) {
      this.customizationSnapshot = selected.snapshot;
      this.publishCustomizing(undefined, saved.error.message);
      return commandFailed(saved.error.message);
    }
    this.customizationSnapshot = saved.snapshot;
    this.retainSelectedObjectUrls(saved.selection);
    this.publishCustomizing();
    return commandApplied();
  }

  private async handleDeleteUpload(id: string): Promise<AppCommandResult> {
    if (this.state.kind !== 'customizing') return commandInvalid('Upload deletion is unavailable in the current screen.');
    const result = await this.dependencies.customization.deleteUpload(id);
    if (!result.ok) {
      this.publishCustomizing(undefined, result.error.message);
      return commandFailed(result.error.message);
    }
    this.customizationSnapshot = result.snapshot;
    this.retainSelectedObjectUrls(result.selection);
    this.publishCustomizing();
    return commandApplied();
  }

  private async handleClearCustomizations(): Promise<AppCommandResult> {
    if (this.state.kind !== 'customizing') return commandInvalid('Customization clearing is unavailable in the current screen.');
    const result = await this.dependencies.customization.clearLocalData();
    if (!result.ok) {
      this.publishCustomizing(undefined, result.error.message);
      return commandFailed(result.error.message);
    }
    this.customizationSnapshot = result.snapshot;
    this.dependencies.objectUrls.clear();
    this.publishCustomizing();
    return commandApplied();
  }

  private async handleEnterArena(): Promise<AppCommandResult> {
    if (this.state.kind === 'loading-game' || this.state.kind === 'playing' || this.state.kind === 'paused') {
      return commandApplied('deduplicated');
    }
    if (this.state.kind !== 'customizing') return commandInvalid('Enter Arena is unavailable in the current screen.');
    return this.startArena();
  }

  /** Starts a fresh simulation for both first entry and Retry. */
  private async startArena(): Promise<AppCommandResult> {
    if (this.runtimeMountPromise) return commandApplied('deduplicated');

    const selection = this.customizationSnapshot?.selection ?? this.dependencies.customization.getSelection();
    this.customizationSnapshot ??= this.dependencies.customization.getSnapshot();
    this.publish({
      kind: 'loading-game',
      message: 'Loading the arena…',
      audio: this.dependencies.audio.snapshot(),
    });

    try {
      await this.disposeRuntimeOnly();
      const simulation = this.simulationFactory({ config: this.gameplayConfig });
      const sessionId = this.sessionIdFactory();
      const seed = this.seedFactory();
      const initialSnapshot = simulation.start({
        sessionId,
        seed,
        appearance: this.toGameplayAppearance(selection),
      });
      this.simulation = simulation;
      this.gameSnapshot = initialSnapshot;
      await this.waitForTerminalAudio();
      // Audio failure is recoverable: the arena must still mount silently.
      await this.dependencies.audio.playMusic('gameplay').catch(() => undefined);
      const textures = this.runtimeTextures(selection);
      const mountInput: RuntimeMountInput = {
        container: this.dependencies.runtimeContainer,
        textures,
        initialSnapshot,
        logicalWidth: this.gameplayConfig.camera.logicalWidth,
        logicalHeight: this.gameplayConfig.camera.logicalHeight,
        cameraBounds: {
          minX: this.gameplayConfig.camera.minX,
          maxX: this.gameplayConfig.camera.maxX,
          minY: this.gameplayConfig.camera.minY,
          maxY: this.gameplayConfig.camera.maxY,
        },
        backgroundScrollSpeeds: this.gameplayConfig.background.scrollingSpeeds,
        fixedStepHz: this.gameplayConfig.fixedStepHz,
        step: (input) => this.stepRuntime(input),
        onReady: () => {
          if (this.disposed || this.state.kind !== 'loading-game') return;
          this.publishPlaying(this.gameSnapshot ?? initialSnapshot, true);
        },
        onFatal: (error) => this.handleRuntimeFatal(error),
      };
      this.runtimeActive = true;
      const mountPromise = this.dependencies.runtime.mount(mountInput);
      this.runtimeMountPromise = mountPromise;
      const mounted = await mountPromise;
      this.runtimeMountPromise = undefined;
      if (!mounted.ok) {
        await this.handleRuntimeMountFailure(mounted.error);
        return commandFailed(mounted.error.message);
      }
      if (this.state.kind === 'loading-game') {
        this.publishPlaying(this.gameSnapshot ?? initialSnapshot, true);
      }
      return commandApplied();
    } catch (cause) {
      this.runtimeMountPromise = undefined;
      const error = cause instanceof Error ? cause : new Error(String(cause));
      await this.handleRuntimeMountFailure(error);
      return commandFailed(error.message);
    }
  }

  private handlePause(source: 'user' | 'visibility'): Promise<AppCommandResult> {
    if (this.state.kind === 'paused') return Promise.resolve(commandApplied('deduplicated'));
    if (this.state.kind !== 'playing' || !this.simulation) return Promise.resolve(commandInvalid('Pause is unavailable outside gameplay.'));
    const snapshot = this.simulation.pause();
    this.gameSnapshot = snapshot;
    this.pauseSource = source;
    this.dependencies.runtime.pause();
    this.pauseAudioForGameplay();
    this.publish({
      kind: 'paused',
      game: snapshot,
      audio: this.dependencies.audio.snapshot(),
      source,
    });
    return Promise.resolve(commandApplied());
  }

  private async handleResume(): Promise<AppCommandResult> {
    if (this.state.kind === 'playing') return commandApplied('deduplicated');
    if (this.state.kind !== 'paused' || !this.simulation) return commandInvalid('Resume is unavailable outside a paused game.');
    const snapshot = this.simulation.resume();
    this.gameSnapshot = snapshot;
    this.dependencies.runtime.resume();
    await this.resumeAudioAfterGameplay();
    this.publishPlaying(snapshot, true);
    return commandApplied();
  }

  private async handleRetry(): Promise<AppCommandResult> {
    if (this.state.kind === 'loading-game') return commandApplied('deduplicated');
    if (this.state.kind !== 'game-over') return commandInvalid('Retry is available only after Game Over.');
    return this.startArena();
  }

  private async handleChangeCharacters(): Promise<AppCommandResult> {
    if (this.state.kind !== 'game-over' && this.state.kind !== 'playing' && this.state.kind !== 'paused') {
      return commandInvalid('Character changes are available after gameplay.');
    }
    await this.disposeRuntimeOnly();
    await this.waitForTerminalAudio();
    await this.dependencies.audio.stopAll();
    await this.dependencies.audio.playMusic('opening');
    this.publishCustomizing();
    return commandApplied();
  }

  private async handleMainMenu(): Promise<AppCommandResult> {
    if (this.state.kind === 'booting' || this.state.kind === 'fatal-error' || this.state.kind === 'opening') {
      return commandInvalid('Main Menu is unavailable in the current screen.');
    }
    await this.returnToOpening();
    return commandApplied();
  }

  private handleMute(muted: boolean): Promise<AppCommandResult> {
    this.dependencies.audio.setMuted(muted);
    this.refreshAudioState();
    return Promise.resolve(commandApplied());
  }

  private async returnToOpening(): Promise<void> {
    await this.disposeRuntimeOnly();
    await this.waitForTerminalAudio();
    await this.dependencies.audio.stopAll();
    this.gate.reset();
    await this.dependencies.audio.playMusic('opening');
    this.publish({ kind: 'opening', audio: this.dependencies.audio.snapshot() });
  }

  private async disposeRuntimeOnly(): Promise<void> {
    if (this.runtimeMountPromise) {
      await this.runtimeMountPromise.catch(() => undefined);
      this.runtimeMountPromise = undefined;
    }
    if (this.runtimeActive) {
      try {
        await this.dependencies.runtime.dispose();
      } catch {
        // Runtime teardown is best-effort; simulation and URL cleanup still
        // need to run when a renderer throws during destruction.
      }
      this.runtimeActive = false;
    }
    if (this.simulation) {
      try {
        this.simulation.dispose();
      } catch {
        // A faulty simulation must not prevent the controller from releasing
        // its remaining resources.
      }
      this.simulation = undefined;
    }
    this.gameSnapshot = undefined;
  }

  private async handleRuntimeMountFailure(error: Error): Promise<void> {
    await this.disposeRuntimeOnly();
    await this.dependencies.audio.stopAll().catch(() => undefined);
    await this.dependencies.audio.playMusic('opening').catch(() => undefined);
    if (!this.disposed && this.state.kind !== 'customizing') {
      this.publishCustomizing(undefined, error.message);
    }
  }

  private handleRuntimeFatal(error: Error): void {
    if (this.disposed) return;
    void this.handleRuntimeMountFailure(error);
  }

  private stepRuntime(input: PlaneShooterInputFrame): RuntimeStepResult {
    const simulation = this.simulation;
    if (!simulation) {
      throw new Error('Gameplay runtime requested a step before simulation start.');
    }
    const events = simulation.advanceFixedStep(input);
    const snapshot = simulation.snapshot();
    this.gameSnapshot = snapshot;
    this.handleGameEvents(events, snapshot);
    if (this.state.kind === 'playing' && this.shouldPublishGame(snapshot, events)) {
      this.publishPlaying(snapshot);
    }
    return { snapshot, events };
  }

  private handleGameEvents(events: readonly GameEvent[], snapshot: PlaneShooterSnapshot): void {
    const terminalEvent = events.find((event): event is Extract<GameEvent, { type: 'GameOver' }> => event.type === 'GameOver');
    for (const event of events) {
      switch (event.type) {
        case 'ProjectileSpawned':
          this.dependencies.audio.playSfx('shoot');
          break;
        case 'PlayerDamaged':
          // A terminal frame can contain damage and GameOver together;
          // only the seeded terminal reaction should be spoken in that case.
          if (!terminalEvent) this.triggerAudio('playVoice', this.nextReactionVoice());
          break;
        case 'GameOver':
          this.dependencies.runtime.pause();
          this.publish({
            kind: 'game-over',
            game: snapshot,
            result: event.result,
            audio: this.dependencies.audio.snapshot(),
          });
          this.playTerminalReaction(event.result);
          break;
        case 'EnemySpawned':
        case 'EnemyHit':
        case 'EnemyDestroyed':
        case 'ScoreChanged':
          break;
      }
    }
  }

  private shouldPublishGame(snapshot: PlaneShooterSnapshot, events: readonly GameEvent[]): boolean {
    const hudChanged = events.some(
      (event) => event.type === 'ScoreChanged' || event.type === 'PlayerDamaged',
    );
    if (hudChanged) return true;
    // Renderer/audio events still flow through the runtime immediately. They do
    // not change any DOM HUD value, so avoid synchronously waking the presenter
    // on the same frame as a shot, spawn, or hit effect.
    if (events.length > 0) return false;
    if (snapshot.elapsedSeconds * 1_000 - this.lastPublishedGameAtMs < GAME_PUBLISH_INTERVAL_MS) return false;
    return true;
  }

  private publishPlaying(snapshot: PlaneShooterSnapshot, force = false): void {
    if (!force && this.state.kind !== 'playing') return;
    this.lastPublishedGameAtMs = snapshot.elapsedSeconds * 1_000;
    this.publish({ kind: 'playing', game: snapshot, audio: this.dependencies.audio.snapshot() });
  }

  private nextReactionVoice(): 'player-jimmy' | 'player-zac' {
    const voice = this.reactionVoiceIndex % 2 === 0 ? 'player-jimmy' : 'player-zac';
    this.reactionVoiceIndex += 1;
    return voice;
  }

  private terminalReactionVoice(result: PlaneShooterResult): 'player-jimmy' | 'player-zac' {
    return ((result.seed + result.finalScore) & 1) === 0 ? 'player-jimmy' : 'player-zac';
  }

  private pauseAudioForGameplay(): void {
    if (this.dependencies.audio.pause) {
      this.dependencies.audio.pause();
      return;
    }
    // AudioCoordinator's visibility pause is also the portable pause/resume
    // operation. The app-owned optional hooks let richer adapters preserve a
    // distinct user-pause flag without widening the system contract.
    this.dependencies.audio.pauseForVisibility();
  }

  private async resumeAudioAfterGameplay(): Promise<void> {
    if (this.dependencies.audio.resume) {
      await this.dependencies.audio.resume();
      return;
    }
    await this.dependencies.audio.resumeFromVisibility();
  }

  private playTerminalReaction(result: PlaneShooterResult): void {
    const voice = this.terminalReactionVoice(result);
    const operation = this.dependencies.audio.stopAll()
      .then(() => this.dependencies.audio.playVoice(voice))
      .then(() => this.refreshAudioState())
      .catch(() => this.refreshAudioState());
    this.terminalAudioPromise = operation;
    void operation.then(
      () => {
        if (this.terminalAudioPromise === operation) this.terminalAudioPromise = undefined;
      },
      () => {
        if (this.terminalAudioPromise === operation) this.terminalAudioPromise = undefined;
      },
    );
  }

  private async waitForTerminalAudio(): Promise<void> {
    await this.terminalAudioPromise?.catch(() => undefined);
  }

  private triggerAudio(method: 'playMusic', role: MusicRole): void;
  private triggerAudio(method: 'playVoice', role: 'start-leon' | 'player-jimmy' | 'player-zac'): void;
  private triggerAudio(method: 'stopAll'): void;
  private triggerAudio(
    method: 'playMusic' | 'playVoice' | 'stopAll',
    role?: MusicRole | 'start-leon' | 'player-jimmy' | 'player-zac',
  ): void {
    let operation: Promise<unknown>;
    if (method === 'playMusic' && role && (role === 'opening' || role === 'gameplay')) {
      operation = this.dependencies.audio.playMusic(role);
    } else if (method === 'playVoice' && role && role !== 'opening' && role !== 'gameplay') {
      operation = this.dependencies.audio.playVoice(role);
    } else {
      operation = this.dependencies.audio.stopAll();
    }
    void operation.then(() => this.refreshAudioState()).catch(() => this.refreshAudioState());
  }

  private refreshAudioState(): void {
    if (this.disposed) return;
    const audio = this.dependencies.audio.snapshot();
    const current = this.state;
    switch (current.kind) {
      case 'opening':
        this.publish({ kind: 'opening', audio });
        break;
      case 'gate':
        this.publish({ kind: 'gate', gate: current.gate, audio });
        break;
      case 'rejected':
        this.publish({ kind: 'rejected', reason: current.reason, audio });
        break;
      case 'customizing':
        this.publish({ kind: 'customizing', customization: current.customization, audio, ...(current.message ? { message: current.message } : {}), ...(current.error ? { error: current.error } : {}) });
        break;
      case 'loading-game':
        this.publish({ kind: 'loading-game', message: current.message, audio });
        break;
      case 'playing':
        this.publish({ kind: 'playing', game: current.game, audio });
        break;
      case 'paused':
        this.publish({ kind: 'paused', game: current.game, audio, source: current.source });
        break;
      case 'game-over':
        this.publish({ kind: 'game-over', game: current.game, result: current.result, audio });
        break;
      case 'booting':
      case 'fatal-error':
        break;
    }
  }

  private publishCustomizing(message?: string, error?: string): void {
    this.customizationSnapshot ??= this.dependencies.customization.getSnapshot();
    this.publish({
      kind: 'customizing',
      customization: this.customizationSnapshot,
      audio: this.dependencies.audio.snapshot(),
      ...(message ? { message } : {}),
      ...(error ? { error } : {}),
    });
  }

  private retainSelectedObjectUrls(selection: CharacterSelection): void {
    const keys = new Set<string>();
    const refs = [selection.player, ...selection.enemies];
    for (const ref of refs) {
      if (ref.kind === 'local-upload') keys.add(`${ref.id}:${ref.revision}`);
    }
    this.dependencies.objectUrls.retain(keys);
  }

  private runtimeTextures(selection: CharacterSelection): RuntimeTextureSet {
    const packaged = (key: AssetKey): RuntimeTextureSource => ({
      appearanceKey: key,
      url: this.assetUrl(key),
    });
    const skin = (ref: CharacterSkinRef): RuntimeTextureSource => {
      if (ref.kind === 'packaged') return packaged(ref.assetKey);
      const url = this.skinUrl(ref);
      if (!url) throw new Error(`Selected local character ${ref.id} is unavailable.`);
      return { appearanceKey: `${ref.id}:${ref.revision}`, url };
    };
    return {
      background: packaged('background.gameplayMirrorSupertile'),
      backgroundFallback: packaged('background.gameplayFixed'),
      player: skin(selection.player),
      enemies: selection.enemies.map(skin),
      projectile: packaged('projectile.default'),
      knob: packaged('ui.knob'),
    };
  }

  private toGameplayAppearance(selection: CharacterSelection): PlaneShooterAppearance {
    const ref = (skin: CharacterSkinRef): string =>
      skin.kind === 'packaged'
        ? skin.assetKey
        : `${skin.id}:${skin.revision}`;
    return {
      player: ref(selection.player),
      enemies: selection.enemies.map(ref),
      enemyAppearanceMode: selection.enemies.every((skin) => skin.kind === 'packaged') &&
        selection.enemies.length === PACKAGED_ENEMY_ASSET_KEYS.length
        ? 'definition-mapped'
        : 'pool',
    };
  }

  private publishFatal(failure: AppFailure): void {
    this.publish({
      kind: 'fatal-error',
      failure,
      audio: this.dependencies.audio.snapshot(),
    });
  }

  private publish(next: AppState): void {
    if (this.disposed) return;
    this.stateStore.set(next);
  }

  private async performDispose(): Promise<void> {
    if (this.lifecycleMounted) {
      try {
        this.dependencies.lifecycle?.dispose();
      } catch {
        // Continue releasing the remaining application resources.
      }
      this.lifecycleMounted = false;
    }
    await this.waitForTerminalAudio();
    try {
      await this.disposeRuntimeOnly();
    } catch {
      // Runtime disposal is best-effort and must not block audio/URL cleanup.
    }
    try {
      await this.dependencies.audio.stopAll();
    } catch {
      // Continue with driver disposal even if stopping media fails.
    }
    try {
      await this.dependencies.audio.dispose?.();
    } catch {
      // Best-effort disposal boundary.
    }
    try {
      this.dependencies.objectUrls.clear();
    } catch {
      // Best-effort URL cleanup boundary.
    }
    this.stateStore.clear();
  }
}

export const createAppController = (dependencies: AppControllerDependencies): AppController =>
  new AppController(dependencies);
