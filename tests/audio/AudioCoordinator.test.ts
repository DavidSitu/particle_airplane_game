import manifest from '../../public/assets/asset-manifest.json';
import { describe, expect, it, vi } from 'vitest';
import { AssetCatalog, type AssetDescriptor, type AssetManifestLoader } from '../../src/systems/assets';
import {
  AUDIO_ROLE_ASSET_KEYS,
  AudioCoordinator,
  type AudioDriverPort,
  type AudioDriverResult,
  type AudioMusicOptions,
} from '../../src/systems/audio';

const catalogForManifest = async (): Promise<AssetCatalog> => {
  const loader: AssetManifestLoader = { load: async () => manifest };
  const catalog = new AssetCatalog(loader);
  await catalog.loadManifest();
  return catalog;
};

class FakeAudioDriver implements AudioDriverPort {
  public unlockCalls = 0;
  public musicCalls: AssetDescriptor[] = [];
  public voiceCalls: AssetDescriptor[] = [];
  public sfxCalls: AssetDescriptor[] = [];
  public preparedSfx: AssetDescriptor[] = [];
  public pauseCalls = 0;
  public resumeCalls = 0;
  public stopCalls = 0;
  public disposeCalls = 0;
  public unlockResult: AudioDriverResult = { ok: true };

  public unlockFromUserGesture(): Promise<AudioDriverResult> {
    this.unlockCalls += 1;
    return Promise.resolve(this.unlockResult);
  }

  public prepareSfx(descriptor: AssetDescriptor): AudioDriverResult {
    this.preparedSfx.push(descriptor);
    return { ok: true };
  }

  public playMusic(descriptor: AssetDescriptor, _options?: AudioMusicOptions): Promise<AudioDriverResult> {
    this.musicCalls.push(descriptor);
    return Promise.resolve({ ok: true });
  }

  public playVoice(descriptor: AssetDescriptor): Promise<AudioDriverResult> {
    this.voiceCalls.push(descriptor);
    return Promise.resolve({ ok: true });
  }

  public playSfx(descriptor: AssetDescriptor): AudioDriverResult {
    this.sfxCalls.push(descriptor);
    return { ok: true };
  }

  public setMuted(_muted: boolean): void {}

  public pauseForVisibility(): void {
    this.pauseCalls += 1;
  }

  public resumeFromVisibility(): Promise<AudioDriverResult> {
    this.resumeCalls += 1;
    return Promise.resolve({ ok: true });
  }

  public stopAll(): Promise<void> {
    this.stopCalls += 1;
    return Promise.resolve();
  }

  public dispose(): Promise<void> {
    this.disposeCalls += 1;
    return Promise.resolve();
  }
}

describe('AudioCoordinator', () => {
  it('requires a gesture unlock and deduplicates concurrent unlock calls', async () => {
    const catalog = await catalogForManifest();
    const driver = new FakeAudioDriver();
    const coordinator = new AudioCoordinator({ catalog, driver });

    expect((await coordinator.playMusic('opening')).ok).toBe(false);
    const first = coordinator.unlockFromUserGesture();
    const second = coordinator.unlockFromUserGesture();
    expect(first).toBe(second);
    await first;
    expect(driver.unlockCalls).toBe(1);
    expect(coordinator.snapshot().state).toBe('ready');
  });

  it('maps semantic roles to catalog descriptors and keeps one music role', async () => {
    const catalog = await catalogForManifest();
    const driver = new FakeAudioDriver();
    const coordinator = new AudioCoordinator(catalog, driver);
    await coordinator.unlockFromUserGesture();

    await coordinator.playMusic('opening');
    await coordinator.playMusic('opening');
    expect(driver.musicCalls.map((descriptor) => descriptor.key)).toEqual([AUDIO_ROLE_ASSET_KEYS.opening]);
    expect(coordinator.snapshot().musicRole).toBe('opening');

    await coordinator.playMusic('gameplay', { fadeMs: 0 });
    expect(driver.musicCalls.map((descriptor) => descriptor.key)).toEqual([
      'music.opening',
      'music.gameplay',
    ]);
    expect(coordinator.snapshot().musicRole).toBe('gameplay');

    await coordinator.playVoice('start-leon');
    expect(coordinator.playSfx('shoot').ok).toBe(true);
    expect(driver.voiceCalls[0]?.key).toBe('voice.start.leon');
    expect(driver.sfxCalls[0]?.key).toBe('sfx.shoot');
  });

  it('reports blocked unlock without corrupting policy and supports bounded retry', async () => {
    const catalog = await catalogForManifest();
    const driver = new FakeAudioDriver();
    driver.unlockResult = {
      ok: false,
      failure: { code: 'blocked', message: 'autoplay blocked' },
    };
    const coordinator = new AudioCoordinator({ catalog, driver, maxUnlockAttempts: 2 });

    expect((await coordinator.unlockFromUserGesture()).ok).toBe(false);
    expect(coordinator.snapshot().state).toBe('blocked');
    expect((await coordinator.playMusic('opening')).ok).toBe(false);

    driver.unlockResult = { ok: true };
    expect((await coordinator.unlockFromUserGesture()).ok).toBe(true);
    expect(coordinator.snapshot().state).toBe('ready');
    expect(driver.unlockCalls).toBe(2);
  });

  it('keeps mute preference and visibility pause independent from readiness', async () => {
    const catalog = await catalogForManifest();
    const driver = new FakeAudioDriver();
    const saveMuted = vi.fn();
    const coordinator = new AudioCoordinator({
      catalog,
      driver,
      preferenceStore: { loadMuted: () => false, saveMuted },
    });
    await coordinator.initialize();
    expect(driver.preparedSfx.map((descriptor) => descriptor.key)).toEqual(['sfx.shoot']);
    coordinator.setMuted(true);
    expect(saveMuted).toHaveBeenCalledWith(true);
    expect(coordinator.snapshot().muted).toBe(true);

    coordinator.pauseForVisibility();
    expect(coordinator.snapshot().visibilityPaused).toBe(true);
    await coordinator.resumeFromVisibility();
    expect(driver.pauseCalls).toBe(1);
    expect(driver.resumeCalls).toBe(1);
    expect(coordinator.snapshot().visibilityPaused).toBe(false);
  });

  it('stops and disposes idempotently without retaining the active music role', async () => {
    const catalog = await catalogForManifest();
    const driver = new FakeAudioDriver();
    const coordinator = new AudioCoordinator({ catalog, driver });
    await coordinator.unlockFromUserGesture();
    await coordinator.playMusic('opening');
    await coordinator.stopAll();
    expect(coordinator.snapshot().musicRole).toBeUndefined();
    await coordinator.dispose();
    await coordinator.dispose();
    expect(driver.stopCalls).toBe(1);
    expect(driver.disposeCalls).toBe(1);
    expect((await coordinator.playMusic('opening')).failure?.code).toBe('disposed');
  });
});
