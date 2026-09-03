/** Framework-independent source of deterministic [0, 1) values. */
export interface RandomSource {
  next(): number;
  /** Optional reset hook used by reusable seeded sources. */
  reset?(seed: number): void;
}

export type RandomSourceFactory = (seed: number) => RandomSource;

/**
 * Small, dependency-free xorshift32 generator.  Zero is mapped to a stable
 * non-zero state so every seed remains a useful deterministic stream.
 */
export class XorShift32 implements RandomSource {
  private state: number;

  public constructor(seed = 0) {
    this.state = XorShift32.normalizeSeed(seed);
  }

  public reset(seed: number): void {
    this.state = XorShift32.normalizeSeed(seed);
  }

  public next(): number {
    let value = this.state;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    this.state = value >>> 0;
    return this.state / 0x1_0000_0000;
  }

  public nextRange(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  public nextInt(exclusiveMax: number): number {
    if (exclusiveMax <= 0) {
      return 0;
    }
    return Math.floor(this.next() * exclusiveMax);
  }

  private static normalizeSeed(seed: number): number {
    const normalized = Number.isFinite(seed) ? Math.trunc(seed) >>> 0 : 0;
    return normalized === 0 ? 0x6d2b_79f5 : normalized;
  }
}

/** Public semantic alias for callers that do not care about the algorithm. */
export class SeededRandom extends XorShift32 {}

export const createSeededRandom = (seed: number): SeededRandom => new SeededRandom(seed);
export const createXorShiftRandom = createSeededRandom;
