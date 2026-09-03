import { describe, expect, it } from 'vitest';
import {
  ENEMY_DEFINITION_IDS,
  PLANE_SHOOTER_PARITY,
  PlaneShooterSimulation,
  SeededRandom,
  type EnemyDefinitionId,
  type GameEvent,
  type PlaneShooterCommandResult,
  type PlaneShooterConfig,
  type RandomSource,
  type StartRunCommand,
} from '../../src/systems/gameplay';

class SequenceRandom implements RandomSource {
  private index = 0;

  public constructor(private readonly values: readonly number[]) {}

  public next(): number {
    const value = this.values[this.index % this.values.length] ?? 0;
    this.index += 1;
    return value;
  }

  public reset(): void {
    this.index = 0;
  }
}

const startCommand = (
  sessionId = 'plane-test',
  seed = 42,
  appearance?: StartRunCommand['appearance'],
): StartRunCommand => ({ sessionId, seed, appearance });

function expectApplied(result: PlaneShooterCommandResult): Extract<PlaneShooterCommandResult, { ok: true }> {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.failure.message);
  return result;
}

function advance(
  simulation: PlaneShooterSimulation,
  frameCount: number,
): GameEvent[] {
  const events: GameEvent[] = [];
  for (let frame = 0; frame < frameCount; frame += 1) {
    events.push(...expectApplied(simulation.dispatch({
      type: 'AdvanceFrame',
      deltaSeconds: 1 / PLANE_SHOOTER_PARITY.fixedStepHz,
    })).events);
  }
  return events;
}

function makeConfig(
  changes: {
    readonly spawnIntervalSeconds?: number;
    readonly spawnAreaWidth?: number;
    readonly spawnAreaHeight?: number;
    readonly cameraMinY?: number;
    readonly maxEnemies?: number;
    readonly enemySpeed?: number;
  } = {},
): PlaneShooterConfig {
  const enemyDefinitions = Object.fromEntries(
    ENEMY_DEFINITION_IDS.map((id) => [
      id,
      {
        ...PLANE_SHOOTER_PARITY.enemyDefinitions[id],
        movementSpeed: changes.enemySpeed ?? PLANE_SHOOTER_PARITY.enemyDefinitions[id].movementSpeed,
        scale: { ...PLANE_SHOOTER_PARITY.enemyDefinitions[id].scale },
      },
    ]),
  ) as PlaneShooterConfig['enemyDefinitions'];
  return {
    ...PLANE_SHOOTER_PARITY,
    camera: {
      ...PLANE_SHOOTER_PARITY.camera,
      minY: changes.cameraMinY ?? PLANE_SHOOTER_PARITY.camera.minY,
    },
    player: {
      ...PLANE_SHOOTER_PARITY.player,
      startPosition: { ...PLANE_SHOOTER_PARITY.player.startPosition },
    },
    projectile: {
      ...PLANE_SHOOTER_PARITY.projectile,
      movementDirection: { ...PLANE_SHOOTER_PARITY.projectile.movementDirection },
    },
    spawner: {
      ...PLANE_SHOOTER_PARITY.spawner,
      intervalSeconds: changes.spawnIntervalSeconds ?? PLANE_SHOOTER_PARITY.spawner.intervalSeconds,
      configuredAreaWidth: changes.spawnAreaWidth ?? PLANE_SHOOTER_PARITY.spawner.configuredAreaWidth,
      configuredAreaHeight: changes.spawnAreaHeight ?? PLANE_SHOOTER_PARITY.spawner.configuredAreaHeight,
      enemyRoster: [...PLANE_SHOOTER_PARITY.spawner.enemyRoster],
    },
    background: {
      ...PLANE_SHOOTER_PARITY.background,
      scrollingSpeeds: [...PLANE_SHOOTER_PARITY.background.scrollingSpeeds],
    },
    enemyDefinitions,
    maxEnemies: changes.maxEnemies ?? PLANE_SHOOTER_PARITY.maxEnemies,
  };
}

describe('recovered plane-shooter parity configuration', () => {
  it('centralizes the recovered player, projectile, spawner, and background values', () => {
    expect(PLANE_SHOOTER_PARITY.evidence).toBe('RECOVERED FROM SERIALIZED UNITY DATA');
    expect(PLANE_SHOOTER_PARITY.player.startPosition).toEqual({ x: 0, y: -3 });
    expect(PLANE_SHOOTER_PARITY.player.movementSpeed).toBe(5);
    expect(PLANE_SHOOTER_PARITY.player.startingHealth).toBe(3);
    expect(PLANE_SHOOTER_PARITY.player.serializedBoundsValue).toBe(50);
    expect(PLANE_SHOOTER_PARITY.player.boundsInterpretation).toBe('INFERRED/TUNED');
    expect(PLANE_SHOOTER_PARITY.projectile.movementDirection).toEqual({ x: 0, y: 1 });
    expect(PLANE_SHOOTER_PARITY.projectile.speed).toBe(20);
    expect(PLANE_SHOOTER_PARITY.projectile.damage).toBe(1);
    expect(PLANE_SHOOTER_PARITY.projectile.firingMode).toBe('one-per-press');
    expect(PLANE_SHOOTER_PARITY.spawner.intervalSeconds).toBe(0.5);
    expect(PLANE_SHOOTER_PARITY.spawner.configuredAreaWidth).toBe(2);
    expect(PLANE_SHOOTER_PARITY.spawner.configuredAreaHeight).toBe(6);
    expect(PLANE_SHOOTER_PARITY.spawner.enemyRoster).toEqual(ENEMY_DEFINITION_IDS);
    expect(PLANE_SHOOTER_PARITY.background.scrollingSpeeds).toEqual([2.5, 3]);
  });

  it.each([
    ['enemy.base', 2, 15, 8, 1, 1, 'random', 1, 4, 100],
    ['enemy.1', 3, 4, 8, 2, 1, 'random', 1, 1.2, 0],
    ['enemy.2', 4, 5, 8, 4, 1, 'fixed', 1, 1, 0],
    ['enemy.3', 10, 2, 8, 5, 1, 'random', 0.2, 1.2, 0],
  ] as const)(
    '%s exposes the recovered mechanical definition',
    (id, health, speed, lifetime, score, damage, scaleMode, scaleMin, scaleMax, rotation) => {
      const definition = PLANE_SHOOTER_PARITY.enemyDefinitions[id];
      expect(definition.maxHealth).toBe(health);
      expect(definition.movementSpeed).toBe(speed);
      expect(definition.lifetimeSeconds).toBe(lifetime);
      expect(definition.scoreValue).toBe(score);
      expect(definition.playerContactDamage).toBe(damage);
      expect(definition.scale.mode).toBe(scaleMode);
      expect(definition.scale.min).toBe(scaleMin);
      expect(definition.scale.max).toBe(scaleMax);
      expect(definition.rotationSpeedDegreesPerSecond).toBe(rotation);
    },
  );

  it('keeps seeded randomness repeatable', () => {
    const first = new SeededRandom(123);
    const second = new SeededRandom(123);
    expect(Array.from({ length: 8 }, () => first.next())).toEqual(
      Array.from({ length: 8 }, () => second.next()),
    );
  });
});

describe('player and discrete upward firing', () => {
  it('starts at (0, -3) with three health and moves in all four directions at speed five', () => {
    const simulation = new PlaneShooterSimulation({
      config: makeConfig({ spawnIntervalSeconds: 100 }),
    });
    const started = simulation.start(startCommand());
    expect(started.player.position).toEqual({ x: 0, y: -3 });
    expect(started.player.health).toBe(3);

    expectApplied(simulation.dispatch({ type: 'SetMoveVector', moveVector: { x: 1, y: 0 } }));
    expectApplied(simulation.dispatch({ type: 'AdvanceFrame', deltaSeconds: 0.1 }));
    expect(simulation.snapshot().player.x).toBeCloseTo(0.5);

    expectApplied(simulation.dispatch({ type: 'SetMoveVector', moveVector: { x: -1, y: 0 } }));
    expectApplied(simulation.dispatch({ type: 'AdvanceFrame', deltaSeconds: 0.1 }));
    expect(simulation.snapshot().player.x).toBeCloseTo(0);

    expectApplied(simulation.dispatch({ type: 'SetMoveVector', moveVector: { x: 0, y: 1 } }));
    expectApplied(simulation.dispatch({ type: 'AdvanceFrame', deltaSeconds: 0.1 }));
    expect(simulation.snapshot().player.y).toBeCloseTo(-2.5);

    expectApplied(simulation.dispatch({ type: 'SetMoveVector', moveVector: { x: 0, y: -1 } }));
    expectApplied(simulation.dispatch({ type: 'AdvanceFrame', deltaSeconds: 0.1 }));
    expect(simulation.snapshot().player.y).toBeCloseTo(-3);
  });

  it('normalizes diagonal movement and clamps inside the inferred camera padding', () => {
    const simulation = new PlaneShooterSimulation({
      config: makeConfig({ spawnIntervalSeconds: 100 }),
    });
    simulation.start(startCommand());
    expectApplied(simulation.dispatch({ type: 'SetMoveVector', moveVector: { x: 1, y: 1 } }));
    expectApplied(simulation.dispatch({ type: 'AdvanceFrame', deltaSeconds: 10 }));
    const player = simulation.snapshot().player;
    expect(player.x).toBe(PLANE_SHOOTER_PARITY.player.movementBounds.maxX);
    expect(player.y).toBe(PLANE_SHOOTER_PARITY.player.movementBounds.maxY);
  });

  it('creates exactly one muzzle projectile per FirePressed and never uses a cursor angle', () => {
    const simulation = new PlaneShooterSimulation({
      config: makeConfig({ spawnIntervalSeconds: 100 }),
    });
    simulation.start(startCommand());
    const fired = expectApplied(simulation.dispatch({ type: 'FirePressed' }));
    expect(fired.events).toHaveLength(1);
    expect(fired.events[0]?.type).toBe('ProjectileSpawned');
    expect(fired.snapshot.projectiles).toHaveLength(1);
    const projectile = fired.snapshot.projectiles[0];
    expect(projectile?.x).toBe(0);
    expect(projectile?.y).toBeGreaterThan(-3);
    expect(projectile?.velocity).toEqual({ x: 0, y: 20 });
    expect(projectile?.damage).toBe(1);

    expectApplied(simulation.dispatch({ type: 'AdvanceFrame', deltaSeconds: 0.1 }));
    expect(simulation.snapshot().projectiles[0]?.x).toBe(0);
    expect(simulation.snapshot().projectiles[0]?.y).toBeCloseTo((projectile?.y ?? 0) + 2);
  });

  it('does not synthesize automatic fire while advancing held state', () => {
    const simulation = new PlaneShooterSimulation({
      config: makeConfig({ spawnIntervalSeconds: 100 }),
    });
    simulation.start(startCommand());
    const first = simulation.advanceFixedStep({ firePressed: true });
    expect(first.filter((event) => event.type === 'ProjectileSpawned')).toHaveLength(1);
    const later = Array.from({ length: 20 }, () => simulation.advanceFixedStep({
      moveX: 0,
      moveY: 0,
      firePressed: false,
    })).flat();
    expect(later.filter((event) => event.type === 'ProjectileSpawned')).toHaveLength(0);
  });
});

describe('spawning, definitions, lifetime, and appearance', () => {
  it('spawns nothing before 0.5 seconds, once at 0.5, and once per later interval', () => {
    const simulation = new PlaneShooterSimulation({ random: new SequenceRandom([0, 0.5, 0.5]) });
    simulation.start(startCommand());
    expect(advance(simulation, 29).filter((event) => event.type === 'EnemySpawned')).toHaveLength(0);
    expect(advance(simulation, 1).filter((event) => event.type === 'EnemySpawned')).toHaveLength(1);
    expect(advance(simulation, 60).filter((event) => event.type === 'EnemySpawned')).toHaveLength(2);
  });

  it('selects only the four definitions, spawns within width two at y six, and moves downward', () => {
    const rolls = [0, 0.26, 0.51, 0.99];
    for (const [index, roll] of rolls.entries()) {
      const simulation = new PlaneShooterSimulation({
        random: new SequenceRandom([roll, index / 3, 0.5]),
        config: makeConfig({ maxEnemies: 1 }),
      });
      simulation.start(startCommand(`definition-${index}`));
      const events = advance(simulation, 30);
      const spawned = events.find((event) => event.type === 'EnemySpawned');
      expect(spawned?.type).toBe('EnemySpawned');
      if (spawned?.type !== 'EnemySpawned') continue;
      expect(spawned.enemy.definitionId).toBe(ENEMY_DEFINITION_IDS[index]);
      expect(spawned.enemy.x).toBeGreaterThanOrEqual(-2);
      expect(spawned.enemy.x).toBeLessThanOrEqual(2);
      expect(spawned.enemy.y).toBe(6);
      const before = spawned.enemy;
      advance(simulation, 1);
      const after = simulation.snapshot().enemies.find((enemy) => enemy.id === before.id);
      expect(after?.x).toBe(before.x);
      expect(after?.y).toBeLessThan(before.y);
      expect(after?.velocity.x).toBe(0);
      expect(after?.velocity.y).toBe(-before.movementSpeed);
    }
  });

  it('uses each definition scale/rotation rule and deterministic RNG choices', () => {
    const first = new PlaneShooterSimulation({
      random: new SequenceRandom([0, 0.5, 0.75]),
      config: makeConfig({ enemySpeed: 0 }),
    });
    const second = new PlaneShooterSimulation({
      random: new SequenceRandom([0, 0.5, 0.75]),
      config: makeConfig({ enemySpeed: 0 }),
    });
    first.start(startCommand('repeatable'));
    second.start(startCommand('repeatable'));
    advance(first, 30);
    advance(second, 30);
    expect(first.snapshot().enemies).toEqual(second.snapshot().enemies);
    const base = first.snapshot().enemies[0];
    expect(base?.scale).toBeCloseTo(3.25);
    expect(base?.rotationSpeedDegreesPerSecond).toBe(100);
    advance(first, 60);
    expect(first.snapshot().enemies.find((enemy) => enemy.id === base?.id)?.rotationDegrees).toBeCloseTo(100);

    const fixed = new PlaneShooterSimulation({ random: new SequenceRandom([0.6, 0.5]) });
    fixed.start(startCommand('fixed'));
    advance(fixed, 30);
    expect(fixed.snapshot().enemies[0]).toMatchObject({
      definitionId: 'enemy.2',
      scale: 1,
      rotationSpeedDegreesPerSecond: 0,
    });
  });

  it('expires an enemy after eight seconds without awarding score', () => {
    const simulation = new PlaneShooterSimulation({
      random: new SequenceRandom([0.99, 0.5, 0.5]),
      config: makeConfig({ cameraMinY: -100, enemySpeed: 0, maxEnemies: 1 }),
    });
    simulation.start(startCommand('lifetime'));
    advance(simulation, 30);
    const id = simulation.snapshot().enemies[0]?.id;
    expect(id).toBeDefined();
    expectApplied(simulation.dispatch({ type: 'AdvanceFrame', deltaSeconds: 7.99 }));
    expect(simulation.snapshot().enemies.some((enemy) => enemy.id === id)).toBe(true);
    expectApplied(simulation.dispatch({ type: 'AdvanceFrame', deltaSeconds: 0.01 }));
    expect(simulation.snapshot().enemies.some((enemy) => enemy.id === id)).toBe(false);
    expect(simulation.snapshot().score).toBe(0);
  });

  it('keeps custom appearance dimensions outside definition stats and hitboxes', () => {
    const simulation = new PlaneShooterSimulation({
      random: new SequenceRandom([0.99, 0.5, 0.5, 0.75]),
      config: makeConfig({ maxEnemies: 1 }),
    });
    simulation.start(startCommand('appearance', 7, {
      player: { kind: 'local-upload', id: 'player-8192x128', revision: 1 },
      enemies: [
        { kind: 'local-upload', id: 'enemy-128x8192', revision: 1 },
        { kind: 'local-upload', id: 'enemy-512x512', revision: 2 },
      ],
      enemyAppearanceMode: 'pool',
    }));
    advance(simulation, 30);
    const snapshot = simulation.snapshot();
    expect(snapshot.player.appearanceKey).toBe('player-8192x128');
    expect(snapshot.player.hitboxRadius).toBe(PLANE_SHOOTER_PARITY.player.hitboxRadius);
    expect(snapshot.enemies[0]).toMatchObject({
      definitionId: 'enemy.3',
      maxHealth: 10,
      movementSpeed: 2,
      scoreValue: 5,
      playerContactDamage: 1,
      hitboxRadius: PLANE_SHOOTER_PARITY.enemyHitboxRadius,
    });
    expect(snapshot.enemies[0]?.appearanceKey).toMatch(/^enemy-/);
  });
});

describe('definition damage, scoring, contact, and game over', () => {
  const hitCases: readonly [EnemyDefinitionId, number, number, number][] = [
    ['enemy.base', 0, 2, 1],
    ['enemy.1', 0.3, 3, 2],
    ['enemy.2', 0.6, 4, 4],
    ['enemy.3', 0.9, 10, 5],
  ];

  it.each(hitCases)(
    '%s enforces its exact hit count and score',
    (definitionId, definitionRoll, requiredHits, scoreValue) => {
      const simulation = new PlaneShooterSimulation({
        random: new SequenceRandom([definitionRoll, 0.5, 0.5]),
        config: makeConfig({
          spawnIntervalSeconds: 1 / 60,
          spawnAreaWidth: 0,
          spawnAreaHeight: -1,
          maxEnemies: 1,
          enemySpeed: 0,
        }),
      });
      simulation.start(startCommand(`hits-${definitionId}`));
      advance(simulation, 1);
      expect(simulation.snapshot().enemies[0]?.definitionId).toBe(definitionId);

      let destroyed: Extract<GameEvent, { type: 'EnemyDestroyed' }> | undefined;
      for (let hit = 1; hit <= requiredHits; hit += 1) {
        const fire = expectApplied(simulation.dispatch({ type: 'FirePressed' }));
        expect(fire.events.filter((event) => event.type === 'ProjectileSpawned')).toHaveLength(1);
        const events = advance(simulation, 8);
        destroyed = events.find((event): event is Extract<GameEvent, { type: 'EnemyDestroyed' }> => event.type === 'EnemyDestroyed');
        if (hit < requiredHits) {
          expect(destroyed).toBeUndefined();
          expect(simulation.snapshot().score).toBe(0);
        }
      }
      expect(destroyed).toMatchObject({ definitionId, scoreAwarded: scoreValue });
      expect(simulation.snapshot().score).toBe(scoreValue);
    },
  );

  it('removes each contact enemy, applies exactly one health, and ends once on the third contact', () => {
    const simulation = new PlaneShooterSimulation({
      random: new SequenceRandom([0.3, 0.5, 0.5]),
      config: makeConfig({
        spawnIntervalSeconds: 1 / 60,
        spawnAreaWidth: 0,
        spawnAreaHeight: -2.5,
        maxEnemies: 1,
        enemySpeed: 0,
      }),
    });
    simulation.start(startCommand('contacts'));
    const events = advance(simulation, 3);
    const damageEvents = events.filter((event): event is Extract<GameEvent, { type: 'PlayerDamaged' }> => event.type === 'PlayerDamaged');
    expect(damageEvents.map((event) => event.health)).toEqual([2, 1, 0]);
    expect(new Set(damageEvents.map((event) => event.enemyId)).size).toBe(3);
    expect(events.filter((event) => event.type === 'GameOver')).toHaveLength(1);
    expect(simulation.snapshot()).toMatchObject({
      lifecycle: 'gameOver',
      score: 0,
      player: { health: 0 },
      enemies: [],
    });

    const stable = simulation.snapshot();
    expect(simulation.dispatch({ type: 'FirePressed' })).toMatchObject({ ok: false, failure: { code: 'run-not-active' } });
    expect(simulation.dispatch({ type: 'SetMoveVector', moveVector: { x: 1, y: 0 } })).toMatchObject({ ok: false, failure: { code: 'run-not-active' } });
    expect(simulation.dispatch({ type: 'AdvanceFrame', deltaSeconds: 1 })).toMatchObject({ ok: false, failure: { code: 'run-not-active' } });
    expect(simulation.snapshot()).toEqual(stable);
    expect(stable.result?.finalScore).toBe(0);
  });

  it('restart restores the clean initial run and does not duplicate terminal state', () => {
    const simulation = new PlaneShooterSimulation({
      random: new SequenceRandom([0, 0.5, 0.5]),
      config: makeConfig({
        spawnIntervalSeconds: 1 / 60,
        spawnAreaWidth: 0,
        spawnAreaHeight: -2.5,
        maxEnemies: 1,
        enemySpeed: 0,
      }),
    });
    simulation.start(startCommand('first', 1));
    const ended = advance(simulation, 3);
    expect(ended.filter((event) => event.type === 'GameOver')).toHaveLength(1);

    const restarted = expectApplied(simulation.dispatch({
      type: 'RestartRun',
      run: startCommand('second', 2),
    })).snapshot;
    expect(restarted).toMatchObject({
      lifecycle: 'running',
      sessionId: 'second',
      seed: 2,
      elapsedSeconds: 0,
      score: 0,
      spawnClockSeconds: 0,
      player: { x: 0, y: -3, health: 3 },
      projectiles: [],
      enemies: [],
    });
    expect(restarted.result).toBeUndefined();
  });

  it('returns typed failures for invalid deltas and makes disposal terminal', () => {
    const simulation = new PlaneShooterSimulation();
    simulation.start(startCommand());
    expect(simulation.dispatch({ type: 'AdvanceFrame', deltaSeconds: 0 })).toMatchObject({
      ok: false,
      failure: { code: 'invalid-delta' },
    });
    simulation.dispose();
    expect(simulation.dispatch({ type: 'RestartRun', run: startCommand('again') })).toMatchObject({
      ok: false,
      failure: { code: 'disposed' },
    });
  });
});

describe('fixed-step performance contract', () => {
  it('advances and fires without constructing discarded public snapshots', () => {
    class SnapshotCountingSimulation extends PlaneShooterSimulation {
      public snapshotCalls = 0;

      public override snapshot() {
        this.snapshotCalls += 1;
        return super.snapshot();
      }
    }

    const simulation = new SnapshotCountingSimulation();
    simulation.start(startCommand('snapshot-cost'));
    simulation.snapshotCalls = 0;

    const events = simulation.advanceFixedStep({ moveX: 1, moveY: 0, firePressed: true });

    expect(events.filter((event) => event.type === 'ProjectileSpawned')).toHaveLength(1);
    expect(simulation.snapshotCalls).toBe(0);
  });
});
