import manifest from '../../public/assets/asset-manifest.json';
import { describe, expect, it } from 'vitest';
import { AppController, type AppAudioPort, type AppControllerDependencies, type AppLifecyclePort, type AppObjectUrlPort } from '../../src/app/AppController';
import type { RuntimeMountInput, RuntimeMountResult, RuntimeStepResult, GameRuntimePort } from '../../src/app/runtimePort';
import { AssetCatalog, type AssetCatalogPort, type AssetManifestLoader } from '../../src/systems/assets';
import type {
  AudioCommandResult,
  AudioMusicOptions,
  AudioSnapshot,
  AudioState,
  MusicRole,
  VoiceRole,
} from '../../src/systems/audio';
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
} from '../../src/systems/customization';
import type {
  GameEvent,
  PlaneShooterAppearance,
  PlaneShooterCommand,
  PlaneShooterCommandResult,
  PlaneShooterInputFrame,
  PlaneShooterResult,
  PlaneShooterSimulationApi,
  PlaneShooterSimulationOptions,
  PlaneShooterSnapshot,
  StartRunCommand,
} from '../../src/systems/gameplay';
import { createPlaneShooterSimulation } from '../../src/systems/gameplay';

const crop: CropSettings = { panX: 0, panY: 0, zoom: 1 };
type CustomizationPort = AppControllerDependencies['customization'];

const cloneRef = (ref: CharacterSkinRef): CharacterSkinRef =>
  ref.kind === 'packaged' ? { ...ref } : { ...ref };

const cloneSelection = (selection: CharacterSelection): CharacterSelection => ({
  player: cloneRef(selection.player),
  enemies: selection.enemies.map(cloneRef),
});

const defaultSelection = (): CharacterSelection => ({
  player: { kind: 'packaged', assetKey: PACKAGED_PLAYER_ASSET_KEY },
  enemies: PACKAGED_ENEMY_ASSET_KEYS.map((assetKey) => ({ kind: 'packaged', assetKey })),
});

class FakeCustomization implements CustomizationPort {
  public saveCalls = 0;
  private readonly customAssets: CustomAssetRecord[] = [];
  private selection = defaultSelection();
  private revision = 0;
  private nextId = 1;

  public loadSelection(): Promise<CustomizationLoadResult> {
    return Promise.resolve({
      ok: true,
      status: 'loaded',
      source: 'defaults',
      selection: this.getSelection(),
      snapshot: this.getSnapshot(),
    });
  }

  public processUpload(
    input: { readonly file: Blob; readonly mimeType?: string; readonly role?: CharacterRole; readonly target?: CharacterRole },
    options: { readonly crop: CropSettings; readonly role: CharacterRole; readonly operationId?: string },
  ): Promise<ImageProcessingResult> {
    const role = options.role;
    const id = `custom-${this.nextId++}`;
    const revision = this.customAssets.length + 1;
    const image = {
      blob: input.file,
      mimeType: 'image/png' as const,
      width: 512 as const,
      height: 512 as const,
      sourceMimeType: 'image/png' as const,
      sourceWidth: 512,
      sourceHeight: 512,
      crop: options.crop,
    };
    const asset: CustomAssetRecord = { ...image, id, revision, role };
    this.customAssets.push(asset);
    const ref: CharacterSkinRef = { kind: 'local-upload', id, revision };
    return Promise.resolve({
      ok: true,
      status: 'processed',
      operationId: options.operationId ?? `upload-${id}`,
      revision,
      role,
      ref,
      asset,
      image,
    });
  }

  public getSnapshot(): CustomizationSnapshot {
    return {
      selection: this.getSelection(),
      assets: this.customAssets.map((asset) => ({ ...asset, crop: { ...asset.crop } })),
      revision: this.revision,
      persistence: 'memory',
    };
  }

  public getSelection(): CharacterSelection {
    return cloneSelection(this.selection);
  }

  public getAsset(id: string): CustomAssetRecord | undefined {
    const asset = this.customAssets.find((candidate) => candidate.id === id);
    return asset === undefined ? undefined : { ...asset, crop: { ...asset.crop } };
  }

  public selectPlayer(ref: CharacterSkinRef): CustomizationMutationResult {
    return this.setSelection({ player: ref, enemies: this.selection.enemies });
  }

  public setEnemyRoster(refs: readonly CharacterSkinRef[]): CustomizationMutationResult {
    return this.setSelection({ player: this.selection.player, enemies: refs });
  }

  public setSelection(selection: CharacterSelection): CustomizationMutationResult {
    this.selection = cloneSelection(selection);
    this.revision += 1;
    return { ok: true, status: 'updated', selection: this.getSelection(), snapshot: this.getSnapshot() };
  }

  public addEnemy(ref: CharacterSkinRef): CustomizationMutationResult {
    return this.setEnemyRoster([...this.selection.enemies, ref]);
  }

  public deleteUpload(id: string): Promise<CustomizationDeleteResult> {
    const index = this.customAssets.findIndex((asset) => asset.id === id);
    if (index >= 0) this.customAssets.splice(index, 1);
    return Promise.resolve({
      ok: true,
      status: 'deleted',
      selection: this.getSelection(),
      snapshot: this.getSnapshot(),
      persisted: false,
    });
  }

  public clearLocalData(): Promise<CustomizationClearResult> {
    this.customAssets.splice(0);
    this.selection = defaultSelection();
    this.revision += 1;
    return Promise.resolve({
      ok: true,
      status: 'cleared',
      selection: this.getSelection(),
      snapshot: this.getSnapshot(),
      persisted: false,
    });
  }

  public saveSelection(selection: CharacterSelection = this.selection): Promise<CustomizationSaveResult> {
    this.saveCalls += 1;
    this.selection = cloneSelection(selection);
    this.revision += 1;
    return Promise.resolve({
      ok: true,
      status: 'saved',
      persisted: false,
      selection: this.getSelection(),
      snapshot: this.getSnapshot(),
    });
  }
}

class FakeAudio implements AppAudioPort {
  public readonly calls: string[] = [];
  public muted = false;
  public musicRole: MusicRole | undefined;
  public state: AudioState = 'locked';
  public pauseCalls = 0;
  public resumeCalls = 0;
  public stopCalls = 0;
  public disposeCalls = 0;

  public initialize(): Promise<void> {
    this.calls.push('initialize');
    return Promise.resolve();
  }

  public unlockFromUserGesture(): Promise<AudioCommandResult> {
    this.calls.push('unlock');
    this.state = 'ready';
    return Promise.resolve({ ok: true, snapshot: this.snapshot() });
  }

  public playMusic(role: MusicRole, _options?: AudioMusicOptions): Promise<AudioCommandResult> {
    this.calls.push(`music:${role}`);
    this.musicRole = role;
    return Promise.resolve({ ok: true, snapshot: this.snapshot() });
  }

  public playVoice(role: VoiceRole): Promise<AudioCommandResult> {
    this.calls.push(`voice:${role}`);
    return Promise.resolve({ ok: true, snapshot: this.snapshot() });
  }

  public playSfx(role: 'shoot'): AudioCommandResult {
    this.calls.push(`sfx:${role}`);
    return { ok: true, snapshot: this.snapshot() };
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    this.calls.push(`muted:${String(muted)}`);
  }

  public pause(): void {
    this.pauseCalls += 1;
    this.calls.push('pause');
  }

  public resume(): Promise<void> {
    this.resumeCalls += 1;
    this.calls.push('resume');
    return Promise.resolve();
  }

  public pauseForVisibility(): void {
    this.pauseCalls += 1;
    this.calls.push('pause:visibility');
  }

  public resumeFromVisibility(): Promise<AudioCommandResult> {
    this.resumeCalls += 1;
    this.calls.push('resume:visibility');
    return Promise.resolve({ ok: true, snapshot: this.snapshot() });
  }

  public stopAll(): Promise<void> {
    this.stopCalls += 1;
    this.calls.push('stop');
    this.musicRole = undefined;
    return Promise.resolve();
  }

  public snapshot(): AudioSnapshot {
    return {
      state: this.state,
      muted: this.muted,
      visibilityPaused: false,
      ...(this.musicRole === undefined ? {} : { musicRole: this.musicRole }),
      activeSfxVoices: 0,
      unlockAttempts: this.state === 'locked' ? 0 : 1,
    };
  }

  public dispose(): Promise<void> {
    this.disposeCalls += 1;
    this.calls.push('dispose');
    return Promise.resolve();
  }
}

class FakeObjectUrls implements AppObjectUrlPort {
  public readonly retained = new Set<string>();
  public clearCalls = 0;

  public get(key: string): string {
    this.retained.add(key);
    return `blob:${key}`;
  }

  public retain(keys: ReadonlySet<string>): void {
    this.retained.clear();
    for (const key of keys) this.retained.add(key);
  }

  public clear(): void {
    this.clearCalls += 1;
    this.retained.clear();
  }
}

class FakeLifecycle implements AppLifecyclePort {
  public mountCalls = 0;
  public disposeCalls = 0;

  public mount(): void {
    this.mountCalls += 1;
  }

  public dispose(): void {
    this.disposeCalls += 1;
  }
}

class FakeSimulation implements PlaneShooterSimulationApi {
  public readonly starts: Array<{ appearance?: PlaneShooterAppearance; sessionId: string; seed: number }> = [];
  public readonly config;
  public disposed = false;
  private current: PlaneShooterSnapshot;
  private queuedEvents: readonly GameEvent[] = [];
  private readonly actual;

  public constructor(options?: PlaneShooterSimulationOptions) {
    this.actual = createPlaneShooterSimulation(options);
    this.config = this.actual.config;
    this.current = this.actual.start({ sessionId: 'initial', seed: 1 });
  }

  public queue(events: readonly GameEvent[]): void {
    this.queuedEvents = events;
  }

  public start(command: StartRunCommand): PlaneShooterSnapshot {
    this.starts.push({ sessionId: command.sessionId, seed: command.seed, appearance: command.appearance });
    this.current = this.actual.start(command);
    return this.current;
  }

  public dispatch(command: PlaneShooterCommand): PlaneShooterCommandResult {
    const result = this.actual.dispatch(command);
    this.current = result.snapshot;
    return result;
  }

  public advanceFixedStep(_input?: PlaneShooterInputFrame): readonly GameEvent[] {
    const events = this.queuedEvents;
    this.queuedEvents = [];
    const terminal = events.find((event): event is Extract<GameEvent, { type: 'GameOver' }> => event.type === 'GameOver');
    if (terminal) {
      this.current = {
        ...this.current,
        lifecycle: 'gameOver',
        player: { ...this.current.player, health: 0 },
        result: terminal.result,
      };
    }
    return events;
  }

  public pause(): PlaneShooterSnapshot {
    this.current = { ...this.current, lifecycle: 'paused' };
    return this.current;
  }

  public resume(): PlaneShooterSnapshot {
    this.current = { ...this.current, lifecycle: 'running' };
    return this.current;
  }

  public snapshot(): PlaneShooterSnapshot {
    return this.current;
  }

  public dispose(): void {
    this.disposed = true;
  }
}

class FakeRuntime implements GameRuntimePort {
  public mountCalls = 0;
  public pauseCalls = 0;
  public resumeCalls = 0;
  public disposeCalls = 0;
  public lastMount?: RuntimeMountInput;

  public mount(input: RuntimeMountInput): Promise<RuntimeMountResult> {
    this.mountCalls += 1;
    this.lastMount = input;
    input.onReady?.();
    return Promise.resolve({ ok: true });
  }

  public step(input: PlaneShooterInputFrame = {}): RuntimeStepResult {
    if (this.lastMount === undefined) throw new Error('Runtime has not mounted.');
    return this.lastMount.step(input);
  }

  public pause(): void {
    this.pauseCalls += 1;
  }

  public resume(): void {
    this.resumeCalls += 1;
  }

  public dispose(): Promise<void> {
    this.disposeCalls += 1;
    return Promise.resolve();
  }
}

const createFixture = (): {
  app: AppController;
  audio: FakeAudio;
  customization: FakeCustomization;
  runtime: FakeRuntime;
  lifecycle: FakeLifecycle;
  objectUrls: FakeObjectUrls;
  simulations: FakeSimulation[];
} => {
  const loader: AssetManifestLoader = { load: async () => manifest };
  const assets: AssetCatalogPort = new AssetCatalog(loader);
  const audio = new FakeAudio();
  const customization = new FakeCustomization();
  const runtime = new FakeRuntime();
  const lifecycle = new FakeLifecycle();
  const objectUrls = new FakeObjectUrls();
  const simulations: FakeSimulation[] = [];
  const dependencies: AppControllerDependencies = {
    assets,
    audio,
    customization,
    runtime,
    runtimeContainer: {} as HTMLElement,
    objectUrls,
    lifecycle,
    sessionIdFactory: (() => {
      let count = 0;
      return () => `session-${++count}`;
    })(),
    seedFactory: (() => {
      let count = 100;
      return () => ++count;
    })(),
    simulationFactory: (options) => {
      const simulation = new FakeSimulation(options);
      simulations.push(simulation);
      return simulation;
    },
  };
  return {
    app: new AppController(dependencies),
    audio,
    customization,
    runtime,
    lifecycle,
    objectUrls,
    simulations,
  };
};

const openGate = async (app: AppController): Promise<void> => {
  await app.boot();
  await app.dispatch({ type: 'START_PRESSED' });
  await app.dispatch({ type: 'GATE_ACTION', action: { type: 'ANSWER_Q1_YES' } });
  await app.dispatch({ type: 'GATE_ACTION', action: { type: 'ANSWER_Q2', answer: 'yes' } });
  await app.dispatch({ type: 'GATE_ACTION', action: { type: 'SUBMIT_CODE', value: ' basic ' } });
};

describe('AppController integration', () => {
  it('boots, unlocks synchronously from Start, and enforces rejection/pass gate flows', async () => {
    const fixture = createFixture();
    await fixture.app.boot();
    expect(fixture.app.state.kind).toBe('opening');
    const start = fixture.app.dispatch({ type: 'START_PRESSED' });
    expect(fixture.audio.calls[fixture.audio.calls.length - 1]).toBe('unlock');
    await start;
    expect(fixture.app.state).toMatchObject({ kind: 'gate', gate: { step: 'question-1' } });

    await fixture.app.dispatch({ type: 'GATE_ACTION', action: { type: 'ANSWER_Q1_YES' } });
    await fixture.app.dispatch({ type: 'GATE_ACTION', action: { type: 'ANSWER_Q2', answer: 'no' } });
    expect(fixture.app.state).toMatchObject({ kind: 'rejected', reason: 'question-2-no' });
    await fixture.app.dispatch({ type: 'RETURN_TO_OPENING' });
    expect(fixture.app.state.kind).toBe('opening');

    await openGate(fixture.app);
    expect(fixture.app.state).toMatchObject({ kind: 'customizing', customization: { selection: defaultSelection() } });
    await fixture.app.dispose();
  });

  it('replaces packaged enemy defaults on first upload, appends local roster uploads, and saves selections', async () => {
    const fixture = createFixture();
    await openGate(fixture.app);
    const file = new Blob(['enemy'], { type: 'image/png' });

    await fixture.app.dispatch({ type: 'PROCESS_UPLOAD', target: 'enemy', file, crop });
    const first = fixture.app.state;
    if (first.kind !== 'customizing') throw new Error('Expected customization state.');
    expect(first.customization.selection.enemies).toHaveLength(1);
    expect(first.customization.selection.enemies[0]?.kind).toBe('local-upload');

    await fixture.app.dispatch({ type: 'PROCESS_UPLOAD', target: 'enemy', file, crop });
    const second = fixture.app.state;
    if (second.kind !== 'customizing') throw new Error('Expected customization state.');
    expect(second.customization.selection.enemies).toHaveLength(2);
    expect(fixture.customization.saveCalls).toBe(2);

    await fixture.app.dispatch({ type: 'SELECT_DEFAULT_PLAYER' });
    expect(fixture.customization.saveCalls).toBe(3);
    await fixture.app.dispose();
  });

  it('mounts a fresh deterministic arena, maps local appearance URLs, routes semantic events, and retries', async () => {
    const fixture = createFixture();
    await openGate(fixture.app);
    const file = new Blob(['player'], { type: 'image/png' });
    await fixture.app.dispatch({ type: 'PROCESS_UPLOAD', target: 'player', file, crop });
    await fixture.app.dispatch({ type: 'PROCESS_UPLOAD', target: 'enemy', file, crop });
    await fixture.app.dispatch({ type: 'ENTER_ARENA' });

    expect(fixture.app.state.kind).toBe('playing');
    expect(fixture.runtime.mountCalls).toBe(1);
    const firstSimulation = fixture.simulations[0];
    if (!firstSimulation || !fixture.runtime.lastMount) throw new Error('Arena did not initialize.');
    expect(firstSimulation.starts[0]?.sessionId).toBe('session-1');
    expect(firstSimulation.starts[0]?.seed).toBe(101);
    expect(firstSimulation.starts[0]?.appearance).toMatchObject({
      player: 'custom-1:1',
      enemies: ['custom-2:2'],
    });
    expect(fixture.runtime.lastMount.textures.player.url).toBe('blob:custom-1:1');

    firstSimulation.queue([{ type: 'ProjectileSpawned', projectile: firstSimulation.snapshot().projectiles[0] ?? {
      id: 'projectile',
      x: 1,
      y: 1,
      position: { x: 1, y: 1 },
      previousPosition: { x: 1, y: 1 },
      velocity: { x: 0, y: 20 },
      hitboxRadius: 0.09,
      damage: 1,
    } }]);
    fixture.runtime.step({});
    expect(fixture.audio.calls).toContain('sfx:shoot');

    await fixture.app.dispatch({ type: 'PAUSE_REQUESTED', source: 'user' });
    expect(fixture.app.state).toMatchObject({ kind: 'paused', source: 'user' });
    expect(fixture.audio.pauseCalls).toBe(1);
    await fixture.app.dispatch({ type: 'RESUME_REQUESTED' });
    expect(fixture.audio.resumeCalls).toBe(1);

    firstSimulation.queue([{ type: 'PlayerDamaged', enemyId: 'enemy-1', damage: 1, health: 2 }]);
    fixture.runtime.step({});
    expect(fixture.audio.calls.filter((call) => call.startsWith('voice:player-'))).toHaveLength(1);

    const result: PlaneShooterResult = {
      sessionId: 'session-1',
      seed: 101,
      finalScore: 0,
      endedAtSeconds: 1,
    };
    firstSimulation.queue([
      { type: 'PlayerDamaged', enemyId: 'enemy-1', damage: 1, health: 0 },
      { type: 'GameOver', result },
    ]);
    fixture.runtime.step({});
    expect(fixture.app.state.kind).toBe('game-over');
    await Promise.resolve();
    await Promise.resolve();
    const terminalVoice = 'voice:player-zac';
    expect(fixture.audio.calls).toContain('stop');
    expect(fixture.audio.calls).toContain(terminalVoice);
    expect(fixture.audio.calls.filter((call) => call === terminalVoice)).toHaveLength(1);

    await fixture.app.dispatch({ type: 'RETRY_REQUESTED' });
    expect(fixture.runtime.mountCalls).toBe(2);
    expect(fixture.simulations).toHaveLength(2);
    expect(fixture.simulations[1]?.starts[0]?.sessionId).toBe('session-2');
    await fixture.app.dispose();
  });

  it('routes shot audio without publishing an unchanged DOM HUD state', async () => {
    const fixture = createFixture();
    await openGate(fixture.app);
    await fixture.app.dispatch({ type: 'ENTER_ARENA' });
    const simulation = fixture.simulations[0];
    if (!simulation) throw new Error('Arena did not initialize.');

    let publications = 0;
    const unsubscribe = fixture.app.subscribe(() => {
      publications += 1;
    });
    const initialPublications = publications;
    simulation.queue([{ type: 'ProjectileSpawned', projectile: {
      id: 'projectile',
      x: 0,
      y: -2,
      position: { x: 0, y: -2 },
      previousPosition: { x: 0, y: -2 },
      velocity: { x: 0, y: 20 },
      hitboxRadius: 0.09,
      damage: 1,
    } }]);

    fixture.runtime.step({ firePressed: true });

    expect(fixture.audio.calls).toContain('sfx:shoot');
    expect(publications).toBe(initialPublications);

    simulation.queue([{ type: 'ScoreChanged', score: 1 }]);
    fixture.runtime.step({});
    expect(publications).toBe(initialPublications + 1);
    unsubscribe();
    await fixture.app.dispose();
  });

  it('pauses/resumes for user and visibility sources, deduplicates arena entry, mutes, and disposes safely', async () => {
    const fixture = createFixture();
    await openGate(fixture.app);
    await fixture.app.dispatch({ type: 'ENTER_ARENA' });
    expect((await fixture.app.dispatch({ type: 'ENTER_ARENA' })).status).toBe('deduplicated');

    await fixture.app.dispatch({ type: 'PAUSE_REQUESTED', source: 'user' });
    expect(fixture.app.state).toMatchObject({ kind: 'paused', source: 'user' });
    await fixture.app.dispatch({ type: 'RESUME_REQUESTED' });
    await fixture.app.dispatch({ type: 'PAUSE_REQUESTED', source: 'visibility' });
    expect(fixture.app.state).toMatchObject({ kind: 'paused', source: 'visibility' });
    await fixture.app.dispatch({ type: 'RESUME_REQUESTED' });
    expect(fixture.audio.pauseCalls).toBe(2);
    expect(fixture.audio.resumeCalls).toBe(2);

    await fixture.app.dispatch({ type: 'MUTE_CHANGED', muted: true });
    expect(fixture.audio.muted).toBe(true);
    await fixture.app.dispose();
    await fixture.app.dispose();
    expect(fixture.runtime.disposeCalls).toBe(1);
    expect(fixture.audio.disposeCalls).toBe(1);
    expect(fixture.lifecycle.disposeCalls).toBe(1);
    expect(fixture.objectUrls.clearCalls).toBe(1);
    expect((await fixture.app.dispatch({ type: 'START_PRESSED' })).ok).toBe(false);
  });
});
