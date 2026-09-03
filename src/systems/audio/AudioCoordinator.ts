import type { AssetDescriptor, AssetCatalogPort } from '../assets';
import {
  AUDIO_ROLE_ASSET_KEYS,
  type AudioCommandResult,
  type AudioCommands,
  type AudioCoordinatorOptions,
  type AudioDriverResult,
  type AudioFailure,
  type AudioMusicOptions,
  type AudioSnapshot,
  type AudioState,
  type MusicRole,
  type SfxRole,
  type VoiceRole,
} from './contracts';

const DEFAULT_MAX_UNLOCK_ATTEMPTS = 3;
const MAX_SFX_SNAPSHOT_VOICES = 8;

const failureForDriver = (result: Extract<AudioDriverResult, { ok: false }>): AudioFailure => ({
  code: result.failure.code === 'blocked' ? 'blocked' : 'failed',
  message: result.failure.message,
  cause: result.failure.cause,
});

/**
 * Owns semantic audio policy while keeping browser/media objects in a driver.
 * All public methods are safe to call repeatedly; duplicate music and unlock
 * operations share their in-flight work instead of creating extra resources.
 */
export class AudioCoordinator implements AudioCommands {
  private state: AudioState = 'locked';
  private muted = false;
  private visibilityPaused = false;
  private musicRole?: MusicRole;
  private activeSfxVoices = 0;
  private unlockAttempts = 0;
  private lastFailure?: AudioFailure;
  private unlockPromise?: Promise<AudioCommandResult>;
  private musicPromises = new Map<MusicRole, Promise<AudioCommandResult>>();
  private musicQueue: Promise<void> = Promise.resolve();
  private disposed = false;

  private readonly catalog: AssetCatalogPort;
  private readonly driver: AudioCoordinatorOptions['driver'];
  private readonly preferenceStore?: AudioCoordinatorOptions['preferenceStore'];
  private readonly maxUnlockAttempts: number;

  public constructor(options: AudioCoordinatorOptions);
  public constructor(catalog: AssetCatalogPort, driver: AudioCoordinatorOptions['driver'], preferenceStore?: AudioCoordinatorOptions['preferenceStore']);
  public constructor(
    optionsOrCatalog: AudioCoordinatorOptions | AssetCatalogPort,
    driver?: AudioCoordinatorOptions['driver'],
    preferenceStore?: AudioCoordinatorOptions['preferenceStore'],
  ) {
    if ('catalog' in optionsOrCatalog && 'driver' in optionsOrCatalog) {
      this.catalog = optionsOrCatalog.catalog;
      this.driver = optionsOrCatalog.driver;
      this.preferenceStore = optionsOrCatalog.preferenceStore;
      this.maxUnlockAttempts = Math.max(1, optionsOrCatalog.maxUnlockAttempts ?? DEFAULT_MAX_UNLOCK_ATTEMPTS);
    } else {
      if (!driver) throw new TypeError('AudioCoordinator requires an audio driver.');
      this.catalog = optionsOrCatalog;
      this.driver = driver;
      this.preferenceStore = preferenceStore;
      this.maxUnlockAttempts = DEFAULT_MAX_UNLOCK_ATTEMPTS;
    }
  }

  public async initialize(): Promise<void> {
    if (!this.preferenceStore) return;
    try {
      const muted = await this.preferenceStore.loadMuted();
      this.muted = muted === true;
      this.driver.setMuted(this.muted);
    } catch (cause) {
      // A preference failure must not prevent the game from playing.
      this.lastFailure = {
        code: 'failed',
        message: 'Audio preference could not be loaded; using unmuted output.',
        cause,
      };
    }
  }

  public unlockFromUserGesture(): Promise<AudioCommandResult> {
    if (this.disposed) return Promise.resolve(this.failureResult('disposed', 'Audio coordinator is disposed.'));
    if (this.state === 'ready') return Promise.resolve(this.successResult(true));
    if (this.state === 'unlocking' && this.unlockPromise) return this.unlockPromise;
    if (this.unlockAttempts >= this.maxUnlockAttempts) {
      this.state = 'blocked';
      return Promise.resolve(this.failureResult('retry-limit', 'Audio unlock retry limit reached.'));
    }

    this.state = 'unlocking';
    this.unlockAttempts += 1;
    // Calling the driver before constructing the async continuation is
    // intentional: BrowserAudioDriver starts its media play attempt from the
    // trusted Start gesture call stack.
    const operation = this.driver.unlockFromUserGesture()
      .then((result) => {
        if (result.ok) {
          this.state = 'ready';
          this.lastFailure = undefined;
          return this.successResult();
        }
        this.lastFailure = failureForDriver(result);
        this.state = result.failure.code === 'blocked' ? 'blocked' : 'failed';
        return this.failureResult(this.lastFailure.code, this.lastFailure.message, this.lastFailure.cause);
      })
      .catch((cause: unknown) => {
        this.lastFailure = { code: 'failed', message: 'Audio unlock failed.', cause };
        this.state = 'failed';
        return this.failureResult('failed', this.lastFailure.message, cause);
      })
      .finally(() => {
        this.unlockPromise = undefined;
      });
    this.unlockPromise = operation;
    return operation;
  }

  public playMusic(role: MusicRole, options?: AudioMusicOptions): Promise<AudioCommandResult> {
    if (this.disposed) return Promise.resolve(this.failureResult('disposed', 'Audio coordinator is disposed.'));
    const inFlight = this.musicPromises.get(role);
    if (inFlight) return inFlight.then((result) => ({ ...result, deduplicated: true }));
    const operation = this.musicQueue.then(async () => {
      if (this.disposed) return this.failureResult('disposed', 'Audio coordinator is disposed.');
      if (this.state !== 'ready') {
        return this.failureResult(
          this.state === 'blocked' ? 'blocked' : 'locked',
          this.state === 'blocked' ? 'Audio is blocked by browser policy.' : 'Unlock audio from a user gesture first.',
        );
      }

      // Repeating the same semantic role must not create another music element.
      if (this.musicRole === role) return this.successResult(true);

      const descriptor = this.resolve(role);
      if (!descriptor) return this.failureResult('missing-asset', `Missing audio asset for ${role}.`);

      try {
        const result = await this.driver.playMusic(descriptor, options);
        if (result.ok) {
          this.musicRole = role;
          return this.successResult();
        }
        this.recordDriverFailure(result);
        const driverFailure = this.lastFailure ?? {
          code: 'failed' as const,
          message: `Could not play ${role} music.`,
        };
        return this.failureResult(driverFailure.code, driverFailure.message, driverFailure.cause);
      } catch (cause: unknown) {
        this.state = 'failed';
        this.lastFailure = { code: 'failed', message: `Could not play ${role} music.`, cause };
        return this.failureResult('failed', this.lastFailure.message, cause);
      }
    });
    this.musicQueue = operation.then(() => undefined, () => undefined);
    const trackedOperation = operation.finally(() => {
      this.musicPromises.delete(role);
    });
    this.musicPromises.set(role, trackedOperation);
    return trackedOperation;
  }

  public playVoice(role: VoiceRole): Promise<AudioCommandResult> {
    if (this.disposed) return Promise.resolve(this.failureResult('disposed', 'Audio coordinator is disposed.'));
    if (this.state !== 'ready') {
      return Promise.resolve(this.failureResult(
        this.state === 'blocked' ? 'blocked' : 'locked',
        'Audio is not ready; gameplay may continue silently.',
      ));
    }
    const descriptor = this.resolve(role);
    if (!descriptor) return Promise.resolve(this.failureResult('missing-asset', `Missing audio asset for ${role}.`));
    return this.driver.playVoice(descriptor)
      .then((result) => this.fromDriver(result))
      .catch((cause: unknown) => this.failureResult('failed', `Could not play ${role} voice.`, cause));
  }

  public playSfx(role: SfxRole): AudioCommandResult {
    if (this.disposed) return this.failureResult('disposed', 'Audio coordinator is disposed.');
    if (this.state !== 'ready') {
      return this.failureResult(this.state === 'blocked' ? 'blocked' : 'locked', 'Audio is not ready; SFX was skipped.');
    }
    const descriptor = this.resolve(role);
    if (!descriptor) return this.failureResult('missing-asset', `Missing audio asset for ${role}.`);
    const result = this.driver.playSfx(descriptor);
    if (result.ok) {
      // The driver owns the actual bounded pool. This count is an observable
      // snapshot hint and is never used as game state.
      this.activeSfxVoices = Math.min(MAX_SFX_SNAPSHOT_VOICES, this.activeSfxVoices + 1);
      return this.successResult();
    }
    this.recordDriverFailure(result);
    const driverFailure = this.lastFailure ?? {
      code: 'failed' as const,
      message: 'Audio driver operation failed.',
    };
    return this.failureResult(driverFailure.code, driverFailure.message, driverFailure.cause);
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    this.driver.setMuted(muted);
    if (this.preferenceStore) {
      Promise.resolve(this.preferenceStore.saveMuted(muted)).catch((cause: unknown) => {
        this.lastFailure = { code: 'failed', message: 'Audio preference could not be saved.', cause };
      });
    }
  }

  public pauseForVisibility(): void {
    if (this.disposed || this.visibilityPaused) return;
    this.visibilityPaused = true;
    this.driver.pauseForVisibility();
  }

  public async resumeFromVisibility(): Promise<AudioCommandResult> {
    if (this.disposed) return this.failureResult('disposed', 'Audio coordinator is disposed.');
    if (!this.visibilityPaused) return this.successResult(true);
    this.visibilityPaused = false;
    const result = await this.driver.resumeFromVisibility();
    return this.fromDriver(result);
  }

  public async stopAll(options?: { readonly fadeMs?: number }): Promise<void> {
    if (this.disposed) return;
    await this.musicQueue;
    await this.driver.stopAll(options);
    this.musicRole = undefined;
    this.activeSfxVoices = 0;
    this.visibilityPaused = false;
  }

  public async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    await this.driver.dispose();
    this.musicRole = undefined;
    this.activeSfxVoices = 0;
    this.musicPromises.clear();
  }

  public snapshot(): AudioSnapshot {
    return {
      state: this.state,
      muted: this.muted,
      visibilityPaused: this.visibilityPaused,
      ...(this.musicRole ? { musicRole: this.musicRole } : {}),
      activeSfxVoices: this.activeSfxVoices,
      unlockAttempts: this.unlockAttempts,
      ...(this.lastFailure ? { lastFailure: this.lastFailure } : {}),
    };
  }

  private resolve(role: keyof typeof AUDIO_ROLE_ASSET_KEYS): AssetDescriptor | undefined {
    return this.catalog.getOptional(AUDIO_ROLE_ASSET_KEYS[role]);
  }

  private fromDriver(result: AudioDriverResult): AudioCommandResult {
    if (result.ok) return this.successResult();
    this.recordDriverFailure(result);
    const driverFailure = this.lastFailure ?? {
      code: 'failed' as const,
      message: 'Audio driver operation failed.',
    };
    return this.failureResult(driverFailure.code, driverFailure.message, driverFailure.cause);
  }

  private recordDriverFailure(result: Extract<AudioDriverResult, { ok: false }>): void {
    this.lastFailure = failureForDriver(result);
    this.state = result.failure.code === 'blocked' ? 'blocked' : 'failed';
  }

  private successResult(deduplicated = false): AudioCommandResult {
    return { ok: true, snapshot: this.snapshot(), ...(deduplicated ? { deduplicated: true } : {}) };
  }

  private failureResult(code: AudioFailure['code'], message: string, cause?: unknown): AudioCommandResult {
    this.lastFailure = { code, message, ...(cause === undefined ? {} : { cause }) };
    return { ok: false, snapshot: this.snapshot(), failure: this.lastFailure };
  }
}

export const createAudioCoordinator = (options: AudioCoordinatorOptions): AudioCoordinator =>
  new AudioCoordinator(options);
