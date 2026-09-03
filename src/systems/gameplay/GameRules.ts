import {
  resolveGameplayConfig,
  type GameplayConfig,
} from '../../config/gameplayDefaults';

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function clampUnit(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }
  return clamp(value, -1, 1);
}

export function finiteOr(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function difficultyLevelAt(elapsedMs: number, config: GameplayConfig): number {
  if (config.difficultyIntervalMs <= 0) {
    return config.maxDifficultyLevel;
  }
  return Math.min(
    config.maxDifficultyLevel,
    Math.max(0, Math.floor((Math.max(0, elapsedMs) + 1e-6) / config.difficultyIntervalMs)),
  );
}

export function spawnIntervalAt(level: number, config: GameplayConfig): number {
  const boundedLevel = clamp(level, 0, config.maxDifficultyLevel);
  if (config.maxDifficultyLevel === 0) {
    return config.minSpawnIntervalMs;
  }
  const progress = boundedLevel / config.maxDifficultyLevel;
  return config.initialSpawnIntervalMs -
    (config.initialSpawnIntervalMs - config.minSpawnIntervalMs) * progress;
}

export function normalizeConfig(config?: Partial<GameplayConfig> | GameplayConfig): GameplayConfig {
  return resolveGameplayConfig(config);
}
