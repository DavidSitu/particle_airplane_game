import type { AssetCatalogPort, AssetDescriptor } from '../assets';

export type AudioState = 'locked' | 'unlocking' | 'ready' | 'blocked' | 'failed';
export type MusicRole = 'opening' | 'gameplay';
export type VoiceRole = 'start-leon' | 'player-jimmy' | 'player-zac';
export type SfxRole = 'shoot';
export type SemanticAudioRole = MusicRole | VoiceRole | SfxRole;

export interface AudioFailure {
  readonly code: 'locked' | 'blocked' | 'failed' | 'missing-asset' | 'disposed' | 'retry-limit';
  readonly message: string;
  readonly cause?: unknown;
}

export interface AudioSnapshot {
  readonly state: AudioState;
  readonly muted: boolean;
  readonly visibilityPaused: boolean;
  readonly musicRole?: MusicRole;
  readonly activeSfxVoices: number;
  readonly unlockAttempts: number;
  readonly lastFailure?: AudioFailure;
}

export interface AudioCommandResult {
  readonly ok: boolean;
  readonly snapshot: AudioSnapshot;
  readonly failure?: AudioFailure;
  readonly deduplicated?: boolean;
}

export interface AudioMusicOptions {
  readonly fadeMs?: number;
  readonly volume?: number;
}

export interface AudioDriverSuccess {
  readonly ok: true;
}

export interface AudioDriverFailure {
  readonly ok: false;
  readonly failure: {
    readonly code: 'blocked' | 'failed' | 'unsupported-format' | 'disposed';
    readonly message: string;
    readonly cause?: unknown;
  };
}

export type AudioDriverResult = AudioDriverSuccess | AudioDriverFailure;

/** Technology-neutral port implemented by BrowserAudioDriver or a test fake. */
export interface AudioDriverPort {
  unlockFromUserGesture(): Promise<AudioDriverResult>;
  playMusic(descriptor: AssetDescriptor, options?: AudioMusicOptions): Promise<AudioDriverResult>;
  playVoice(descriptor: AssetDescriptor): Promise<AudioDriverResult>;
  playSfx(descriptor: AssetDescriptor): AudioDriverResult;
  setMuted(muted: boolean): void;
  pauseForVisibility(): void;
  resumeFromVisibility(): Promise<AudioDriverResult>;
  stopAll(options?: { readonly fadeMs?: number }): Promise<void>;
  dispose(): Promise<void>;
}

/** Optional local preference boundary; absence of this port is valid. */
export interface AudioPreferenceStorePort {
  loadMuted(): boolean | Promise<boolean>;
  saveMuted(muted: boolean): void | Promise<void>;
}

export interface AudioCoordinatorOptions {
  readonly catalog: AssetCatalogPort;
  readonly driver: AudioDriverPort;
  readonly preferenceStore?: AudioPreferenceStorePort;
  readonly maxUnlockAttempts?: number;
}

export interface AudioCommands {
  unlockFromUserGesture(): Promise<AudioCommandResult>;
  playMusic(role: MusicRole, options?: AudioMusicOptions): Promise<AudioCommandResult>;
  playVoice(role: VoiceRole): Promise<AudioCommandResult>;
  playSfx(role: SfxRole): AudioCommandResult;
  setMuted(muted: boolean): void;
  pauseForVisibility(): void;
  resumeFromVisibility(): Promise<AudioCommandResult>;
  stopAll(options?: { readonly fadeMs?: number }): Promise<void>;
  snapshot(): AudioSnapshot;
}

export const AUDIO_ROLE_ASSET_KEYS = {
  opening: 'music.opening',
  gameplay: 'music.gameplay',
  'start-leon': 'voice.start.leon',
  'player-jimmy': 'voice.player.jimmy',
  'player-zac': 'voice.player.zac',
  shoot: 'sfx.shoot',
} as const;

export type AudioRoleAssetKey = (typeof AUDIO_ROLE_ASSET_KEYS)[keyof typeof AUDIO_ROLE_ASSET_KEYS];
