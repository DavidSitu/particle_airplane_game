import type { AudioPreferenceStorePort } from '../../systems/audio';

const STORAGE_KEY = 'preston-vs-particles:muted:v1';

export class LocalAudioPreferenceStore implements AudioPreferenceStorePort {
  public loadMuted(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  }

  public saveMuted(muted: boolean): void {
    try {
      localStorage.setItem(STORAGE_KEY, String(muted));
    } catch {
      // A browser preference failure is intentionally non-fatal.
    }
  }
}
