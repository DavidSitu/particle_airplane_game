/**
 * The simulation deliberately keeps all gameplay tuning in one place.
 *
 * These values are a playable, deterministic approximation of the recovered
 * Unity build.  They are not measured Unity constants.
 */
export const GAMEPLAY_TUNING_STATUS = 'TUNED APPROXIMATION' as const;

export interface GameplayWorldConfig {
  readonly width: number;
  readonly height: number;
}

export interface GameplayPlayerConfig {
  readonly speed: number;
  readonly radius: number;
  readonly maxHealth: number;
}

export interface GameplayBulletConfig {
  readonly speed: number;
  readonly radius: number;
  readonly damage: number;
  readonly cooldownMs: number;
  readonly lifetimeMs: number;
}

export interface GameplayEnemyConfig {
  readonly radius: number;
  readonly maxHealth: number;
  readonly contactDamage: number;
  readonly minSpeed: number;
  readonly maxSpeed: number;
  readonly minScale: number;
  readonly maxScale: number;
  readonly minRotation: number;
  readonly maxRotation: number;
}

export interface GameplayDifficultyConfig {
  readonly intervalMs: number;
  readonly initialSpawnIntervalMs: number;
  readonly minimumSpawnIntervalMs: number;
  readonly maximumLevel: number;
  readonly speedRampPerLevel: number;
}

/**
 * Flat fields are the canonical public representation.  The grouped fields
 * are included as read-only convenience views so adapters can inspect related
 * tuning without inventing a second source of truth.
 */
export interface GameplayConfig {
  readonly tuningStatus?: typeof GAMEPLAY_TUNING_STATUS;
  readonly fixedStepHz: number;
  readonly worldWidth: number;
  readonly worldHeight: number;
  readonly playerSpeed: number;
  readonly playerRadius: number;
  readonly playerHealth: number;
  readonly playerStartX: number;
  readonly playerStartY: number;
  readonly bulletSpeed: number;
  readonly bulletRadius: number;
  readonly bulletDamage: number;
  readonly fireCooldownMs: number;
  readonly bulletLifetimeMs: number;
  readonly enemyRadius: number;
  readonly enemyHealth: number;
  readonly enemyContactDamage: number;
  readonly enemyMinSpeed: number;
  readonly enemyMaxSpeed: number;
  readonly enemyMinScale: number;
  readonly enemyMaxScale: number;
  readonly enemyMinRotation: number;
  readonly enemyMaxRotation: number;
  readonly initialSpawnIntervalMs: number;
  readonly minSpawnIntervalMs: number;
  readonly difficultyIntervalMs: number;
  readonly maxDifficultyLevel: number;
  readonly enemySpeedRampPerLevel: number;
  readonly invulnerabilityMs: number;
  readonly scorePerEnemy: number;
  readonly maxEnemies: number;
  readonly maxBullets: number;
  readonly maxEntities: number;
  readonly world?: GameplayWorldConfig;
  readonly player?: GameplayPlayerConfig;
  readonly bullet?: GameplayBulletConfig;
  readonly enemy?: GameplayEnemyConfig;
  readonly difficulty?: GameplayDifficultyConfig;
  readonly [key: string]: unknown;
}

const DEFAULT_WORLD: GameplayWorldConfig = Object.freeze({
  width: 540,
  height: 960,
});

const DEFAULT_PLAYER: GameplayPlayerConfig = Object.freeze({
  speed: 320,
  radius: 24,
  maxHealth: 100,
});

const DEFAULT_BULLET: GameplayBulletConfig = Object.freeze({
  speed: 720,
  radius: 8,
  damage: 20,
  cooldownMs: 180,
  lifetimeMs: 2_000,
});

const DEFAULT_ENEMY: GameplayEnemyConfig = Object.freeze({
  radius: 28,
  maxHealth: 20,
  contactDamage: 20,
  minSpeed: 72,
  maxSpeed: 150,
  minScale: 0.78,
  maxScale: 1.28,
  minRotation: -1.5,
  maxRotation: 1.5,
});

const DEFAULT_DIFFICULTY: GameplayDifficultyConfig = Object.freeze({
  intervalMs: 15_000,
  initialSpawnIntervalMs: 1_000,
  minimumSpawnIntervalMs: 280,
  maximumLevel: 4,
  speedRampPerLevel: 6,
});

export const GAMEPLAY_DEFAULTS: GameplayConfig = Object.freeze({
  tuningStatus: GAMEPLAY_TUNING_STATUS,
  fixedStepHz: 60,
  worldWidth: DEFAULT_WORLD.width,
  worldHeight: DEFAULT_WORLD.height,
  playerSpeed: DEFAULT_PLAYER.speed,
  playerRadius: DEFAULT_PLAYER.radius,
  playerHealth: DEFAULT_PLAYER.maxHealth,
  playerStartX: DEFAULT_WORLD.width / 2,
  playerStartY: DEFAULT_WORLD.height - 80,
  bulletSpeed: DEFAULT_BULLET.speed,
  bulletRadius: DEFAULT_BULLET.radius,
  bulletDamage: DEFAULT_BULLET.damage,
  fireCooldownMs: DEFAULT_BULLET.cooldownMs,
  bulletLifetimeMs: DEFAULT_BULLET.lifetimeMs,
  enemyRadius: DEFAULT_ENEMY.radius,
  enemyHealth: DEFAULT_ENEMY.maxHealth,
  enemyContactDamage: DEFAULT_ENEMY.contactDamage,
  enemyMinSpeed: DEFAULT_ENEMY.minSpeed,
  enemyMaxSpeed: DEFAULT_ENEMY.maxSpeed,
  enemyMinScale: DEFAULT_ENEMY.minScale,
  enemyMaxScale: DEFAULT_ENEMY.maxScale,
  enemyMinRotation: DEFAULT_ENEMY.minRotation,
  enemyMaxRotation: DEFAULT_ENEMY.maxRotation,
  initialSpawnIntervalMs: DEFAULT_DIFFICULTY.initialSpawnIntervalMs,
  minSpawnIntervalMs: DEFAULT_DIFFICULTY.minimumSpawnIntervalMs,
  difficultyIntervalMs: DEFAULT_DIFFICULTY.intervalMs,
  maxDifficultyLevel: DEFAULT_DIFFICULTY.maximumLevel,
  enemySpeedRampPerLevel: DEFAULT_DIFFICULTY.speedRampPerLevel,
  invulnerabilityMs: 900,
  scorePerEnemy: 100,
  maxEnemies: 64,
  maxBullets: 128,
  maxEntities: 192,
  world: DEFAULT_WORLD,
  player: DEFAULT_PLAYER,
  bullet: DEFAULT_BULLET,
  enemy: DEFAULT_ENEMY,
  difficulty: DEFAULT_DIFFICULTY,
});

/** Backwards-friendly name for callers that prefer DEFAULT_* constants. */
export const DEFAULT_GAMEPLAY_CONFIG = GAMEPLAY_DEFAULTS;

function finiteOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function positiveOr(value: unknown, fallback: number, minimum = Number.EPSILON): number {
  return Math.max(minimum, finiteOr(value, fallback));
}

function integerOr(value: unknown, fallback: number, minimum: number): number {
  return Math.max(minimum, Math.floor(finiteOr(value, fallback)));
}

function readNested<T extends object>(value: unknown): Partial<T> {
  return value !== null && typeof value === 'object' ? (value as Partial<T>) : {};
}

/**
 * Normalize a caller override while preserving deterministic, safe bounds.
 * Nested values are accepted for ergonomic adapter configuration; the flat
 * output remains authoritative for the simulation.
 */
export function resolveGameplayConfig(
  input?: Partial<GameplayConfig> | GameplayConfig,
): GameplayConfig {
  const source = input ?? {};
  const world = readNested<GameplayWorldConfig>(source.world);
  const player = readNested<GameplayPlayerConfig>(source.player);
  const bullet = readNested<GameplayBulletConfig>(source.bullet);
  const enemy = readNested<GameplayEnemyConfig>(source.enemy);
  const difficulty = readNested<GameplayDifficultyConfig>(source.difficulty);

  const worldWidth = positiveOr(source.worldWidth ?? world.width, GAMEPLAY_DEFAULTS.worldWidth);
  const worldHeight = positiveOr(source.worldHeight ?? world.height, GAMEPLAY_DEFAULTS.worldHeight);
  const playerRadius = positiveOr(
    source.playerRadius ?? player.radius,
    GAMEPLAY_DEFAULTS.playerRadius,
  );
  const playerHealth = positiveOr(
    source.playerHealth ?? player.maxHealth,
    GAMEPLAY_DEFAULTS.playerHealth,
  );
  const playerStartX = finiteOr(
    source.playerStartX,
    worldWidth / 2,
  );
  const playerStartY = finiteOr(
    source.playerStartY,
    worldHeight - Math.max(playerRadius * 2, 80),
  );
  const enemyMinSpeed = positiveOr(
    source.enemyMinSpeed ?? enemy.minSpeed,
    GAMEPLAY_DEFAULTS.enemyMinSpeed,
  );
  const enemyMaxSpeed = Math.max(
    enemyMinSpeed,
    positiveOr(source.enemyMaxSpeed ?? enemy.maxSpeed, GAMEPLAY_DEFAULTS.enemyMaxSpeed),
  );
  const enemyMinScale = positiveOr(
    source.enemyMinScale ?? enemy.minScale,
    GAMEPLAY_DEFAULTS.enemyMinScale,
  );
  const enemyMaxScale = Math.max(
    enemyMinScale,
    positiveOr(source.enemyMaxScale ?? enemy.maxScale, GAMEPLAY_DEFAULTS.enemyMaxScale),
  );
  const initialSpawnIntervalMs = positiveOr(
    source.initialSpawnIntervalMs ?? difficulty.initialSpawnIntervalMs,
    GAMEPLAY_DEFAULTS.initialSpawnIntervalMs,
  );
  const minSpawnIntervalMs = Math.min(
    initialSpawnIntervalMs,
    positiveOr(
      source.minSpawnIntervalMs ?? difficulty.minimumSpawnIntervalMs,
      GAMEPLAY_DEFAULTS.minSpawnIntervalMs,
    ),
  );
  const maxDifficultyLevel = integerOr(
    source.maxDifficultyLevel ?? difficulty.maximumLevel,
    GAMEPLAY_DEFAULTS.maxDifficultyLevel,
    0,
  );

  return Object.freeze({
    ...GAMEPLAY_DEFAULTS,
    ...source,
    tuningStatus: GAMEPLAY_TUNING_STATUS,
    fixedStepHz: positiveOr(source.fixedStepHz, GAMEPLAY_DEFAULTS.fixedStepHz),
    worldWidth,
    worldHeight,
    playerSpeed: positiveOr(source.playerSpeed ?? player.speed, GAMEPLAY_DEFAULTS.playerSpeed),
    playerRadius,
    playerHealth,
    playerStartX,
    playerStartY,
    bulletSpeed: positiveOr(source.bulletSpeed ?? bullet.speed, GAMEPLAY_DEFAULTS.bulletSpeed),
    bulletRadius: positiveOr(source.bulletRadius ?? bullet.radius, GAMEPLAY_DEFAULTS.bulletRadius),
    bulletDamage: positiveOr(source.bulletDamage ?? bullet.damage, GAMEPLAY_DEFAULTS.bulletDamage),
    fireCooldownMs: Math.max(
      0,
      finiteOr(source.fireCooldownMs ?? bullet.cooldownMs, GAMEPLAY_DEFAULTS.fireCooldownMs),
    ),
    bulletLifetimeMs: positiveOr(
      source.bulletLifetimeMs ?? bullet.lifetimeMs,
      GAMEPLAY_DEFAULTS.bulletLifetimeMs,
    ),
    enemyRadius: positiveOr(source.enemyRadius ?? enemy.radius, GAMEPLAY_DEFAULTS.enemyRadius),
    enemyHealth: positiveOr(source.enemyHealth ?? enemy.maxHealth, GAMEPLAY_DEFAULTS.enemyHealth),
    enemyContactDamage: positiveOr(
      source.enemyContactDamage ?? enemy.contactDamage,
      GAMEPLAY_DEFAULTS.enemyContactDamage,
    ),
    enemyMinSpeed,
    enemyMaxSpeed,
    enemyMinScale,
    enemyMaxScale,
    enemyMinRotation: finiteOr(
      source.enemyMinRotation ?? enemy.minRotation,
      GAMEPLAY_DEFAULTS.enemyMinRotation,
    ),
    enemyMaxRotation: Math.max(
      finiteOr(
        source.enemyMinRotation ?? enemy.minRotation,
        GAMEPLAY_DEFAULTS.enemyMinRotation,
      ),
      finiteOr(
        source.enemyMaxRotation ?? enemy.maxRotation,
        GAMEPLAY_DEFAULTS.enemyMaxRotation,
      ),
    ),
    initialSpawnIntervalMs,
    minSpawnIntervalMs,
    difficultyIntervalMs: positiveOr(
      source.difficultyIntervalMs ?? difficulty.intervalMs,
      GAMEPLAY_DEFAULTS.difficultyIntervalMs,
    ),
    maxDifficultyLevel,
    enemySpeedRampPerLevel: Math.max(
      0,
      finiteOr(
        source.enemySpeedRampPerLevel ?? difficulty.speedRampPerLevel,
        GAMEPLAY_DEFAULTS.enemySpeedRampPerLevel,
      ),
    ),
    invulnerabilityMs: Math.max(
      0,
      finiteOr(source.invulnerabilityMs, GAMEPLAY_DEFAULTS.invulnerabilityMs),
    ),
    scorePerEnemy: Math.max(0, finiteOr(source.scorePerEnemy, GAMEPLAY_DEFAULTS.scorePerEnemy)),
    maxEnemies: integerOr(source.maxEnemies, GAMEPLAY_DEFAULTS.maxEnemies, 0),
    maxBullets: integerOr(source.maxBullets, GAMEPLAY_DEFAULTS.maxBullets, 0),
    maxEntities: integerOr(source.maxEntities, GAMEPLAY_DEFAULTS.maxEntities, 1),
    world: Object.freeze({ width: worldWidth, height: worldHeight }),
    player: Object.freeze({
      speed: positiveOr(source.playerSpeed ?? player.speed, GAMEPLAY_DEFAULTS.playerSpeed),
      radius: playerRadius,
      maxHealth: playerHealth,
    }),
    bullet: Object.freeze({
      speed: positiveOr(source.bulletSpeed ?? bullet.speed, GAMEPLAY_DEFAULTS.bulletSpeed),
      radius: positiveOr(source.bulletRadius ?? bullet.radius, GAMEPLAY_DEFAULTS.bulletRadius),
      damage: positiveOr(source.bulletDamage ?? bullet.damage, GAMEPLAY_DEFAULTS.bulletDamage),
      cooldownMs: Math.max(
        0,
        finiteOr(source.fireCooldownMs ?? bullet.cooldownMs, GAMEPLAY_DEFAULTS.fireCooldownMs),
      ),
      lifetimeMs: positiveOr(
        source.bulletLifetimeMs ?? bullet.lifetimeMs,
        GAMEPLAY_DEFAULTS.bulletLifetimeMs,
      ),
    }),
    enemy: Object.freeze({
      radius: positiveOr(source.enemyRadius ?? enemy.radius, GAMEPLAY_DEFAULTS.enemyRadius),
      maxHealth: positiveOr(source.enemyHealth ?? enemy.maxHealth, GAMEPLAY_DEFAULTS.enemyHealth),
      contactDamage: positiveOr(
        source.enemyContactDamage ?? enemy.contactDamage,
        GAMEPLAY_DEFAULTS.enemyContactDamage,
      ),
      minSpeed: enemyMinSpeed,
      maxSpeed: enemyMaxSpeed,
      minScale: enemyMinScale,
      maxScale: enemyMaxScale,
      minRotation: finiteOr(
        source.enemyMinRotation ?? enemy.minRotation,
        GAMEPLAY_DEFAULTS.enemyMinRotation,
      ),
      maxRotation: Math.max(
        finiteOr(
          source.enemyMinRotation ?? enemy.minRotation,
          GAMEPLAY_DEFAULTS.enemyMinRotation,
        ),
        finiteOr(
          source.enemyMaxRotation ?? enemy.maxRotation,
          GAMEPLAY_DEFAULTS.enemyMaxRotation,
        ),
      ),
    }),
    difficulty: Object.freeze({
      intervalMs: positiveOr(
        source.difficultyIntervalMs ?? difficulty.intervalMs,
        GAMEPLAY_DEFAULTS.difficultyIntervalMs,
      ),
      initialSpawnIntervalMs,
      minimumSpawnIntervalMs: minSpawnIntervalMs,
      maximumLevel: maxDifficultyLevel,
      speedRampPerLevel: Math.max(
        0,
        finiteOr(
          source.enemySpeedRampPerLevel ?? difficulty.speedRampPerLevel,
          GAMEPLAY_DEFAULTS.enemySpeedRampPerLevel,
        ),
      ),
    }),
  });
}
