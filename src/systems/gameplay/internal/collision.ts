export interface CollisionCircle {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

export function distanceSquared(a: CollisionCircle, b: CollisionCircle): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

/** Pure circle collision; visual/image dimensions are intentionally absent. */
export function circlesOverlap(a: CollisionCircle, b: CollisionCircle): boolean {
  const radius = Math.max(0, a.radius) + Math.max(0, b.radius);
  return distanceSquared(a, b) <= radius * radius;
}
