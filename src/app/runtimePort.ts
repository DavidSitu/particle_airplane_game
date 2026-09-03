import type {
  GameEvent,
  PlaneShooterInputFrame,
  PlaneShooterSnapshot,
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
  readonly snapshot: PlaneShooterSnapshot;
  readonly events: readonly GameEvent[];
}

export interface RuntimeMountInput {
  readonly container: HTMLElement;
  readonly textures: RuntimeTextureSet;
  readonly initialSnapshot: PlaneShooterSnapshot;
  readonly logicalWidth: number;
  readonly logicalHeight: number;
  readonly cameraBounds: {
    readonly minX: number;
    readonly maxX: number;
    readonly minY: number;
    readonly maxY: number;
  };
  readonly backgroundScrollSpeeds: readonly [number, number];
  readonly fixedStepHz: number;
  readonly step: (input: PlaneShooterInputFrame) => RuntimeStepResult;
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
