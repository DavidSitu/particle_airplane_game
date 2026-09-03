export {
  GAMEPLAY_DEFAULTS,
  DEFAULT_GAMEPLAY_CONFIG,
  GAMEPLAY_TUNING_STATUS,
  resolveGameplayConfig,
} from '../../config/gameplayDefaults';
export type {
  GameplayBulletConfig,
  GameplayConfig,
  GameplayDifficultyConfig,
  GameplayEnemyConfig,
  GameplayPlayerConfig,
  GameplayWorldConfig,
} from '../../config/gameplayDefaults';
export type {
  AppearanceReference,
  BulletSnapshot,
  DifficultySnapshot,
  EnemyAppearanceVariant,
  EnemySnapshot,
  GameEndReason,
  GameEvent,
  GameInputFrame,
  GameSessionResult,
  GameSimulationApi,
  GameSnapshot,
  GameplayAppearance,
  GameplayLifecycle,
  PlayerSnapshot,
  StartGameCommand,
  Vector2,
} from './contracts';
export {
  GameSimulation,
  createGameSimulation,
  createGameplaySimulation,
} from './GameSimulation';
export type { GameplaySimulationOptions } from './GameSimulation';
export {
  SeededRandom,
  XorShift32,
  createSeededRandom,
  createXorShiftRandom,
} from './ports';
export type {
  RandomSource,
  RandomSourceFactory,
} from './ports';
export {
  clamp,
  clampUnit,
  difficultyLevelAt,
  finiteOr,
  normalizeConfig,
  spawnIntervalAt,
} from './GameRules';
export {
  circlesOverlap,
  distanceSquared,
} from './internal/collision';
