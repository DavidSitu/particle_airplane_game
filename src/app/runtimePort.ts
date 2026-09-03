import type {
  GameEvent,
  GameInputFrame,
  GameSnapshot,
} from '../systems/gameplay';

export interface RuntimeTextureSource {
  readonly appearanceKey: string;
  readonly url: string;
}

export interface RuntimeTextureSet {
  readonly background: RuntimeTextureSource;
  readonly backgroundFallback?: RuntimeTextureSource;
  readonly player: RuntimeTextureSource;
  readonly enemies: readonly RuntimeTextureSource[];
  readonly projectile: RuntimeTextureSource;
  readonly knob?: RuntimeTextureSource;
}

export interface RuntimeStepResult {
  readonly snapshot: GameSnapshot;
  readonly events: readonly GameEvent[];
}

export interface RuntimeMountInput {
  readonly container: HTMLElement;
  readonly textures: RuntimeTextureSet;
  readonly initialSnapshot: GameSnapshot;
  readonly worldWidth: number;
  readonly worldHeight: number;
  readonly fixedStepHz: number;
  readonly step: (input: GameInputFrame) => RuntimeStepResult;
  readonly onReady?: () => void;
  readonly onFatal: (error: Error) => void;
}

export type RuntimeMountResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: Error };

export interface GameRuntimePort {
  mount(input: RuntimeMountInput): Promise<RuntimeMountResult>;
  pause(): void;
  resume(): void;
  dispose(): Promise<void>;
}
