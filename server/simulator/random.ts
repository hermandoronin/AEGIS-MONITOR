/**
 * Seeded randomness for the simulator, so a run (and every test) is repeatable.
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0 || 1;
  }

  /** Uniform in [0, 1). mulberry32. */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Gaussian noise, mean 0 (Box-Muller). */
  normal(sd: number): number {
    const u = 1 - this.next();
    const v = this.next();
    return sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /** Random phase for periodic signals, so two runs do not look identical. */
  phase(): number {
    return this.next() * 2 * Math.PI;
  }
}

/** First-order lag: moves `current` toward `target` with time constant `tau` seconds. */
export function lag(current: number, target: number, tau: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-dt / tau));
}

/** Moves toward `target` at no more than `rate` units per second. */
export function approach(current: number, target: number, rate: number, dt: number): number {
  const step = rate * dt;
  if (Math.abs(target - current) <= step) return target;
  return current + Math.sign(target - current) * step;
}

/** Mean-reverting random walk (Ornstein-Uhlenbeck) with long-run spread `sd`. */
export function wander(rng: Rng, current: number, mean: number, sd: number, tau: number, dt: number): number {
  const decay = Math.exp(-dt / tau);
  return mean + (current - mean) * decay + rng.normal(sd * Math.sqrt(1 - decay * decay));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function sine(t: number, periodS: number, phase = 0): number {
  return Math.sin((2 * Math.PI * t) / periodS + phase);
}
