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
  public rejectOgg = false;

  public load(): void {}

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
