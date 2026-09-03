export const RECOVERED_PARITY_EVIDENCE =
  'RECOVERED FROM SERIALIZED UNITY DATA' as const;
export const INFERRED_TUNING_EVIDENCE = 'INFERRED/TUNED' as const;

export const ENEMY_DEFINITION_IDS = [
  'enemy.base',
  'enemy.1',
  'enemy.2',
  'enemy.3',
] as const;

export type EnemyDefinitionId = (typeof ENEMY_DEFINITION_IDS)[number];

export interface Vector2Config {
  readonly x: number;
  readonly y: number;
}

export interface EnemyScaleRule {
  readonly mode: 'fixed' | 'random';
  readonly min: number;
  readonly max: number;
  /** The serialized build does not prove enemy.2's exact visual scale. */
  readonly evidence?: typeof INFERRED_TUNING_EVIDENCE;
}

export interface EnemyDefinition {
  readonly id: EnemyDefinitionId;
  readonly defaultAppearanceKey: string;
  readonly maxHealth: number;
  readonly movementSpeed: number;
  readonly lifetimeSeconds: number;
  readonly scoreValue: number;
  readonly playerContactDamage: number;
  readonly scale: EnemyScaleRule;
  readonly rotationSpeedDegreesPerSecond: number;
}

export interface PlaneShooterConfig {
  readonly evidence: typeof RECOVERED_PARITY_EVIDENCE;
  readonly fixedStepHz: number;
  readonly camera: {
    readonly logicalWidth: number;
    readonly logicalHeight: number;
    readonly minX: number;
    readonly maxX: number;
    readonly minY: number;
    readonly maxY: number;
    readonly pixelsPerWorldUnit: number;
  };
  readonly player: {
    readonly startPosition: Vector2Config;
    readonly movementSpeed: number;
    readonly startingHealth: number;
    readonly serializedBoundsValue: number;
    readonly boundsInterpretation: typeof INFERRED_TUNING_EVIDENCE;
    readonly movementBounds: {
      readonly minX: number;
      readonly maxX: number;
      readonly minY: number;
      readonly maxY: number;
    };
    readonly hitboxRadius: number;
    readonly muzzleOffsetY: number;
  };
  readonly projectile: {
    readonly movementDirection: Vector2Config;
    readonly speed: number;
    readonly damage: number;
    readonly firingMode: 'one-per-press';
    readonly hitboxRadius: number;
  };
  readonly spawner: {
    readonly intervalSeconds: number;
    readonly configuredAreaWidth: number;
    readonly configuredAreaHeight: number;
    readonly enemyRoster: readonly EnemyDefinitionId[];
  };
  readonly background: {
    readonly scrollingSpeeds: readonly [number, number];
  };
  readonly enemyDefinitions: Readonly<Record<EnemyDefinitionId, EnemyDefinition>>;
  readonly enemyHitboxRadius: number;
  readonly despawnMargin: number;
  readonly maxEnemies: number;
  readonly maxProjectiles: number;
}

// The running build used an orthographic size of five. A 9:16 portrait camera
// therefore spans ten world units vertically and 5.625 horizontally. The
// additional serialized PlayerMovement value 50 has no proven field name; the
// 50/96 conversion below is an explicitly inferred screen-edge padding.
const CAMERA = Object.freeze({
  logicalWidth: 540,
  logicalHeight: 960,
  minX: -2.8125,
  maxX: 2.8125,
  minY: -5,
  maxY: 5,
  pixelsPerWorldUnit: 96,
});

const BOUNDS_PADDING = 50 / CAMERA.pixelsPerWorldUnit;

const ENEMY_DEFINITIONS: Readonly<Record<EnemyDefinitionId, EnemyDefinition>> =
  Object.freeze({
    'enemy.base': Object.freeze({
      id: 'enemy.base',
      defaultAppearanceKey: 'enemy.01',
      maxHealth: 2,
      movementSpeed: 15,
      lifetimeSeconds: 8,
      scoreValue: 1,
      playerContactDamage: 1,
      scale: Object.freeze({ mode: 'random', min: 1, max: 4 }),
      rotationSpeedDegreesPerSecond: 100,
    }),
    'enemy.1': Object.freeze({
      id: 'enemy.1',
      defaultAppearanceKey: 'enemy.02',
      maxHealth: 3,
      movementSpeed: 4,
      lifetimeSeconds: 8,
      scoreValue: 2,
      playerContactDamage: 1,
      scale: Object.freeze({ mode: 'random', min: 1, max: 1.2 }),
      rotationSpeedDegreesPerSecond: 0,
    }),
    'enemy.2': Object.freeze({
      id: 'enemy.2',
      defaultAppearanceKey: 'enemy.03',
      maxHealth: 4,
      movementSpeed: 5,
      lifetimeSeconds: 8,
      scoreValue: 4,
      playerContactDamage: 1,
      scale: Object.freeze({
        mode: 'fixed',
        min: 1,
        max: 1,
        evidence: INFERRED_TUNING_EVIDENCE,
      }),
      rotationSpeedDegreesPerSecond: 0,
    }),
    'enemy.3': Object.freeze({
      id: 'enemy.3',
      defaultAppearanceKey: 'enemy.04',
      maxHealth: 10,
      movementSpeed: 2,
      lifetimeSeconds: 8,
      scoreValue: 5,
      playerContactDamage: 1,
      scale: Object.freeze({ mode: 'random', min: 0.2, max: 1.2 }),
      rotationSpeedDegreesPerSecond: 0,
    }),
  });

/**
 * Single source of truth for recovered mechanics and explicitly labeled
 * renderer-neutral tuning. No appearance dimension participates in it.
 */
export const PLANE_SHOOTER_PARITY: PlaneShooterConfig = Object.freeze({
  evidence: RECOVERED_PARITY_EVIDENCE,
  fixedStepHz: 60,
  camera: CAMERA,
  player: Object.freeze({
    startPosition: Object.freeze({ x: 0, y: -3 }),
    movementSpeed: 5,
    startingHealth: 3,
    serializedBoundsValue: 50,
    boundsInterpretation: INFERRED_TUNING_EVIDENCE,
    movementBounds: Object.freeze({
      minX: CAMERA.minX + BOUNDS_PADDING,
      maxX: CAMERA.maxX - BOUNDS_PADDING,
      minY: CAMERA.minY + BOUNDS_PADDING,
      maxY: CAMERA.maxY - BOUNDS_PADDING,
    }),
    hitboxRadius: 0.32,
    muzzleOffsetY: 0.62,
  }),
  projectile: Object.freeze({
    movementDirection: Object.freeze({ x: 0, y: 1 }),
    speed: 20,
    damage: 1,
    firingMode: 'one-per-press',
    hitboxRadius: 0.09,
  }),
  spawner: Object.freeze({
    intervalSeconds: 0.5,
    configuredAreaWidth: 2,
    configuredAreaHeight: 6,
    enemyRoster: ENEMY_DEFINITION_IDS,
  }),
  background: Object.freeze({ scrollingSpeeds: [2.5, 3] as const }),
  enemyDefinitions: ENEMY_DEFINITIONS,
  enemyHitboxRadius: 0.32,
  despawnMargin: 0.5,
  maxEnemies: 64,
  maxProjectiles: 128,
});
