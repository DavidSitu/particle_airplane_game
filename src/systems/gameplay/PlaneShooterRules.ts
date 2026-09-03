import type { Vector2 } from './contracts';

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function clampUnit(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return clamp(value, -1, 1);
}

export function normalizeMoveVector(vector: Vector2): Vector2 {
  const x = clampUnit(vector.x);
  const y = clampUnit(vector.y);
  const length = Math.hypot(x, y);
  if (length <= 1 || length === 0) return { x, y };
  return { x: x / length, y: y / length };
}

export function randomRange(value: number, minimum: number, maximum: number): number {
  return minimum + (maximum - minimum) * clamp(value, 0, 0.9999999999999999);
}

interface MovingCircle {
  readonly previousPosition: Vector2;
  readonly position: Vector2;
  readonly hitboxRadius: number;
}

/**
 * Continuous collision between two moving circles over one simulation step.
 * This prevents a speed-20 projectile from tunnelling through a speed-15 enemy.
 */
export function movingCirclesOverlap(a: MovingCircle, b: MovingCircle): boolean {
  const startX = a.previousPosition.x - b.previousPosition.x;
  const startY = a.previousPosition.y - b.previousPosition.y;
  const deltaX =
    (a.position.x - a.previousPosition.x) -
    (b.position.x - b.previousPosition.x);
  const deltaY =
    (a.position.y - a.previousPosition.y) -
    (b.position.y - b.previousPosition.y);
  const radius = Math.max(0, a.hitboxRadius) + Math.max(0, b.hitboxRadius);
  const lengthSquared = deltaX * deltaX + deltaY * deltaY;
  const closestTime = lengthSquared === 0
    ? 0
    : clamp(-(startX * deltaX + startY * deltaY) / lengthSquared, 0, 1);
  const closestX = startX + deltaX * closestTime;
  const closestY = startY + deltaY * closestTime;
  return closestX * closestX + closestY * closestY <= radius * radius;
}
