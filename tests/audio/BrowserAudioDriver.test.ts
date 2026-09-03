import { describe, expect, it } from 'vitest';
import type { AssetDescriptor } from '../../src/systems/assets';
import { BrowserAudioDriver } from '../../src/adapters/browser/BrowserAudioDriver';

class FakeAudioElement {
  public src = '';
  public preload = '';
  public muted = false;
  public loop = false;
  public volume = 1;
  public currentTime = 0;
  public paused = true;
  public ended = false;
  public playCalls = 0;
  public pauseCalls = 0;
  public loadCalls = 0;
  public rejectOgg = false;
  public supportedFormats: ReadonlySet<string> = new Set(['ogg', 'mp3']);

  public load(): void {
    this.loadCalls += 1;
  }

  public canPlayType(type: string): CanPlayTypeResult {
    if (type.includes('ogg')) return this.supportedFormats.has('ogg') ? 'probably' : '';
    if (type.includes('mpeg')) return this.supportedFormats.has('mp3') ? 'probably' : '';
    return '';
  }

  public play(): Promise<void> {
    this.playCalls += 1;
    if (this.rejectOgg && this.src.endsWith('.ogg')) {
      return Promise.reject(new DOMException('unsupported', 'NotSupportedError'));
    }
    this.paused = false;
    this.ended = false;
    return Promise.resolve();
  }

  public pause(): void {
    this.pauseCalls += 1;
    this.paused = true;
  }

  public removeAttribute(name: string): void {
    if (name === 'src') this.src = '';
  }
}

const descriptor = (key: string, urls: readonly string[]): AssetDescriptor => ({
  key: key as AssetDescriptor['key'],
  kind: 'audio',
  url: urls[0] ?? '',
  urls,
  sources: urls.map((url) => ({
    url,
    path: url,
    format: url.endsWith('.ogg') ? 'ogg' : 'mp3',
  })),
});

describe('BrowserAudioDriver', () => {
  it('starts unlock synchronously and prefers OGG before MP3', async () => {
    const elements: FakeAudioElement[] = [];
    const driver = new BrowserAudioDriver({
      audioFactory: () => {
        const element = new FakeAudioElement();
        elements.push(element);
        return element as unknown as HTMLAudioElement;
      },
    });

    const unlock = driver.unlockFromUserGesture();
    expect(elements[0]?.playCalls).toBe(1);
    expect((await unlock).ok).toBe(true);

    await driver.playMusic(descriptor('music.opening', ['/audio/opening.mp3', '/audio/opening.ogg']), { fadeMs: 0 });
    expect(elements[1]?.src).toBe('/audio/opening.ogg');
  });

  it('falls back to MP3 when the OGG source rejects', async () => {
    const elements: FakeAudioElement[] = [];
    const driver = new BrowserAudioDriver({
      audioFactory: () => {
        const element = new FakeAudioElement();
        element.rejectOgg = true;
        elements.push(element);
        return element as unknown as HTMLAudioElement;
      },
    });

    const result = await driver.playMusic(descriptor('music.opening', ['/audio/opening.ogg', '/audio/opening.mp3']), { fadeMs: 0 });
    expect(result.ok).toBe(true);
    expect(elements[0]?.src).toBe('/audio/opening.mp3');
    expect(elements[0]?.playCalls).toBe(2);
  });

  it('bounds the SFX pool and avoids duplicate music creation on same-role restart', async () => {
    const elements: FakeAudioElement[] = [];
    const driver = new BrowserAudioDriver({
      maxSfxVoices: 3,
      audioFactory: () => {
        const element = new FakeAudioElement();
        elements.push(element);
        return element as unknown as HTMLAudioElement;
      },
    });
    const music = descriptor('music.opening', ['/audio/opening.ogg']);
    const shoot = descriptor('sfx.shoot', ['/audio/shoot.ogg']);

    await driver.playMusic(music, { fadeMs: 0 });
    await driver.playMusic(music, { fadeMs: 0 });
    const countAfterMusic = elements.length;
    for (let index = 0; index < 20; index += 1) driver.playSfx(shoot);
    expect(elements.length).toBe(countAfterMusic + 3);

    await driver.stopAll();
    await driver.playMusic(music, { fadeMs: 0 });
    expect(elements.length).toBe(countAfterMusic + 4);
    await driver.dispose();
    await driver.dispose();
  });

  it('skips unsupported OGG and reuses a loaded SFX source on mobile-style playback', async () => {
    const elements: FakeAudioElement[] = [];
    const driver = new BrowserAudioDriver({
      maxSfxVoices: 1,
      audioFactory: () => {
        const element = new FakeAudioElement();
        element.supportedFormats = new Set(['mp3']);
        elements.push(element);
        return element as unknown as HTMLAudioElement;
      },
    });
    const shoot = descriptor('sfx.shoot', ['/audio/shoot.ogg', '/audio/shoot.mp3']);

    driver.playSfx(shoot);
    await Promise.resolve();
    const voice = elements[0];
    expect(voice?.src).toBe('/audio/shoot.mp3');
    expect(voice?.playCalls).toBe(1);
    expect(voice?.loadCalls).toBe(1);

    if (!voice) throw new Error('Expected an SFX voice.');
    voice.paused = true;
    voice.ended = true;
    driver.playSfx(shoot);
    await Promise.resolve();

    expect(elements).toHaveLength(1);
    expect(voice.playCalls).toBe(2);
    expect(voice.loadCalls).toBe(1);
  });

  it('prepares the bounded SFX pool without audible playback', async () => {
    const elements: FakeAudioElement[] = [];
    const driver = new BrowserAudioDriver({
      maxSfxVoices: 2,
      audioFactory: () => {
        const element = new FakeAudioElement();
        element.supportedFormats = new Set(['mp3']);
        elements.push(element);
        return element as unknown as HTMLAudioElement;
      },
    });
    const shoot = descriptor('sfx.shoot', ['/audio/shoot.ogg', '/audio/shoot.mp3']);

    expect(driver.prepareSfx(shoot).ok).toBe(true);
    expect(elements).toHaveLength(2);
    expect(elements.every((element) => element.src === '/audio/shoot.mp3')).toBe(true);
    expect(elements.every((element) => element.loadCalls === 1)).toBe(true);
    expect(elements.every((element) => element.playCalls === 0)).toBe(true);

    driver.playSfx(shoot);
    await Promise.resolve();
    expect(elements.reduce((total, element) => total + element.loadCalls, 0)).toBe(2);
    expect(elements.reduce((total, element) => total + element.playCalls, 0)).toBe(1);
  });

  it('pauses and resumes only media active when the page was hidden', async () => {
    const elements: FakeAudioElement[] = [];
    const driver = new BrowserAudioDriver({
      audioFactory: () => {
        const element = new FakeAudioElement();
        elements.push(element);
        return element as unknown as HTMLAudioElement;
      },
    });
    await driver.playMusic(descriptor('music.opening', ['/audio/opening.ogg']), { fadeMs: 0 });
    driver.pauseForVisibility();
    expect(elements[0]?.paused).toBe(true);
    expect((await driver.resumeFromVisibility()).ok).toBe(true);
    expect(elements[0]?.paused).toBe(false);
  });
});
