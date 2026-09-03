import type {
  EnemyDefinitionId,
  PlaneShooterConfig,
} from '../../config/planeShooterParity';

export type PlaneShooterLifecycle =
  | 'idle'
  | 'running'
  | 'paused'
  | 'gameOver'
  | 'disposed';

export interface Vector2 {
  readonly x: number;
  readonly y: number;
}

/** Appearance is an opaque visual reference and never simulation geometry. */
export type AppearanceReference =
  | string
  | {
      readonly kind?: string;
      readonly assetKey?: string;
      readonly id?: string;
      readonly revision?: number;
    };

export interface PlaneShooterAppearance {
  readonly player?: AppearanceReference;
  readonly enemies?: readonly AppearanceReference[];
  /**
   * definition-mapped associates roster entries 1:1 with the four mechanics.
   * pool picks an appearance independently after selecting a mechanical type.
   */
  readonly enemyAppearanceMode?: 'definition-mapped' | 'pool';
}

export interface StartRunCommand {
  readonly sessionId: string;
  readonly seed: number;
  readonly appearance?: PlaneShooterAppearance;
}

export interface PlaneShooterInputFrame {
  readonly moveX?: number;
  readonly moveY?: number;
  /** Edge-triggered. Adapters must send true once per physical press. */
  readonly firePressed?: boolean;
}

export type PlaneShooterCommand =
  | { readonly type: 'SetMoveVector'; readonly moveVector: Vector2 }
  | { readonly type: 'FirePressed' }
  | { readonly type: 'AdvanceFrame'; readonly deltaSeconds: number }
  | { readonly type: 'RestartRun'; readonly run: StartRunCommand };

export interface PlayerSnapshot {
  readonly id: 'player';
  readonly x: number;
  readonly y: number;
  readonly position: Vector2;
  readonly hitboxRadius: number;
  readonly health: number;
  readonly maxHealth: number;
  readonly movementSpeed: number;
  readonly appearanceKey: string;
}

export interface ProjectileSnapshot {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly position: Vector2;
  readonly previousPosition: Vector2;
  readonly velocity: Vector2;
  readonly hitboxRadius: number;
  readonly damage: number;
}

export interface EnemySnapshot {
  readonly id: string;
  readonly definitionId: EnemyDefinitionId;
  readonly x: number;
  readonly y: number;
  readonly position: Vector2;
  readonly previousPosition: Vector2;
  readonly velocity: Vector2;
  readonly hitboxRadius: number;
  readonly currentHealth: number;
  readonly maxHealth: number;
  readonly movementSpeed: number;
  readonly lifetimeRemainingSeconds: number;
  readonly scoreValue: number;
  readonly playerContactDamage: number;
  readonly appearanceKey: string;
  readonly scale: number;
  readonly rotationDegrees: number;
  readonly rotationSpeedDegreesPerSecond: number;
}

export interface PlaneShooterResult {
  readonly sessionId: string;
  readonly seed: number;
  readonly finalScore: number;
  readonly endedAtSeconds: number;
}

export interface PlaneShooterSnapshot {
  readonly lifecycle: PlaneShooterLifecycle;
  readonly sessionId: string;
  readonly seed: number;
  readonly elapsedSeconds: number;
  readonly spawnClockSeconds: number;
  readonly score: number;
  readonly player: PlayerSnapshot;
  readonly projectiles: readonly ProjectileSnapshot[];
  readonly enemies: readonly EnemySnapshot[];
  readonly result?: PlaneShooterResult;
}

export type GameEvent =
  | { readonly type: 'ProjectileSpawned'; readonly projectile: ProjectileSnapshot }
  | { readonly type: 'EnemySpawned'; readonly enemy: EnemySnapshot }
  | {
      readonly type: 'EnemyHit';
      readonly enemyId: string;
      readonly damage: number;
      readonly remainingHealth: number;
    }
  | {
      readonly type: 'EnemyDestroyed';
      readonly enemyId: string;
      readonly definitionId: EnemyDefinitionId;
      readonly scoreAwarded: number;
      readonly score: number;
    }
  | { readonly type: 'ScoreChanged'; readonly score: number }
  | {
      readonly type: 'PlayerDamaged';
      readonly enemyId: string;
      readonly damage: number;
      readonly health: number;
    }
  | { readonly type: 'GameOver'; readonly result: PlaneShooterResult };

export type PlaneShooterFailure =
  | { readonly code: 'disposed'; readonly message: string }
  | { readonly code: 'run-not-active'; readonly message: string }
  | { readonly code: 'invalid-delta'; readonly message: string }
  | { readonly code: 'capacity-reached'; readonly message: string };

export type PlaneShooterCommandResult =
  | {
      readonly ok: true;
      readonly snapshot: PlaneShooterSnapshot;
      readonly events: readonly GameEvent[];
    }
  | {
      readonly ok: false;
      readonly snapshot: PlaneShooterSnapshot;
      readonly failure: PlaneShooterFailure;
    };

export interface PlaneShooterSimulationApi {
  readonly config: PlaneShooterConfig;
  start(command: StartRunCommand): PlaneShooterSnapshot;
  dispatch(command: PlaneShooterCommand): PlaneShooterCommandResult;
  advanceFixedStep(input?: PlaneShooterInputFrame): readonly GameEvent[];
  pause(): PlaneShooterSnapshot;
  resume(): PlaneShooterSnapshot;
  snapshot(): PlaneShooterSnapshot;
  dispose(): void;
}
