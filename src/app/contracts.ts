import type { AssetKey } from '../systems/assets';
import type { AudioSnapshot } from '../systems/audio';
import type {
  CharacterSkinRef,
  CropSettings,
  CustomizationSnapshot,
} from '../systems/customization';
import type {
  GameSessionResult,
  GameSnapshot,
} from '../systems/gameplay';
import type { GateAction, GateSnapshot } from '../systems/gate';

export type AppPhase =
  | 'booting'
  | 'opening'
  | 'gate'
  | 'rejected'
  | 'customizing'
  | 'loading-game'
  | 'playing'
  | 'paused'
  | 'game-over'
  | 'fatal-error';

export type AppFailureCode =
  | 'asset-boot-failed'
  | 'runtime-mount-failed'
  | 'customization-failed'
  | 'unexpected';

export interface AppFailure {
  readonly code: AppFailureCode;
  readonly message: string;
  readonly recoverable: boolean;
  readonly cause?: unknown;
}

export type AppState =
  | { readonly kind: 'booting'; readonly message: string }
  | { readonly kind: 'opening'; readonly audio: AudioSnapshot }
  | { readonly kind: 'gate'; readonly gate: GateSnapshot; readonly audio: AudioSnapshot }
  | { readonly kind: 'rejected'; readonly reason: 'question-2-no'; readonly audio: AudioSnapshot }
  | {
      readonly kind: 'customizing';
      readonly customization: CustomizationSnapshot;
      readonly audio: AudioSnapshot;
      readonly message?: string;
      readonly error?: string;
    }
  | { readonly kind: 'loading-game'; readonly message: string; readonly audio: AudioSnapshot }
  | { readonly kind: 'playing'; readonly game: GameSnapshot; readonly audio: AudioSnapshot }
  | { readonly kind: 'paused'; readonly game: GameSnapshot; readonly audio: AudioSnapshot; readonly source: 'user' | 'visibility' }
  | { readonly kind: 'game-over'; readonly game: GameSnapshot; readonly result: GameSessionResult; readonly audio: AudioSnapshot }
  | { readonly kind: 'fatal-error'; readonly failure: AppFailure; readonly audio?: AudioSnapshot };

export type AppCommand =
  | { readonly type: 'START_PRESSED' }
  | { readonly type: 'AUDIO_RETRY' }
  | { readonly type: 'GATE_ACTION'; readonly action: GateAction }
  | { readonly type: 'RETURN_TO_OPENING' }
  | { readonly type: 'SELECT_DEFAULT_PLAYER' }
  | { readonly type: 'SELECT_CUSTOM_PLAYER'; readonly ref: CharacterSkinRef }
  | { readonly type: 'SELECT_DEFAULT_ENEMIES' }
  | { readonly type: 'SELECT_CUSTOM_ENEMIES'; readonly refs: readonly CharacterSkinRef[] }
  | {
      readonly type: 'PROCESS_UPLOAD';
      readonly target: 'player' | 'enemy';
      readonly file: Blob;
      readonly crop: CropSettings;
    }
  | { readonly type: 'DELETE_UPLOAD'; readonly id: string }
  | { readonly type: 'CLEAR_CUSTOMIZATIONS' }
  | { readonly type: 'ENTER_ARENA' }
  | { readonly type: 'PAUSE_REQUESTED'; readonly source?: 'user' | 'visibility' }
  | { readonly type: 'RESUME_REQUESTED' }
  | { readonly type: 'RETRY_REQUESTED' }
  | { readonly type: 'CHANGE_CHARACTERS_REQUESTED' }
  | { readonly type: 'MAIN_MENU_REQUESTED' }
  | { readonly type: 'MUTE_CHANGED'; readonly muted: boolean };

export type AppCommandResult =
  | { readonly ok: true; readonly status: 'applied' | 'deduplicated' }
  | { readonly ok: false; readonly status: 'invalid-state' | 'busy' | 'failed'; readonly message: string };

export interface AppControllerPort {
  readonly state: Readonly<AppState>;
  boot(): Promise<void>;
  dispatch(command: AppCommand): Promise<AppCommandResult>;
  subscribe(listener: (state: Readonly<AppState>) => void): () => void;
  assetUrl(key: AssetKey): string;
  skinUrl(ref: CharacterSkinRef): string | undefined;
  dispose(): Promise<void>;
}
