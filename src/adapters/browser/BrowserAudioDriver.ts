import type { AssetDescriptor } from '../../systems/assets';
import type {
  AudioDriverPort,
  AudioDriverResult,
  AudioMusicOptions,
} from '../../systems/audio';

export interface BrowserAudioDriverOptions {
  readonly audioFactory?: () => HTMLAudioElement;
  readonly maxSfxVoices?: number;
  readonly maxVoiceVoices?: number;
  readonly fadeStepMs?: number;
}

interface SourceCandidate {
  readonly url: string;
  readonly format: string;
}

interface MusicTrack {
  readonly descriptorKey: string;
  readonly element: HTMLAudioElement;
}

const DEFAULT_SFX_VOICES = 4;
const DEFAULT_VOICE_VOICES = 4;
const DEFAULT_FADE_STEP_MS = 16;

// A short muted WAV gives HTMLAudio a real media source to unlock. The
// play() call is intentionally made before the first await in
// unlockFromUserGesture so it can run in the trusted Start event stack.
const SILENCE_WAV_DATA_URI =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAAA';

const clamp = (value: number, minimum = 0, maximum = 1): number =>
  Math.min(maximum, Math.max(minimum, value));

const formatOf = (url: string): string => {
  const clean = url.split(/[?#]/, 1)[0] ?? url;
  const dot = clean.lastIndexOf('.');
  return dot >= 0 ? clean.slice(dot + 1).toLowerCase() : '';
};

const isBlockedError = (cause: unknown): boolean => {
  if (!cause || typeof cause !== 'object') return false;
  const name = 'name' in cause && typeof cause.name === 'string' ? cause.name : '';
  const code = 'code' in cause && typeof cause.code === 'number' ? cause.code : 0;
  return name === 'NotAllowedError' || name === 'SecurityError' || code === 20;
};

const errorMessage = (cause: unknown, fallback: string): string =>
  cause instanceof Error && cause.message.length > 0 ? cause.message : fallback;

const defaultAudioFactory = (): HTMLAudioElement => {
  if (typeof Audio === 'undefined') {
    throw new Error('HTMLAudioElement is unavailable in this environment.');
  }
  return new Audio();
};

/**
 * Browser-only HTMLAudio implementation of the technology-neutral audio
 * port. The coordinator owns semantic policy; this class owns media elements,
 * source fallback, crossfades, visibility handling, and bounded pools.
 */
export class BrowserAudioDriver implements AudioDriverPort {
  private readonly audioFactory: () => HTMLAudioElement;
  private readonly maxSfxVoices: number;
  private readonly maxVoiceVoices: number;
  private readonly fadeStepMs: number;
  private readonly elements = new Set<HTMLAudioElement>();
  private readonly sfxPool: HTMLAudioElement[] = [];
  private readonly voicePool: HTMLAudioElement[] = [];
  private readonly pausedByVisibility = new Set<HTMLAudioElement>();

  private activeMusic?: MusicTrack;
  private unlockElement?: HTMLAudioElement;
  private unlockPromise?: Promise<AudioDriverResult>;
  private fadeTimer?: ReturnType<typeof setInterval>;
  private fadeToken = 0;
  private muted = false;
  private disposed = false;
  private visibilityPaused = false;
  private sfxCursor = 0;
  private voiceCursor = 0;

  public constructor(options: BrowserAudioDriverOptions = {}) {
    this.audioFactory = options.audioFactory ?? defaultAudioFactory;
    this.maxSfxVoices = Math.max(1, Math.floor(options.maxSfxVoices ?? DEFAULT_SFX_VOICES));
    this.maxVoiceVoices = Math.max(1, Math.floor(options.maxVoiceVoices ?? DEFAULT_VOICE_VOICES));
    this.fadeStepMs = Math.max(4, Math.floor(options.fadeStepMs ?? DEFAULT_FADE_STEP_MS));
  }

  public unlockFromUserGesture(): Promise<AudioDriverResult> {
    if (this.disposed) return Promise.resolve(this.failure('disposed', 'Audio driver is disposed.'));
    if (this.unlockPromise) return this.unlockPromise;

    let element: HTMLAudioElement;
    try {
      element = this.unlockElement ?? this.createElement();
      this.unlockElement = element;
      element.muted = true;
      element.loop = false;
      element.src = SILENCE_WAV_DATA_URI;
      element.load();
      // Do not move this call behind an await: browsers associate it with the
      // trusted pointer/touch event only while that event is active.
      const playResult = element.play();
      // Capture the gesture immediately. Waiting for the silent element's
      // media promise can outlive transient user activation, causing the real
      // opening tracks to be attempted too late. The real track operations
      // still report policy/codec failures through their normal typed results.
      void Promise.resolve(playResult).then(() => {
        element.pause();
        element.currentTime = 0;
      }).catch(() => {
        element.pause();
      });
      const operation = Promise.resolve({ ok: true as const }).finally(() => {
        this.unlockPromise = undefined;
      });
      this.unlockPromise = operation;
      return operation;
    } catch (cause) {
      return Promise.resolve(this.failure(
        isBlockedError(cause) ? 'blocked' : 'failed',
        errorMessage(cause, 'Browser audio could not be unlocked.'),
        cause,
      ));
    }
  }

  public async playMusic(
    descriptor: AssetDescriptor,
    options: AudioMusicOptions = {},
  ): Promise<AudioDriverResult> {
    if (this.disposed) return this.failure('disposed', 'Audio driver is disposed.');
    const valid = this.validateAudioDescriptor(descriptor);
    if (valid) return valid;
    if (this.activeMusic?.descriptorKey === descriptor.key) {
      return { ok: true };
    }

    let next: HTMLAudioElement | undefined;
    try {
      next = this.createElement();
      next.loop = true;
      next.volume = this.activeMusic ? 0 : clamp(options.volume ?? 1);
      const played = await this.playWithFallback(next, descriptor, true);
      if (!played.ok) {
        this.releaseElement(next);
        return played;
      }
    } catch (cause) {
      if (next) this.releaseElementIfKnown(cause, next);
      return this.failure(isBlockedError(cause) ? 'blocked' : 'failed', 'Music playback failed.', cause);
    }
    if (!next) return this.failure('failed', 'Music element could not be created.');

    const previous = this.activeMusic;
    const targetVolume = clamp(options.volume ?? 1);
    this.activeMusic = { descriptorKey: descriptor.key, element: next };
    if (previous) {
      await this.crossfade(previous.element, next, options.fadeMs ?? 250, targetVolume);
      this.releaseElement(previous.element);
    } else {
      next.volume = targetVolume;
    }
    return { ok: true };
  }

  public async playVoice(descriptor: AssetDescriptor): Promise<AudioDriverResult> {
    if (this.disposed) return this.failure('disposed', 'Audio driver is disposed.');
    const valid = this.validateAudioDescriptor(descriptor);
    if (valid) return valid;
    const element = this.takePooledElement(this.voicePool, this.maxVoiceVoices, 'voice');
    element.loop = false;
    element.volume = 1;
    const result = await this.playWithFallback(element, descriptor, false);
    if (!result.ok) this.resetElement(element);
    return result;
  }

  public playSfx(descriptor: AssetDescriptor): AudioDriverResult {
    if (this.disposed) return this.failure('disposed', 'Audio driver is disposed.');
    const valid = this.validateAudioDescriptor(descriptor);
    if (valid) return valid;
    const element = this.takePooledElement(this.sfxPool, this.maxSfxVoices, 'sfx');
    element.loop = false;
    element.volume = 1;
    element.currentTime = 0;
    // playWithFallback starts the first play synchronously and handles an
    // unsupported/rejected source in its promise continuation. SFX remains a
    // synchronous semantic command at the coordinator boundary.
    void this.playWithFallback(element, descriptor, false).then((result) => {
      if (!result.ok) this.resetElement(element);
    });
    return { ok: true };
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    for (const element of this.elements) element.muted = muted;
  }

  public pauseForVisibility(): void {
    if (this.disposed || this.visibilityPaused) return;
    this.visibilityPaused = true;
    this.pausedByVisibility.clear();
    for (const element of this.elements) {
      if (!element.paused && !element.ended) {
        this.pausedByVisibility.add(element);
        element.pause();
      }
    }
  }

  public async resumeFromVisibility(): Promise<AudioDriverResult> {
    if (this.disposed) return this.failure('disposed', 'Audio driver is disposed.');
    if (!this.visibilityPaused) return { ok: true };
    this.visibilityPaused = false;
    const pending = [...this.pausedByVisibility];
    this.pausedByVisibility.clear();
    try {
      for (const element of pending) {
        if (element.ended) continue;
        await Promise.resolve(element.play());
      }
      return { ok: true };
    } catch (cause) {
      return this.failure(isBlockedError(cause) ? 'blocked' : 'failed', 'Audio could not resume after visibility change.', cause);
    }
  }

  public async stopAll(options: { readonly fadeMs?: number } = {}): Promise<void> {
    if (this.disposed) return;
    this.cancelFade();
    const music = this.activeMusic;
    this.activeMusic = undefined;
    if (music && (options.fadeMs ?? 0) > 0) {
      await this.fadeOut(music.element, options.fadeMs ?? 0);
    }
    if (music) this.releaseElement(music.element);
    for (const element of [...this.elements]) this.resetElement(element);
    this.pausedByVisibility.clear();
    this.visibilityPaused = false;
  }

  public async dispose(): Promise<void> {
    if (this.disposed) return;
    await this.stopAll();
    this.disposed = true;
    this.cancelFade();
    for (const element of [...this.elements]) this.releaseElement(element);
    this.sfxPool.length = 0;
    this.voicePool.length = 0;
    this.unlockElement = undefined;
    this.unlockPromise = undefined;
  }

  private createElement(): HTMLAudioElement {
    if (this.disposed) throw new Error('Audio driver is disposed.');
    const element = this.audioFactory();
    element.preload = 'auto';
    element.muted = this.muted;
    this.elements.add(element);
    return element;
  }

  private takePooledElement(
    pool: HTMLAudioElement[],
    limit: number,
    kind: 'sfx' | 'voice',
  ): HTMLAudioElement {
    while (pool.length < limit) pool.push(this.createElement());
    const cursor = kind === 'sfx' ? this.sfxCursor++ : this.voiceCursor++;
    const element = pool[cursor % pool.length];
    if (!element) throw new Error(`Audio ${kind} pool could not allocate a voice.`);
    this.resetElement(element);
    return element;
  }

  private async playWithFallback(
    element: HTMLAudioElement,
    descriptor: AssetDescriptor,
    loop: boolean,
  ): Promise<AudioDriverResult> {
    const candidates = this.orderedSources(descriptor);
    let lastCause: unknown;
    for (const candidate of candidates) {
      try {
        element.loop = loop;
        element.src = candidate.url;
        element.load();
        await Promise.resolve(element.play());
        return { ok: true };
      } catch (cause) {
        lastCause = cause;
        element.pause();
      }
    }
    return this.failure(
      isBlockedError(lastCause) ? 'blocked' : 'failed',
      errorMessage(lastCause, `No supported audio source for ${descriptor.key}.`),
      lastCause,
    );
  }

  private orderedSources(descriptor: AssetDescriptor): SourceCandidate[] {
    const candidates = (descriptor.sources.length > 0
      ? descriptor.sources.map((entry) => ({ url: entry.url, format: entry.format || formatOf(entry.url) }))
      : descriptor.urls.map((url) => ({ url, format: formatOf(url) })))
      .filter((entry) => entry.url.length > 0);
    return candidates.sort((left, right) => {
      const rank = (format: string): number => format === 'ogg' ? 0 : format === 'mp3' ? 1 : 2;
      return rank(left.format) - rank(right.format);
    });
  }

  private validateAudioDescriptor(descriptor: AssetDescriptor): AudioDriverResult | undefined {
    if (descriptor.kind !== 'audio' || this.orderedSources(descriptor).length === 0) {
      return this.failure('failed', 'Audio driver received an invalid audio descriptor.');
    }
    return undefined;
  }

  private async crossfade(
    previous: HTMLAudioElement,
    next: HTMLAudioElement,
    fadeMs: number,
    targetVolume: number,
  ): Promise<void> {
    const duration = Math.max(0, fadeMs);
    if (duration === 0) {
      previous.pause();
      next.volume = targetVolume;
      return;
    }
    this.cancelFade();
    const token = ++this.fadeToken;
    const initialPreviousVolume = clamp(previous.volume);
    const startedAt = Date.now();
    await new Promise<void>((resolve) => {
      this.fadeTimer = setInterval(() => {
        if (this.disposed || token !== this.fadeToken) {
          if (this.fadeTimer) clearInterval(this.fadeTimer);
          this.fadeTimer = undefined;
          resolve();
          return;
        }
        const progress = clamp((Date.now() - startedAt) / duration);
        previous.volume = initialPreviousVolume * (1 - progress);
        next.volume = targetVolume * progress;
        if (progress >= 1) {
          previous.pause();
          if (this.fadeTimer) clearInterval(this.fadeTimer);
          this.fadeTimer = undefined;
          resolve();
        }
      }, this.fadeStepMs);
    });
  }

  private async fadeOut(element: HTMLAudioElement, fadeMs: number): Promise<void> {
    const duration = Math.max(0, fadeMs);
    if (duration === 0) {
      element.pause();
      return;
    }
    const initial = clamp(element.volume);
    const startedAt = Date.now();
    await new Promise<void>((resolve) => {
      this.fadeTimer = setInterval(() => {
        const progress = clamp((Date.now() - startedAt) / duration);
        element.volume = initial * (1 - progress);
        if (progress >= 1) {
          element.pause();
          if (this.fadeTimer) clearInterval(this.fadeTimer);
          this.fadeTimer = undefined;
          resolve();
        }
      }, this.fadeStepMs);
    });
  }

  private cancelFade(): void {
    this.fadeToken += 1;
    if (this.fadeTimer) clearInterval(this.fadeTimer);
    this.fadeTimer = undefined;
  }

  private resetElement(element: HTMLAudioElement): void {
    try {
      element.pause();
      element.currentTime = 0;
      element.volume = 1;
      element.muted = this.muted;
    } catch {
      // Media elements can throw while a browser is tearing down a document;
      // disposal must remain best-effort and idempotent.
    }
    this.pausedByVisibility.delete(element);
  }

  private releaseElement(element: HTMLAudioElement): void {
    this.resetElement(element);
    this.elements.delete(element);
    this.pausedByVisibility.delete(element);
    const sfxIndex = this.sfxPool.indexOf(element);
    if (sfxIndex >= 0) this.sfxPool.splice(sfxIndex, 1);
    const voiceIndex = this.voicePool.indexOf(element);
    if (voiceIndex >= 0) this.voicePool.splice(voiceIndex, 1);
    try {
      element.removeAttribute('src');
      element.load();
    } catch {
      // Ignore browser teardown errors.
    }
  }

  private releaseElementIfKnown(cause: unknown, element: HTMLAudioElement): void {
    // `element` is always the newly created media object on this path. The
    // cause argument is retained to make the catch site explicit and avoid
    // accidentally swallowing a future diagnostic value.
    void cause;
    this.releaseElement(element);
  }

  private failure(
    code: 'blocked' | 'failed' | 'unsupported-format' | 'disposed',
    message: string,
    cause?: unknown,
  ): AudioDriverResult {
    return {
      ok: false,
      failure: { code, message, ...(cause === undefined ? {} : { cause }) },
    };
  }
}

export const createBrowserAudioDriver = (options?: BrowserAudioDriverOptions): BrowserAudioDriver =>
  new BrowserAudioDriver(options);
