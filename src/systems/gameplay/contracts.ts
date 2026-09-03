import type { GameplayConfig } from '../../config/gameplayDefaults';

export type GameplayLifecycle = 'idle' | 'running' | 'paused' | 'ended' | 'disposed';

export interface Vector2 {
  readonly x: number;
  readonly y: number;
}

/** Appearance is a reference only; it never contributes to simulation size. */
export type AppearanceReference =
  | string
  | {
      readonly kind?: string;
      readonly assetKey?: string;
      readonly id?: string;
      readonly revision?: number;
    };

export interface GameplayAppearance {
  readonly player?: AppearanceReference;
  readonly enemies?: readonly AppearanceReference[];
  readonly playerAssetKey?: string;
  readonly enemyAssetKeys?: readonly string[];
}

export interface StartGameCommand {
  readonly sessionId: string;
  readonly seed: number;
  readonly config?: GameplayConfig | Partial<GameplayConfig>;
  readonly appearance?: GameplayAppearance;
}

/** Values are normalized by the simulation before use. */
export interface GameInputFrame {
  readonly moveX?: number;
  readonly moveY?: number;
  readonly aimWorldX?: number;
  readonly aimWorldY?: number;
  readonly fireHeld?: boolean;
  readonly firePressed?: boolean;
  readonly pausePressed?: boolean;
}

export interface PlayerSnapshot {
  readonly id: 'player';
  readonly x: number;
  readonly y: number;
  readonly position: Vector2;
  readonly radius: number;
  readonly health: number;
  readonly maxHealth: number;
  readonly invulnerableUntilMs: number;
  readonly isInvulnerable: boolean;
  readonly aimDirection: Vector2;
  readonly aimWorld: Vector2;
  readonly appearanceKey: string;
}

export interface BulletSnapshot {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly position: Vector2;
  readonly velocity: Vector2;
  readonly radius: number;
  readonly damage: number;
  readonly ageMs: number;
  readonly lifetimeMs: number;
}

/** Four packaged variants are built in; local rosters may provide up to eight. */
export type EnemyAppearanceVariant = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface EnemySnapshot {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly position: Vector2;
  readonly velocity: Vector2;
  readonly radius: number;
  readonly health: number;
  readonly maxHealth: number;
  readonly speed: number;
  readonly variant: EnemyAppearanceVariant;
  readonly appearanceVariant: EnemyAppearanceVariant;
  readonly appearanceKey: string;
  readonly scale: number;
  readonly rotation: number;
  readonly angularVelocity: number;
  readonly rotationSpeed: number;
}

export interface DifficultySnapshot {
  readonly level: number;
  readonly nextThresholdMs: number;
  readonly spawnIntervalMs: number;
}

export interface GameSnapshot {
  readonly lifecycle: GameplayLifecycle;
  readonly status: GameplayLifecycle;
  readonly sessionId: string;
  readonly seed: number;
  readonly elapsedMs: number;
  readonly survivalTimeMs: number;
  readonly score: number;
  readonly defeatedEnemies: number;
  readonly difficultyLevel: number;
  readonly difficulty: DifficultySnapshot;
  readonly player: PlayerSnapshot;
  readonly bullets: readonly BulletSnapshot[];
  readonly enemies: readonly EnemySnapshot[];
  readonly result?: GameSessionResult;
}

export type GameEndReason =
  | 'player-defeated'
  | 'health-depleted'
  | 'manual'
  | 'quit'
  | 'disposed';

export interface GameSessionResult {
  readonly sessionId: string;
  readonly seed: number;
  readonly reason: GameEndReason;
  readonly score: number;
  readonly defeatedEnemies: number;
  readonly survivalTimeMs: number;
  readonly remainingHealth: number;
  readonly endedAtMs: number;
}

export type GameEvent =
  | {
      readonly type: 'shot-fired';
      readonly bullet: BulletSnapshot;
    }
  | {
      readonly type: 'enemy-spawned';
      readonly enemy: EnemySnapshot;
    }
  | {
      readonly type: 'enemy-hit';
      readonly enemyId: string;
      readonly damage: number;
      readonly remainingHealth: number;
    }
  | {
      readonly type: 'enemy-destroyed';
      readonly enemyId: string;
      readonly variant: EnemyAppearanceVariant;
      readonly scoreAwarded: number;
      readonly score: number;
    }
  | {
      readonly type: 'player-damaged';
      readonly enemyId: string;
      readonly damage: number;
      readonly health: number;
      readonly invulnerableUntilMs: number;
    }
  | {
      readonly type: 'difficulty-changed';
      readonly level: number;
      readonly spawnIntervalMs: number;
    }
  | {
      readonly type: 'paused';
      readonly elapsedMs: number;
    }
  | {
      readonly type: 'resumed';
      readonly elapsedMs: number;
    }
  | {
      readonly type: 'session-ended';
      readonly result: GameSessionResult;
    };

export interface GameSimulationApi {
  start(command: StartGameCommand): GameSnapshot;
  advanceFixedStep(input?: GameInputFrame): readonly GameEvent[];
  pause(): GameSnapshot;
  resume(): GameSnapshot;
  end(reason: GameEndReason): GameSessionResult;
  snapshot(): GameSnapshot;
  dispose(): void;
}
