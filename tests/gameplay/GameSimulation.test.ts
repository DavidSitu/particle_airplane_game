import { describe, expect, it } from 'vitest';
import {
  GAMEPLAY_DEFAULTS,
  GameSimulation,
  SeededRandom,
  circlesOverlap,
  createGameSimulation,
  type GameEvent,
  type GameplayConfig,
  type RandomSource,
  type StartGameCommand,
} from '../../src/systems/gameplay';

class SequenceRandom implements RandomSource {
  private index = 0;

  public constructor(private readonly values: readonly number[]) {}

  public next(): number {
    const value = this.values[this.index % this.values.length] ?? 0;
    this.index += 1;
    return value;
  }
}

function command(
  sessionId = 'test-session',
  seed = 42,
  config?: Partial<GameplayConfig>,
  appearance?: StartGameCommand['appearance'],
): StartGameCommand {
  return { sessionId, seed, config, appearance };
}

function advance(simulation: GameSimulation, count: number, input = {}): GameEvent[] {
  const events: GameEvent[] = [];
  for (let index = 0; index < count; index += 1) {
    events.push(...simulation.advanceFixedStep(input));
  }
  return events;
}

describe('gameplay defaults and deterministic random source', () => {
  it('centralizes the approved tuned approximation values', () => {
    expect(GAMEPLAY_DEFAULTS.tuningStatus).toBe('TUNED APPROXIMATION');
    expect(GAMEPLAY_DEFAULTS.worldWidth).toBe(540);
    expect(GAMEPLAY_DEFAULTS.worldHeight).toBe(960);
    expect(GAMEPLAY_DEFAULTS.playerSpeed).toBe(320);
    expect(GAMEPLAY_DEFAULTS.playerRadius).toBe(24);
    expect(GAMEPLAY_DEFAULTS.playerHealth).toBe(100);
    expect(GAMEPLAY_DEFAULTS.bulletSpeed).toBe(720);
    expect(GAMEPLAY_DEFAULTS.bulletRadius).toBe(8);
    expect(GAMEPLAY_DEFAULTS.bulletDamage).toBe(20);
    expect(GAMEPLAY_DEFAULTS.fireCooldownMs).toBe(180);
    expect(GAMEPLAY_DEFAULTS.enemyContactDamage).toBe(20);
    expect(GAMEPLAY_DEFAULTS.invulnerabilityMs).toBe(900);
    expect(GAMEPLAY_DEFAULTS.initialSpawnIntervalMs).toBe(1_000);
    expect(GAMEPLAY_DEFAULTS.minSpawnIntervalMs).toBe(280);
    expect(GAMEPLAY_DEFAULTS.enemyMinSpeed).toBe(72);
    expect(GAMEPLAY_DEFAULTS.enemyMaxSpeed).toBe(150);
    expect(GAMEPLAY_DEFAULTS.enemyMinScale).toBe(0.78);
    expect(GAMEPLAY_DEFAULTS.enemyMaxScale).toBe(1.28);
    expect(GAMEPLAY_DEFAULTS.enemyMinRotation).toBe(-1.5);
    expect(GAMEPLAY_DEFAULTS.enemyMaxRotation).toBe(1.5);
    expect(GAMEPLAY_DEFAULTS.scorePerEnemy).toBe(100);
    expect(GAMEPLAY_DEFAULTS.difficultyIntervalMs).toBe(15_000);
  });

  it('produces a repeatable XorShift stream and supports zero seeds', () => {
    const first = new SeededRandom(123);
    const second = new SeededRandom(123);
    expect(Array.from({ length: 8 }, () => first.next())).toEqual(
      Array.from({ length: 8 }, () => second.next()),
    );
    expect(new SeededRandom(0).next()).toBe(new SeededRandom(0).next());
  });

  it('replays the same seed and input log with identical snapshots and events', () => {
    const config = {
      initialSpawnIntervalMs: 120,
      minSpawnIntervalMs: 120,
      bulletLifetimeMs: 2_000,
    };
    const first = createGameSimulation();
    const second = createGameSimulation();
    first.start(command('same', 9, config));
    second.start(command('same', 9, config));
    for (let index = 0; index < 100; index += 1) {
      const input = {
        moveX: index % 3 === 0 ? 1 : -0.25,
        moveY: index % 5 === 0 ? -1 : 0.1,
        aimWorldX: 270 + index,
        aimWorldY: 120,
        fireHeld: index % 4 !== 0,
        firePressed: index === 0,
      };
      expect(first.advanceFixedStep(input)).toEqual(second.advanceFixedStep(input));
      expect(first.snapshot()).toEqual(second.snapshot());
    }
  });
});

describe('player movement, aiming, and firing', () => {
  it('normalizes movement and clamps the fixed-radius player to arena bounds', () => {
    const simulation = new GameSimulation();
    simulation.start(command('movement', 1, {
      worldWidth: 100,
      worldHeight: 100,
      playerRadius: 10,
      playerStartX: 50,
      playerStartY: 50,
      initialSpawnIntervalMs: 10_000,
      minSpawnIntervalMs: 10_000,
    }));

    simulation.advanceFixedStep({ moveX: 1, moveY: 1, aimWorldX: 0, aimWorldY: 0 });
    const moved = simulation.snapshot().player;
    expect(moved.x).toBeCloseTo(50 + (320 / Math.sqrt(2)) / 60, 8);
    expect(moved.y).toBeCloseTo(50 + (320 / Math.sqrt(2)) / 60, 8);
    advance(simulation, 100, { moveX: 1, moveY: 1 });
    expect(simulation.snapshot().player.x).toBe(90);
    expect(simulation.snapshot().player.y).toBe(90);
    advance(simulation, 100, { moveX: -1, moveY: -1 });
    expect(simulation.snapshot().player.x).toBe(10);
    expect(simulation.snapshot().player.y).toBe(10);
  });

  it('aims toward the world point and uses a stable last direction for coincident aim', () => {
    const simulation = new GameSimulation();
    simulation.start(command('aim', 1, {
      worldWidth: 200,
      worldHeight: 200,
      playerStartX: 100,
      playerStartY: 100,
      initialSpawnIntervalMs: 10_000,
      minSpawnIntervalMs: 10_000,
    }));
    simulation.advanceFixedStep({ aimWorldX: 150, aimWorldY: 100 });
    expect(simulation.snapshot().player.aimDirection).toEqual({ x: 1, y: 0 });
    simulation.advanceFixedStep({ aimWorldX: 100, aimWorldY: 100, firePressed: true });
    const bullet = simulation.snapshot().bullets[0];
    expect(bullet?.velocity.x).toBe(720);
    expect(bullet?.velocity.y).toBe(0);
  });

  it('supports held and pressed fire while enforcing the cooldown', () => {
    const simulation = new GameSimulation();
    simulation.start(command('fire', 1, {
      initialSpawnIntervalMs: 10_000,
      minSpawnIntervalMs: 10_000,
      bulletLifetimeMs: 10_000,
    }));
    expect(simulation.advanceFixedStep({ firePressed: true })).toHaveLength(1);
    expect(simulation.snapshot().bullets).toHaveLength(1);
    expect(advance(simulation, 10, { fireHeld: true })).toHaveLength(0);
    expect(advance(simulation, 1, { fireHeld: true })).toHaveLength(1);
    expect(simulation.snapshot().bullets).toHaveLength(2);
  });

  it('expires bullets by lifetime and enforces the bullet cap', () => {
    const simulation = new GameSimulation();
    simulation.start(command('bullet-cap', 1, {
      initialSpawnIntervalMs: 10_000,
      minSpawnIntervalMs: 10_000,
      bulletLifetimeMs: 50,
      maxBullets: 1,
    }));
    simulation.advanceFixedStep({ firePressed: true });
    expect(simulation.snapshot().bullets).toHaveLength(1);
    expect(simulation.advanceFixedStep({ firePressed: true })).toHaveLength(0);
    expect(simulation.snapshot().bullets).toHaveLength(1);
    simulation.advanceFixedStep();
    expect(simulation.snapshot().bullets).toHaveLength(0);
  });
});

describe('enemy spawning, visuals, motion, and collision', () => {
  it('spawns at an arena edge with four deterministic appearance variants and bounded visual variation', () => {
    const values = [
      0, 0.1, 0, 0.5, 0.5, 0.5,
      0.25, 0.2, 0.25, 0.5, 0.5, 0.5,
      0.5, 0.3, 0.5, 0.5, 0.5, 0.5,
      0.75, 0.4, 0.75, 0.5, 0.5, 0.5,
    ];
    const simulation = new GameSimulation(new SequenceRandom(values));
    simulation.start(command('variants', 1, {
      initialSpawnIntervalMs: 100,
      minSpawnIntervalMs: 100,
      maxEnemies: 4,
      enemyMinSpeed: 72,
      enemyMaxSpeed: 150,
    }, {
      playerAssetKey: 'player.default',
      enemyAssetKeys: ['custom-a', 'custom-b', 'custom-c', 'custom-d'],
    }));
    const spawnEvents = advance(simulation, 24);
    const enemies = simulation.snapshot().enemies;
    expect(enemies).toHaveLength(4);
    expect(enemies.map((enemy) => enemy.variant)).toEqual([0, 1, 2, 3]);
    expect(enemies.map((enemy) => enemy.appearanceKey)).toEqual([
      'custom-a', 'custom-b', 'custom-c', 'custom-d',
    ]);
    for (const enemy of enemies) {
      expect(enemy.speed).toBeGreaterThanOrEqual(72);
      expect(enemy.speed).toBeLessThanOrEqual(150);
      expect(enemy.scale).toBeGreaterThanOrEqual(0.78);
      expect(enemy.scale).toBeLessThanOrEqual(1.28);
      expect(enemy.rotation).toBeGreaterThanOrEqual(-1.5);
      expect(enemy.rotation).toBeLessThanOrEqual(1.5);
    }
    const firstSpawn = spawnEvents.find((event) => event.type === 'enemy-spawned');
    expect(firstSpawn?.type).toBe('enemy-spawned');
    if (firstSpawn?.type === 'enemy-spawned') {
      expect(firstSpawn.enemy.y).toBe(-28);
    }
  });

  it('moves enemies toward the player without using image dimensions', () => {
    const simulation = new GameSimulation(new SequenceRandom([0, 0.5, 0, 0.5, 0.5, 0.5]));
    simulation.start(command('enemy-motion', 1, {
      worldWidth: 100,
      worldHeight: 100,
      playerRadius: 5,
      playerStartX: 50,
      playerStartY: 80,
      enemyRadius: 5,
      enemyMinSpeed: 60,
      enemyMaxSpeed: 60,
      initialSpawnIntervalMs: 100,
      minSpawnIntervalMs: 100,
      maxEnemies: 1,
    }, {
      player: { kind: 'local-upload', id: 'huge-image', revision: 8 },
      enemies: [{ kind: 'local-upload', id: 'wide-image', revision: 1 }],
    }));
    advance(simulation, 6);
    const first = simulation.snapshot().enemies[0];
    expect(first).toBeDefined();
    const initialY = first?.y ?? 0;
    simulation.advanceFixedStep();
    expect(simulation.snapshot().enemies[0]?.y).toBeGreaterThan(initialY);
    expect(simulation.snapshot().player.radius).toBe(5);
    expect(simulation.snapshot().enemies[0]?.radius).toBe(5);
  });

  it('selects all entries from a custom roster of up to eight enemy appearances', () => {
    const values: number[] = [];
    for (let variant = 0; variant < 8; variant += 1) {
      values.push(0, 0.5, variant / 8, 0.5, 0.5, 0.5);
    }
    const simulation = new GameSimulation(new SequenceRandom(values));
    simulation.start(command('custom-roster', 1, {
      initialSpawnIntervalMs: 100,
      minSpawnIntervalMs: 100,
      maxEnemies: 8,
    }, {
      enemyAssetKeys: Array.from({ length: 8 }, (_, index) => `custom-${index}`),
    }));
    const events = advance(simulation, 48).filter((event) => event.type === 'enemy-spawned');
    expect(events).toHaveLength(8);
    expect(events.map((event) => event.enemy.appearanceVariant)).toEqual(
      Array.from({ length: 8 }, (_, index) => index),
    );
    expect(events.map((event) => event.enemy.appearanceKey)).toEqual(
      Array.from({ length: 8 }, (_, index) => `custom-${index}`),
    );
  });

  it('uses pure circle collision, destroys enemies once, and awards score once', () => {
    expect(circlesOverlap({ x: 0, y: 0, radius: 2 }, { x: 3, y: 0, radius: 1 })).toBe(true);
    expect(circlesOverlap({ x: 0, y: 0, radius: 2 }, { x: 4.1, y: 0, radius: 1 })).toBe(false);

    const simulation = new GameSimulation(new SequenceRandom([0, 0.5, 0, 0, 0.5, 0.5]));
    simulation.start(command('collision', 1, {
      worldWidth: 100,
      worldHeight: 100,
      playerRadius: 5,
      playerStartX: 50,
      playerStartY: 80,
      enemyRadius: 5,
      enemyHealth: 10,
      enemyMinSpeed: 0.001,
      enemyMaxSpeed: 0.001,
      bulletRadius: 2,
      bulletDamage: 20,
      initialSpawnIntervalMs: 100,
      minSpawnIntervalMs: 100,
      maxEnemies: 1,
      bulletLifetimeMs: 10_000,
    }));
    advance(simulation, 6);
    const events: GameEvent[] = [];
    for (let index = 0; index < 10; index += 1) {
      events.push(...simulation.advanceFixedStep({ aimWorldX: 50, aimWorldY: 0, firePressed: index === 0 }));
    }
    expect(events.filter((event) => event.type === 'enemy-hit')).toHaveLength(1);
    expect(events.filter((event) => event.type === 'enemy-destroyed')).toHaveLength(1);
    expect(simulation.snapshot().score).toBe(100);
    expect(simulation.snapshot().defeatedEnemies).toBe(1);
  });
});

describe('damage, difficulty, pause, and lifecycle', () => {
  it('applies contact damage with invulnerability and reaches game over exactly once', () => {
    const simulation = new GameSimulation(new SequenceRandom([0, 0.5, 0, 1, 1, 0.5]));
    simulation.start(command('damage', 1, {
      worldWidth: 100,
      worldHeight: 100,
      playerRadius: 5,
      playerStartX: 50,
      playerStartY: 80,
      enemyRadius: 5,
      enemyMinSpeed: 500,
      enemyMaxSpeed: 500,
      playerHealth: 40,
      enemyContactDamage: 20,
      invulnerabilityMs: 900,
      initialSpawnIntervalMs: 100,
      minSpawnIntervalMs: 100,
      maxEnemies: 1,
    }));
    const events = advance(simulation, 30);
    expect(events.filter((event) => event.type === 'player-damaged')).toHaveLength(1);
    expect(simulation.snapshot().player.isInvulnerable).toBe(true);
    const laterEvents = advance(simulation, 70);
    expect(laterEvents.filter((event) => event.type === 'player-damaged')).toHaveLength(1);
    expect(laterEvents.filter((event) => event.type === 'session-ended')).toHaveLength(1);
    expect(simulation.snapshot().lifecycle).toBe('ended');
    expect(simulation.snapshot().player.health).toBe(0);
    expect(simulation.advanceFixedStep({ firePressed: true })).toEqual([]);
    expect(simulation.end('manual')).toEqual(simulation.snapshot().result);
  });

  it('changes difficulty only at fixed thresholds and trends spawn interval downward', () => {
    const simulation = new GameSimulation();
    simulation.start(command('difficulty', 1, {
      difficultyIntervalMs: 100,
      initialSpawnIntervalMs: 10_000,
      minSpawnIntervalMs: 10_000,
      maxDifficultyLevel: 2,
    }));
    expect(simulation.snapshot().difficultyLevel).toBe(0);
    expect(advance(simulation, 5).filter((event) => event.type === 'difficulty-changed')).toHaveLength(0);
    const first = advance(simulation, 1).filter((event) => event.type === 'difficulty-changed');
    expect(first).toHaveLength(1);
    expect(simulation.snapshot().difficulty.spawnIntervalMs).toBe(10_000);
    const second = advance(simulation, 6).filter((event) => event.type === 'difficulty-changed');
    expect(second).toHaveLength(1);
    expect(simulation.snapshot().difficultyLevel).toBe(2);
  });

  it('freezes all simulation state while paused and resumes explicitly', () => {
    const simulation = new GameSimulation();
    simulation.start(command('pause', 1, {
      initialSpawnIntervalMs: 100,
      minSpawnIntervalMs: 100,
    }));
    advance(simulation, 3, { moveX: 1 });
    const beforePause = simulation.snapshot();
    expect(simulation.pause().lifecycle).toBe('paused');
    expect(simulation.advanceFixedStep({ moveX: -1, firePressed: true })).toEqual([]);
    expect(simulation.snapshot()).toEqual({ ...beforePause, lifecycle: 'paused', status: 'paused' });
    expect(simulation.resume().lifecycle).toBe('running');
    simulation.advanceFixedStep({ moveX: -1 });
    expect(simulation.snapshot().elapsedMs).toBeGreaterThan(beforePause.elapsedMs);
  });

  it('creates fresh state on reset/start and makes disposal terminal', () => {
    const simulation = new GameSimulation();
    simulation.start(command('first', 1));
    advance(simulation, 5, { firePressed: true });
    simulation.end('manual');
    const fresh = simulation.start(command('second', 2));
    expect(fresh.lifecycle).toBe('running');
    expect(fresh.sessionId).toBe('second');
    expect(fresh.score).toBe(0);
    expect(fresh.defeatedEnemies).toBe(0);
    expect(fresh.elapsedMs).toBe(0);
    expect(fresh.bullets).toHaveLength(0);
    simulation.dispose();
    expect(simulation.snapshot().lifecycle).toBe('disposed');
    expect(simulation.snapshot().bullets).toHaveLength(0);
    expect(simulation.snapshot().enemies).toHaveLength(0);
    expect(() => simulation.start(command('third', 3))).toThrow('disposed');
  });
});
