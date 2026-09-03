import {
  ENEMY_DEFINITION_IDS,
  PLANE_SHOOTER_PARITY,
  type EnemyDefinition,
  type EnemyDefinitionId,
  type PlaneShooterConfig,
} from '../../config/planeShooterParity';
import type {
  AppearanceReference,
  EnemySnapshot,
  GameEvent,
  PlaneShooterAppearance,
  PlaneShooterCommand,
  PlaneShooterCommandResult,
  PlaneShooterInputFrame,
  PlaneShooterLifecycle,
  PlaneShooterResult,
  PlaneShooterSimulationApi,
  PlaneShooterSnapshot,
  PlayerSnapshot,
  ProjectileSnapshot,
  StartRunCommand,
  Vector2,
} from './contracts';
import {
  clamp,
  movingCirclesOverlap,
  normalizeMoveVector,
  randomRange,
} from './PlaneShooterRules';
import { SeededRandom, type RandomSource } from './ports';

interface MutableProjectile {
  id: string;
  position: Vector2;
  previousPosition: Vector2;
  velocity: Vector2;
  hitboxRadius: number;
  damage: number;
}

interface MutableEnemy {
  id: string;
  definitionId: EnemyDefinitionId;
  position: Vector2;
  previousPosition: Vector2;
  velocity: Vector2;
  hitboxRadius: number;
  currentHealth: number;
  maxHealth: number;
  movementSpeed: number;
  lifetimeRemainingSeconds: number;
  scoreValue: number;
  playerContactDamage: number;
  appearanceKey: string;
  scale: number;
  rotationDegrees: number;
  rotationSpeedDegreesPerSecond: number;
}

export interface PlaneShooterSimulationOptions {
  readonly config?: PlaneShooterConfig;
  readonly random?: RandomSource;
}

function appearanceKey(reference: AppearanceReference | undefined, fallback: string): string {
  if (typeof reference === 'string' && reference.length > 0) return reference;
  if (reference && typeof reference === 'object') {
    if (reference.assetKey) return reference.assetKey;
    if (reference.id) return reference.id;
  }
  return fallback;
}

function cloneVector(vector: Vector2): Vector2 {
  return { x: vector.x, y: vector.y };
}

export class PlaneShooterSimulation implements PlaneShooterSimulationApi {
  public readonly config: PlaneShooterConfig;

  private readonly random: RandomSource;
  private lifecycle: PlaneShooterLifecycle = 'idle';
  private sessionId = '';
  private seed = 0;
  private elapsedSeconds = 0;
  private spawnClockSeconds = 0;
  private score = 0;
  private moveVector: Vector2 = { x: 0, y: 0 };
  private playerPosition: Vector2;
  private playerPreviousPosition: Vector2;
  private playerHealth: number;
  private playerAppearanceKey = 'player.default';
  private enemyAppearance: PlaneShooterAppearance = {};
  private projectiles: MutableProjectile[] = [];
  private enemies: MutableEnemy[] = [];
  private projectileSequence = 0;
  private enemySequence = 0;
  private result: PlaneShooterResult | undefined;

  public constructor(options: PlaneShooterSimulationOptions = {}) {
    this.config = options.config ?? PLANE_SHOOTER_PARITY;
    this.random = options.random ?? new SeededRandom(0);
    this.playerPosition = cloneVector(this.config.player.startPosition);
    this.playerPreviousPosition = cloneVector(this.playerPosition);
    this.playerHealth = this.config.player.startingHealth;
  }

  public start(command: StartRunCommand): PlaneShooterSnapshot {
    if (this.lifecycle === 'disposed') return this.snapshot();
    this.reset(command);
    return this.snapshot();
  }

  public dispatch(command: PlaneShooterCommand): PlaneShooterCommandResult {
    if (this.lifecycle === 'disposed') {
      return this.failure('disposed', 'The plane-shooter simulation has been disposed.');
    }

    if (command.type === 'RestartRun') {
      this.reset(command.run);
      return this.success([]);
    }

    if (this.lifecycle !== 'running') {
      return this.failure('run-not-active', 'The run is not active.');
    }

    switch (command.type) {
      case 'SetMoveVector':
        this.moveVector = normalizeMoveVector(command.moveVector);
        return this.success([]);
      case 'FirePressed':
        return this.fire();
      case 'AdvanceFrame':
        if (!Number.isFinite(command.deltaSeconds) || command.deltaSeconds <= 0) {
          return this.failure('invalid-delta', 'Frame delta must be a positive finite number.');
        }
        return this.advance(command.deltaSeconds);
    }
  }

  public advanceFixedStep(input: PlaneShooterInputFrame = {}): readonly GameEvent[] {
    if (this.lifecycle !== 'running') return [];

    const events: GameEvent[] = [];
    this.moveVector = normalizeMoveVector({ x: input.moveX ?? 0, y: input.moveY ?? 0 });
    if (input.firePressed) {
      const projectile = this.createProjectile();
      if (projectile) {
        events.push({ type: 'ProjectileSpawned', projectile: this.projectileSnapshot(projectile) });
      }
    }
    this.advanceState(1 / this.config.fixedStepHz, events);
    return events;
  }

  public pause(): PlaneShooterSnapshot {
    if (this.lifecycle === 'running') this.lifecycle = 'paused';
    return this.snapshot();
  }

  public resume(): PlaneShooterSnapshot {
    if (this.lifecycle === 'paused') this.lifecycle = 'running';
    return this.snapshot();
  }

  public snapshot(): PlaneShooterSnapshot {
    const player: PlayerSnapshot = {
      id: 'player',
      x: this.playerPosition.x,
      y: this.playerPosition.y,
      position: cloneVector(this.playerPosition),
      hitboxRadius: this.config.player.hitboxRadius,
      health: this.playerHealth,
      maxHealth: this.config.player.startingHealth,
      movementSpeed: this.config.player.movementSpeed,
      appearanceKey: this.playerAppearanceKey,
    };
    return {
      lifecycle: this.lifecycle,
      sessionId: this.sessionId,
      seed: this.seed,
      elapsedSeconds: this.elapsedSeconds,
      spawnClockSeconds: this.spawnClockSeconds,
      score: this.score,
      player,
      projectiles: this.projectiles.map((projectile) => this.projectileSnapshot(projectile)),
      enemies: this.enemies.map((enemy) => this.enemySnapshot(enemy)),
      ...(this.result ? { result: { ...this.result } } : {}),
    };
  }

  public dispose(): void {
    this.lifecycle = 'disposed';
    this.moveVector = { x: 0, y: 0 };
    this.projectiles = [];
    this.enemies = [];
  }

  private reset(command: StartRunCommand): void {
    this.random.reset?.(command.seed);
    this.lifecycle = 'running';
    this.sessionId = command.sessionId;
    this.seed = command.seed;
    this.elapsedSeconds = 0;
    this.spawnClockSeconds = 0;
    this.score = 0;
    this.moveVector = { x: 0, y: 0 };
    this.playerPosition = cloneVector(this.config.player.startPosition);
    this.playerPreviousPosition = cloneVector(this.playerPosition);
    this.playerHealth = this.config.player.startingHealth;
    this.playerAppearanceKey = appearanceKey(command.appearance?.player, 'player.default');
    this.enemyAppearance = command.appearance ?? {};
    this.projectiles = [];
    this.enemies = [];
    this.projectileSequence = 0;
    this.enemySequence = 0;
    this.result = undefined;
  }

  private fire(): PlaneShooterCommandResult {
    const projectile = this.createProjectile();
    if (!projectile) {
      return this.failure('capacity-reached', 'Projectile capacity has been reached.');
    }
    return this.success([{ type: 'ProjectileSpawned', projectile: this.projectileSnapshot(projectile) }]);
  }

  private createProjectile(): MutableProjectile | undefined {
    if (this.projectiles.length >= this.config.maxProjectiles) {
      return undefined;
    }
    const projectile: MutableProjectile = {
      id: `projectile-${++this.projectileSequence}`,
      position: {
        x: this.playerPosition.x,
        y: this.playerPosition.y + this.config.player.muzzleOffsetY,
      },
      previousPosition: {
        x: this.playerPosition.x,
        y: this.playerPosition.y + this.config.player.muzzleOffsetY,
      },
      velocity: {
        x: this.config.projectile.movementDirection.x * this.config.projectile.speed,
        y: this.config.projectile.movementDirection.y * this.config.projectile.speed,
      },
      hitboxRadius: this.config.projectile.hitboxRadius,
      damage: this.config.projectile.damage,
    };
    this.projectiles.push(projectile);
    return projectile;
  }

  private advance(deltaSeconds: number): PlaneShooterCommandResult {
    const events: GameEvent[] = [];
    this.advanceState(deltaSeconds, events);
    return this.success(events);
  }

  private advanceState(deltaSeconds: number, events: GameEvent[]): void {
    this.elapsedSeconds += deltaSeconds;
    this.spawnClockSeconds += deltaSeconds;

    this.playerPreviousPosition = cloneVector(this.playerPosition);
    this.playerPosition = {
      x: clamp(
        this.playerPosition.x + this.moveVector.x * this.config.player.movementSpeed * deltaSeconds,
        this.config.player.movementBounds.minX,
        this.config.player.movementBounds.maxX,
      ),
      y: clamp(
        this.playerPosition.y + this.moveVector.y * this.config.player.movementSpeed * deltaSeconds,
        this.config.player.movementBounds.minY,
        this.config.player.movementBounds.maxY,
      ),
    };

    for (const projectile of this.projectiles) {
      projectile.previousPosition = cloneVector(projectile.position);
      projectile.position = {
        x: projectile.position.x + projectile.velocity.x * deltaSeconds,
        y: projectile.position.y + projectile.velocity.y * deltaSeconds,
      };
    }
    for (const enemy of this.enemies) {
      enemy.previousPosition = cloneVector(enemy.position);
      enemy.position = {
        x: enemy.position.x,
        y: enemy.position.y + enemy.velocity.y * deltaSeconds,
      };
      enemy.lifetimeRemainingSeconds -= deltaSeconds;
      enemy.rotationDegrees =
        (enemy.rotationDegrees + enemy.rotationSpeedDegreesPerSecond * deltaSeconds) % 360;
    }

    const interval = this.config.spawner.intervalSeconds;
    while (this.spawnClockSeconds + Number.EPSILON >= interval) {
      this.spawnClockSeconds = Math.max(0, this.spawnClockSeconds - interval);
      if (this.enemies.length < this.config.maxEnemies) {
        const enemy = this.spawnEnemy();
        this.enemies.push(enemy);
        events.push({ type: 'EnemySpawned', enemy: this.enemySnapshot(enemy) });
      }
    }

    this.resolveProjectileCollisions(events);
    if (this.lifecycle === 'running') this.resolvePlayerCollisions(events);

    if (this.lifecycle === 'running') {
      this.projectiles = this.projectiles.filter(
        (projectile) => projectile.position.y <= this.config.camera.maxY + this.config.despawnMargin,
      );
      this.enemies = this.enemies.filter(
        (enemy) =>
          enemy.lifetimeRemainingSeconds > Number.EPSILON &&
          enemy.position.y >= this.config.camera.minY - this.config.despawnMargin,
      );
    }
  }

  private spawnEnemy(): MutableEnemy {
    const roster = this.config.spawner.enemyRoster;
    const definitionIndex = Math.min(
      roster.length - 1,
      Math.floor(this.random.next() * roster.length),
    );
    const definitionId = roster[Math.max(0, definitionIndex)] ?? ENEMY_DEFINITION_IDS[0];
    const definition = this.config.enemyDefinitions[definitionId];
    const x = randomRange(
      this.random.next(),
      -this.config.spawner.configuredAreaWidth,
      this.config.spawner.configuredAreaWidth,
    );
    const scale = definition.scale.mode === 'random'
      ? randomRange(this.random.next(), definition.scale.min, definition.scale.max)
      : definition.scale.min;
    const appearance = this.enemyAppearanceFor(definition);
    return {
      id: `enemy-${++this.enemySequence}`,
      definitionId,
      position: { x, y: this.config.spawner.configuredAreaHeight },
      previousPosition: { x, y: this.config.spawner.configuredAreaHeight },
      velocity: { x: 0, y: -definition.movementSpeed },
      hitboxRadius: this.config.enemyHitboxRadius,
      currentHealth: definition.maxHealth,
      maxHealth: definition.maxHealth,
      movementSpeed: definition.movementSpeed,
      lifetimeRemainingSeconds: definition.lifetimeSeconds,
      scoreValue: definition.scoreValue,
      playerContactDamage: definition.playerContactDamage,
      appearanceKey: appearance,
      scale,
      rotationDegrees: 0,
      rotationSpeedDegreesPerSecond: definition.rotationSpeedDegreesPerSecond,
    };
  }

  private enemyAppearanceFor(definition: EnemyDefinition): string {
    const roster = this.enemyAppearance.enemies ?? [];
    if (roster.length === 0) return definition.defaultAppearanceKey;
    if (this.enemyAppearance.enemyAppearanceMode === 'pool') {
      const index = Math.min(roster.length - 1, Math.floor(this.random.next() * roster.length));
      return appearanceKey(roster[Math.max(0, index)], definition.defaultAppearanceKey);
    }
    const definitionIndex = ENEMY_DEFINITION_IDS.indexOf(definition.id);
    return appearanceKey(roster[definitionIndex], definition.defaultAppearanceKey);
  }

  private resolveProjectileCollisions(events: GameEvent[]): void {
    const removedProjectiles = new Set<string>();
    const removedEnemies = new Set<string>();
    for (const projectile of this.projectiles) {
      if (removedProjectiles.has(projectile.id)) continue;
      for (const enemy of this.enemies) {
        if (removedEnemies.has(enemy.id)) continue;
        if (!movingCirclesOverlap(projectile, enemy)) continue;
        removedProjectiles.add(projectile.id);
        enemy.currentHealth -= projectile.damage;
        events.push({
          type: 'EnemyHit',
          enemyId: enemy.id,
          damage: projectile.damage,
          remainingHealth: Math.max(0, enemy.currentHealth),
        });
        if (enemy.currentHealth <= 0) {
          removedEnemies.add(enemy.id);
          this.score += enemy.scoreValue;
          events.push({
            type: 'EnemyDestroyed',
            enemyId: enemy.id,
            definitionId: enemy.definitionId,
            scoreAwarded: enemy.scoreValue,
            score: this.score,
          });
          events.push({ type: 'ScoreChanged', score: this.score });
        }
        break;
      }
    }
    if (removedProjectiles.size > 0) {
      this.projectiles = this.projectiles.filter((item) => !removedProjectiles.has(item.id));
    }
    if (removedEnemies.size > 0) {
      this.enemies = this.enemies.filter((item) => !removedEnemies.has(item.id));
    }
  }

  private resolvePlayerCollisions(events: GameEvent[]): void {
    const playerCircle = {
      previousPosition: this.playerPreviousPosition,
      position: this.playerPosition,
      hitboxRadius: this.config.player.hitboxRadius,
    };
    const removedEnemies = new Set<string>();
    for (const enemy of this.enemies) {
      if (!movingCirclesOverlap(enemy, playerCircle)) continue;
      removedEnemies.add(enemy.id);
      this.playerHealth = Math.max(0, this.playerHealth - enemy.playerContactDamage);
      events.push({
        type: 'PlayerDamaged',
        enemyId: enemy.id,
        damage: enemy.playerContactDamage,
        health: this.playerHealth,
      });
      if (this.playerHealth === 0) {
        this.finish(events);
        break;
      }
    }
    this.enemies = this.enemies.filter((enemy) => !removedEnemies.has(enemy.id));
  }

  private finish(events: GameEvent[]): void {
    if (this.lifecycle !== 'running') return;
    this.lifecycle = 'gameOver';
    this.moveVector = { x: 0, y: 0 };
    this.result = {
      sessionId: this.sessionId,
      seed: this.seed,
      finalScore: this.score,
      endedAtSeconds: this.elapsedSeconds,
    };
    this.projectiles = [];
    this.enemies = [];
    events.push({ type: 'GameOver', result: { ...this.result } });
  }

  private projectileSnapshot(projectile: MutableProjectile): ProjectileSnapshot {
    return {
      id: projectile.id,
      x: projectile.position.x,
      y: projectile.position.y,
      position: cloneVector(projectile.position),
      previousPosition: cloneVector(projectile.previousPosition),
      velocity: cloneVector(projectile.velocity),
      hitboxRadius: projectile.hitboxRadius,
      damage: projectile.damage,
    };
  }

  private enemySnapshot(enemy: MutableEnemy): EnemySnapshot {
    return {
      id: enemy.id,
      definitionId: enemy.definitionId,
      x: enemy.position.x,
      y: enemy.position.y,
      position: cloneVector(enemy.position),
      previousPosition: cloneVector(enemy.previousPosition),
      velocity: cloneVector(enemy.velocity),
      hitboxRadius: enemy.hitboxRadius,
      currentHealth: enemy.currentHealth,
      maxHealth: enemy.maxHealth,
      movementSpeed: enemy.movementSpeed,
      lifetimeRemainingSeconds: enemy.lifetimeRemainingSeconds,
      scoreValue: enemy.scoreValue,
      playerContactDamage: enemy.playerContactDamage,
      appearanceKey: enemy.appearanceKey,
      scale: enemy.scale,
      rotationDegrees: enemy.rotationDegrees,
      rotationSpeedDegreesPerSecond: enemy.rotationSpeedDegreesPerSecond,
    };
  }

  private success(events: readonly GameEvent[]): PlaneShooterCommandResult {
    return { ok: true, snapshot: this.snapshot(), events };
  }

  private failure(
    code: 'disposed' | 'run-not-active' | 'invalid-delta' | 'capacity-reached',
    message: string,
  ): PlaneShooterCommandResult {
    return { ok: false, snapshot: this.snapshot(), failure: { code, message } };
  }
}

export function createPlaneShooterSimulation(
  options: PlaneShooterSimulationOptions = {},
): PlaneShooterSimulation {
  return new PlaneShooterSimulation(options);
}
