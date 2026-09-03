import {
  GAMEPLAY_DEFAULTS,
  resolveGameplayConfig,
  type GameplayConfig,
} from '../../config/gameplayDefaults';
import {
  clamp,
  clampUnit,
  difficultyLevelAt,
  finiteOr,
  spawnIntervalAt,
} from './GameRules';
import { circlesOverlap } from './internal/collision';
import {
  SeededRandom,
  type RandomSource,
  type RandomSourceFactory,
} from './ports';
import type {
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

interface MutablePlayer {
  x: number;
  y: number;
  health: number;
  aimDirection: Vector2;
  aimWorld: Vector2;
}

interface MutableBullet {
  id: string;
  x: number;
  y: number;
  velocity: Vector2;
  ageMs: number;
}

interface MutableEnemy {
  id: string;
  x: number;
  y: number;
  velocity: Vector2;
  speed: number;
  health: number;
  variant: EnemyAppearanceVariant;
  appearanceKey: string;
  scale: number;
  rotation: number;
  angularVelocity: number;
}

export interface GameplaySimulationOptions {
  readonly config?: GameplayConfig | Partial<GameplayConfig>;
  readonly random?: RandomSource;
  readonly rng?: RandomSource;
  readonly randomSource?: RandomSource;
  readonly randomFactory?: RandomSourceFactory;
}

const DEFAULT_AIM: Vector2 = Object.freeze({ x: 0, y: -1 });
const DEFAULT_APPEARANCE: GameplayAppearance = Object.freeze({});
const DEFAULT_ENEMY_KEYS: readonly string[] = ['enemy.01', 'enemy.02', 'enemy.03', 'enemy.04'];

function isRandomSource(value: unknown): value is RandomSource {
  return (
    value !== null &&
    typeof value === 'object' &&
    'next' in value &&
    typeof value.next === 'function'
  );
}

function copyVector(vector: Vector2): Vector2 {
  return { x: vector.x, y: vector.y };
}

function copyResult(result: GameSessionResult): GameSessionResult {
  return { ...result };
}

function extractReferenceKey(reference: AppearanceReference | undefined): string | undefined {
  if (typeof reference === 'string') {
    return reference;
  }
  if (reference && typeof reference.assetKey === 'string') {
    return reference.assetKey;
  }
  if (reference && typeof reference.id === 'string') {
    return reference.id;
  }
  return undefined;
}

function normalizeAppearance(appearance: GameplayAppearance | undefined): GameplayAppearance {
  if (!appearance) {
    return DEFAULT_APPEARANCE;
  }
  return {
    player: appearance.player,
    enemies: appearance.enemies ? [...appearance.enemies] : undefined,
    playerAssetKey: appearance.playerAssetKey,
    enemyAssetKeys: appearance.enemyAssetKeys ? [...appearance.enemyAssetKeys] : undefined,
  };
}

export class GameSimulation implements GameSimulationApi {
  private config: GameplayConfig;
  private readonly configuredRandom?: RandomSource;
  private readonly randomFactory?: RandomSourceFactory;
  private random: RandomSource;
  private lifecycle: GameplayLifecycle = 'idle';
  private sessionId = '';
  private seed = 0;
  private appearance: GameplayAppearance = DEFAULT_APPEARANCE;
  private player: MutablePlayer;
  private bullets: MutableBullet[] = [];
  private enemies: MutableEnemy[] = [];
  private elapsedMs = 0;
  private spawnAccumulatorMs = 0;
  private nextFireAtMs = 0;
  private lastDamageAtMs = Number.NEGATIVE_INFINITY;
  private difficultyLevel = 0;
  private score = 0;
  private defeatedEnemies = 0;
  private nextBulletId = 1;
  private nextEnemyId = 1;
  private result?: GameSessionResult;

  public constructor(
    options: GameplaySimulationOptions | RandomSource = {},
  ) {
    const normalizedOptions = isRandomSource(options) ? { random: options } : options;
    this.config = resolveGameplayConfig(normalizedOptions.config);
    this.configuredRandom = normalizedOptions.random ?? normalizedOptions.rng ?? normalizedOptions.randomSource;
    this.randomFactory = normalizedOptions.randomFactory;
    this.random = this.configuredRandom ?? new SeededRandom(0);
    this.player = this.createInitialPlayer();
  }

  public start(command: StartGameCommand): GameSnapshot {
    if (this.lifecycle === 'disposed') {
      throw new Error('Cannot start a disposed gameplay simulation');
    }

    this.config = resolveGameplayConfig(command.config ?? this.config ?? GAMEPLAY_DEFAULTS);
    this.sessionId = command.sessionId;
    this.seed = Number.isFinite(command.seed) ? Math.trunc(command.seed) : 0;
    this.appearance = normalizeAppearance(command.appearance);
    this.random = this.createRandom(this.seed);
    this.lifecycle = 'running';
    this.player = this.createInitialPlayer();
    this.bullets = [];
    this.enemies = [];
    this.elapsedMs = 0;
    this.spawnAccumulatorMs = 0;
    this.nextFireAtMs = 0;
    this.lastDamageAtMs = Number.NEGATIVE_INFINITY;
    this.difficultyLevel = 0;
    this.score = 0;
    this.defeatedEnemies = 0;
    this.nextBulletId = 1;
    this.nextEnemyId = 1;
    this.result = undefined;
    return this.snapshot();
  }

  /** Explicit reset alias: each call creates fresh session state. */
  public reset(command?: StartGameCommand): GameSnapshot {
    if (!command) {
      throw new Error('A start command is required to reset the simulation');
    }
    return this.start(command);
  }

  /** Explicit restart alias for adapters that use game terminology. */
  public restart(command: StartGameCommand): GameSnapshot {
    return this.start(command);
  }

  public step(input: GameInputFrame = {}): readonly GameEvent[] {
    return this.advanceFixedStep(input);
  }

  public fixedStep(input: GameInputFrame = {}): readonly GameEvent[] {
    return this.advanceFixedStep(input);
  }

  public advanceFixedStep(input: GameInputFrame = {}): readonly GameEvent[] {
    if (this.lifecycle === 'disposed' || this.lifecycle === 'idle' || this.lifecycle === 'ended') {
      return [];
    }

    if (input.pausePressed) {
      if (this.lifecycle === 'running') {
        this.lifecycle = 'paused';
        return [{ type: 'paused', elapsedMs: this.elapsedMs }];
      }
      this.lifecycle = 'running';
      return [{ type: 'resumed', elapsedMs: this.elapsedMs }];
    }

    if (this.lifecycle === 'paused') {
      return [];
    }

    const events: GameEvent[] = [];
    const stepMs = 1_000 / this.config.fixedStepHz;
    const stepSeconds = stepMs / 1_000;
    this.elapsedMs += stepMs;

    this.updateDifficulty(events);
    this.updatePlayer(input, stepSeconds);
    this.maybeFire(input, events);
    this.updateBullets(stepSeconds);
    this.updateEnemies(stepSeconds);
    this.scheduleEnemySpawns(stepMs, events);
    this.resolveCollisions(events);

    if (this.player.health <= 0 && this.lifecycle === 'running') {
      this.endInternal('player-defeated', events);
    }

    return events.map((event) => this.copyEvent(event));
  }

  public pause(): GameSnapshot {
    if (this.lifecycle === 'running') {
      this.lifecycle = 'paused';
    }
    return this.snapshot();
  }

  public resume(): GameSnapshot {
    if (this.lifecycle === 'paused') {
      this.lifecycle = 'running';
    }
    return this.snapshot();
  }

  public end(reason: GameEndReason): GameSessionResult {
    if (this.result) {
      return copyResult(this.result);
    }
    this.result = this.makeResult(reason);
    if (this.lifecycle !== 'disposed') {
      this.lifecycle = 'ended';
    }
    return copyResult(this.result);
  }

  public snapshot(): GameSnapshot {
    const difficulty: DifficultySnapshot = {
      level: this.difficultyLevel,
      nextThresholdMs: (this.difficultyLevel + 1) * this.config.difficultyIntervalMs,
      spawnIntervalMs: spawnIntervalAt(this.difficultyLevel, this.config),
    };
    const result = this.result ? copyResult(this.result) : undefined;
    const player = this.playerSnapshot();
    return {
      lifecycle: this.lifecycle,
      status: this.lifecycle,
      sessionId: this.sessionId,
      seed: this.seed,
      elapsedMs: this.elapsedMs,
      survivalTimeMs: this.elapsedMs,
      score: this.score,
      defeatedEnemies: this.defeatedEnemies,
      difficultyLevel: this.difficultyLevel,
      difficulty,
      player,
      bullets: this.bullets.map((bullet) => this.bulletSnapshot(bullet)),
      enemies: this.enemies.map((enemy) => this.enemySnapshot(enemy)),
      ...(result ? { result } : {}),
    };
  }

  public dispose(): void {
    if (this.lifecycle === 'disposed') {
      return;
    }
    this.bullets = [];
    this.enemies = [];
    this.lifecycle = 'disposed';
  }

  private createRandom(seed: number): RandomSource {
    if (this.randomFactory) {
      return this.randomFactory(seed);
    }
    if (this.configuredRandom) {
      if (this.configuredRandom.reset) {
        this.configuredRandom.reset(seed);
      }
      return this.configuredRandom;
    }
    return new SeededRandom(seed);
  }

  private createInitialPlayer(): MutablePlayer {
    const radius = this.config.playerRadius;
    return {
      x: clamp(this.config.playerStartX, radius, this.config.worldWidth - radius),
      y: clamp(this.config.playerStartY, radius, this.config.worldHeight - radius),
      health: this.config.playerHealth,
      aimDirection: DEFAULT_AIM,
      aimWorld: {
        x: this.config.worldWidth / 2,
        y: 0,
      },
    };
  }

  private updateDifficulty(events: GameEvent[]): void {
    const nextLevel = difficultyLevelAt(this.elapsedMs, this.config);
    if (nextLevel === this.difficultyLevel) {
      return;
    }
    for (let level = this.difficultyLevel + 1; level <= nextLevel; level += 1) {
      events.push({
        type: 'difficulty-changed',
        level,
        spawnIntervalMs: spawnIntervalAt(level, this.config),
      });
    }
    this.difficultyLevel = nextLevel;
  }

  private updatePlayer(input: GameInputFrame, stepSeconds: number): void {
    const moveX = clampUnit(input.moveX);
    const moveY = clampUnit(input.moveY);
    const magnitude = Math.hypot(moveX, moveY);
    const scale = magnitude > 1 ? 1 / magnitude : 1;
    const radius = this.config.playerRadius;
    this.player.x = clamp(
      this.player.x + moveX * scale * this.config.playerSpeed * stepSeconds,
      radius,
      this.config.worldWidth - radius,
    );
    this.player.y = clamp(
      this.player.y + moveY * scale * this.config.playerSpeed * stepSeconds,
      radius,
      this.config.worldHeight - radius,
    );

    const aimWorldX = finiteOr(input.aimWorldX, this.player.aimWorld.x);
    const aimWorldY = finiteOr(input.aimWorldY, this.player.aimWorld.y);
    const aimDeltaX = aimWorldX - this.player.x;
    const aimDeltaY = aimWorldY - this.player.y;
    const aimLength = Math.hypot(aimDeltaX, aimDeltaY);
    if (aimLength > Number.EPSILON) {
      this.player.aimDirection = {
        x: aimDeltaX / aimLength,
        y: aimDeltaY / aimLength,
      };
    }
    this.player.aimWorld = { x: aimWorldX, y: aimWorldY };
  }

  private maybeFire(input: GameInputFrame, events: GameEvent[]): void {
    if (!input.fireHeld && !input.firePressed) {
      return;
    }
    if (this.elapsedMs + Number.EPSILON < this.nextFireAtMs) {
      return;
    }
    if (this.bullets.length >= this.config.maxBullets) {
      return;
    }

    const bullet: MutableBullet = {
      id: `bullet-${this.nextBulletId}`,
      x: this.player.x + this.player.aimDirection.x * (this.config.playerRadius + this.config.bulletRadius),
      y: this.player.y + this.player.aimDirection.y * (this.config.playerRadius + this.config.bulletRadius),
      velocity: {
        x: this.player.aimDirection.x * this.config.bulletSpeed,
        y: this.player.aimDirection.y * this.config.bulletSpeed,
      },
      ageMs: 0,
    };
    this.nextBulletId += 1;
    this.bullets.push(bullet);
    this.nextFireAtMs = this.elapsedMs + this.config.fireCooldownMs;
    events.push({ type: 'shot-fired', bullet: this.bulletSnapshot(bullet) });
  }

  private updateBullets(stepSeconds: number): void {
    const margin = this.config.bulletRadius;
    this.bullets = this.bullets.filter((bullet) => {
      bullet.x += bullet.velocity.x * stepSeconds;
      bullet.y += bullet.velocity.y * stepSeconds;
      bullet.ageMs += stepSeconds * 1_000;
      const aliveByTime = bullet.ageMs < this.config.bulletLifetimeMs;
      const aliveByBounds =
        bullet.x >= -margin &&
        bullet.x <= this.config.worldWidth + margin &&
        bullet.y >= -margin &&
        bullet.y <= this.config.worldHeight + margin;
      return aliveByTime && aliveByBounds;
    });
  }

  private updateEnemies(stepSeconds: number): void {
    for (const enemy of this.enemies) {
      const dx = this.player.x - enemy.x;
      const dy = this.player.y - enemy.y;
      const distance = Math.hypot(dx, dy);
      if (distance > Number.EPSILON) {
        enemy.velocity = {
          x: (dx / distance) * enemy.speed,
          y: (dy / distance) * enemy.speed,
        };
        enemy.x += enemy.velocity.x * stepSeconds;
        enemy.y += enemy.velocity.y * stepSeconds;
      } else {
        enemy.velocity = { x: 0, y: 0 };
      }
      enemy.rotation += enemy.angularVelocity * stepSeconds;
    }
  }

  private scheduleEnemySpawns(stepMs: number, events: GameEvent[]): void {
    this.spawnAccumulatorMs += stepMs;
    let interval = spawnIntervalAt(this.difficultyLevel, this.config);
    while (this.spawnAccumulatorMs + 1e-6 >= interval) {
      this.spawnAccumulatorMs -= interval;
      if (
        this.enemies.length < this.config.maxEnemies &&
        this.enemies.length + this.bullets.length < this.config.maxEntities
      ) {
        const enemy = this.createEnemy();
        this.enemies.push(enemy);
        events.push({ type: 'enemy-spawned', enemy: this.enemySnapshot(enemy) });
      }
      interval = spawnIntervalAt(this.difficultyLevel, this.config);
    }
  }

  private createEnemy(): MutableEnemy {
    const edge = Math.floor(clamp(this.random.next(), 0, 0.999999999) * 4);
    const edgePosition = clamp(this.random.next(), 0, 0.999999999);
    const variantCount = this.enemyAppearanceCount();
    const variant = Math.floor(
      clamp(this.random.next(), 0, 0.999999999) * variantCount,
    ) as EnemyAppearanceVariant;
    const levelSpeedFloor = Math.min(
      this.config.enemyMaxSpeed,
      this.config.enemyMinSpeed + this.difficultyLevel * this.config.enemySpeedRampPerLevel,
    );
    const speed = this.randomRange(levelSpeedFloor, this.config.enemyMaxSpeed);
    const scale = this.randomRange(this.config.enemyMinScale, this.config.enemyMaxScale);
    const rotation = this.randomRange(this.config.enemyMinRotation, this.config.enemyMaxRotation);
    const radius = this.config.enemyRadius;
    let x: number;
    let y: number;
    if (edge === 0) {
      x = edgePosition * this.config.worldWidth;
      y = -radius;
    } else if (edge === 1) {
      x = this.config.worldWidth + radius;
      y = edgePosition * this.config.worldHeight;
    } else if (edge === 2) {
      x = edgePosition * this.config.worldWidth;
      y = this.config.worldHeight + radius;
    } else {
      x = -radius;
      y = edgePosition * this.config.worldHeight;
    }
    return {
      id: `enemy-${this.nextEnemyId++}`,
      x,
      y,
      velocity: { x: 0, y: 0 },
      speed,
      health: this.config.enemyHealth,
      variant,
      appearanceKey: this.enemyAppearanceKey(variant),
      scale,
      rotation,
      angularVelocity: rotation,
    };
  }

  private enemyAppearanceKey(variant: EnemyAppearanceVariant): string {
    const explicitKeys = this.appearance.enemyAssetKeys;
    if (explicitKeys && explicitKeys.length > 0) {
      return explicitKeys[variant % explicitKeys.length] ?? 'enemy.01';
    }
    const references = this.appearance.enemies;
    const referenceKey = extractReferenceKey(references?.[variant]);
    return referenceKey ?? extractReferenceKey(references?.[0]) ??
      DEFAULT_ENEMY_KEYS[variant % DEFAULT_ENEMY_KEYS.length] ?? 'enemy.01';
  }

  private enemyAppearanceCount(): number {
    const explicitCount = this.appearance.enemyAssetKeys?.length ?? 0;
    const referenceCount = this.appearance.enemies?.length ?? 0;
    return Math.max(1, Math.min(8, explicitCount || referenceCount || DEFAULT_ENEMY_KEYS.length));
  }

  private randomRange(minimum: number, maximum: number): number {
    const value = this.random.next();
    const normalized = clamp(Number.isFinite(value) ? value : 0, 0, 0.999999999);
    return minimum + (maximum - minimum) * normalized;
  }

  private resolveCollisions(events: GameEvent[]): void {
    const removedBullets = new Set<string>();
    const removedEnemies = new Set<string>();
    for (const bullet of this.bullets) {
      for (const enemy of this.enemies) {
        if (removedEnemies.has(enemy.id) || removedBullets.has(bullet.id)) {
          continue;
        }
        if (
          !circlesOverlap(
            { x: bullet.x, y: bullet.y, radius: this.config.bulletRadius },
            { x: enemy.x, y: enemy.y, radius: this.config.enemyRadius },
          )
        ) {
          continue;
        }
        enemy.health = Math.max(0, enemy.health - this.config.bulletDamage);
        removedBullets.add(bullet.id);
        events.push({
          type: 'enemy-hit',
          enemyId: enemy.id,
          damage: this.config.bulletDamage,
          remainingHealth: enemy.health,
        });
        if (enemy.health <= 0) {
          removedEnemies.add(enemy.id);
          this.score += this.config.scorePerEnemy;
          this.defeatedEnemies += 1;
          events.push({
            type: 'enemy-destroyed',
            enemyId: enemy.id,
            variant: enemy.variant,
            scoreAwarded: this.config.scorePerEnemy,
            score: this.score,
          });
        }
      }
    }
    this.bullets = this.bullets.filter((bullet) => !removedBullets.has(bullet.id));
    this.enemies = this.enemies.filter((enemy) => !removedEnemies.has(enemy.id));

    if (this.elapsedMs < this.lastDamageAtMs + this.config.invulnerabilityMs) {
      return;
    }
    for (const enemy of this.enemies) {
      if (
        !circlesOverlap(
          { x: this.player.x, y: this.player.y, radius: this.config.playerRadius },
          { x: enemy.x, y: enemy.y, radius: this.config.enemyRadius },
        )
      ) {
        continue;
      }
      this.player.health = Math.max(0, this.player.health - this.config.enemyContactDamage);
      this.lastDamageAtMs = this.elapsedMs;
      events.push({
        type: 'player-damaged',
        enemyId: enemy.id,
        damage: this.config.enemyContactDamage,
        health: this.player.health,
        invulnerableUntilMs: this.lastDamageAtMs + this.config.invulnerabilityMs,
      });
      break;
    }
  }

  private endInternal(reason: GameEndReason, events: GameEvent[]): void {
    if (this.result) {
      return;
    }
    this.result = this.makeResult(reason);
    this.lifecycle = 'ended';
    events.push({ type: 'session-ended', result: copyResult(this.result) });
  }

  private makeResult(reason: GameEndReason): GameSessionResult {
    return {
      sessionId: this.sessionId,
      seed: this.seed,
      reason,
      score: this.score,
      defeatedEnemies: this.defeatedEnemies,
      survivalTimeMs: this.elapsedMs,
      remainingHealth: this.player.health,
      endedAtMs: this.elapsedMs,
    };
  }

  private playerSnapshot(): PlayerSnapshot {
    const invulnerableUntilMs =
      this.lastDamageAtMs === Number.NEGATIVE_INFINITY
        ? 0
        : this.lastDamageAtMs + this.config.invulnerabilityMs;
    return {
      id: 'player',
      x: this.player.x,
      y: this.player.y,
      position: { x: this.player.x, y: this.player.y },
      radius: this.config.playerRadius,
      health: this.player.health,
      maxHealth: this.config.playerHealth,
      invulnerableUntilMs,
      isInvulnerable: this.elapsedMs < invulnerableUntilMs,
      aimDirection: copyVector(this.player.aimDirection),
      aimWorld: copyVector(this.player.aimWorld),
      appearanceKey: extractReferenceKey(this.appearance.player) ??
        this.appearance.playerAssetKey ??
        'player.default',
    };
  }

  private bulletSnapshot(bullet: MutableBullet): BulletSnapshot {
    return {
      id: bullet.id,
      x: bullet.x,
      y: bullet.y,
      position: { x: bullet.x, y: bullet.y },
      velocity: copyVector(bullet.velocity),
      radius: this.config.bulletRadius,
      damage: this.config.bulletDamage,
      ageMs: bullet.ageMs,
      lifetimeMs: this.config.bulletLifetimeMs,
    };
  }

  private enemySnapshot(enemy: MutableEnemy): EnemySnapshot {
    return {
      id: enemy.id,
      x: enemy.x,
      y: enemy.y,
      position: { x: enemy.x, y: enemy.y },
      velocity: copyVector(enemy.velocity),
      radius: this.config.enemyRadius,
      health: enemy.health,
      maxHealth: this.config.enemyHealth,
      speed: enemy.speed,
      variant: enemy.variant,
      appearanceVariant: enemy.variant,
      appearanceKey: enemy.appearanceKey,
      scale: enemy.scale,
      rotation: enemy.rotation,
      angularVelocity: enemy.angularVelocity,
      rotationSpeed: enemy.angularVelocity,
    };
  }

  private copyEvent(event: GameEvent): GameEvent {
    if (event.type === 'shot-fired') {
      return { type: event.type, bullet: { ...event.bullet, position: { ...event.bullet.position }, velocity: { ...event.bullet.velocity } } };
    }
    if (event.type === 'enemy-spawned') {
      return { type: event.type, enemy: { ...event.enemy, position: { ...event.enemy.position }, velocity: { ...event.enemy.velocity } } };
    }
    if (event.type === 'session-ended') {
      return { type: event.type, result: copyResult(event.result) };
    }
    return { ...event };
  }
}

export function createGameSimulation(
  options: GameplaySimulationOptions | RandomSource = {},
): GameSimulation {
  return new GameSimulation(options);
}

export const createGameplaySimulation = createGameSimulation;
