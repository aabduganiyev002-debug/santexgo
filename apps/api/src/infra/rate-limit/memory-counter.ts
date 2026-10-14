export interface CounterHit {
  /** Joriy oynadagi urinishlar soni (shu urinish bilan) */
  count: number;
  /** Oyna tugashiga qolgan vaqt (ms) */
  resetInMs: number;
}

interface Entry {
  count: number;
  expiresAt: number;
}

const SWEEP_INTERVAL_MS = 60_000;

/** Belgilangan vaqt oynasidagi hisoblagichlar (fixed window), jarayon xotirasida. */
export class MemoryCounter {
  private readonly entries = new Map<string, Entry>();
  private readonly timer: NodeJS.Timeout;

  constructor(private readonly now: () => number = Date.now) {
    this.timer = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS);
    this.timer.unref();
  }

  hit(key: string, windowMs: number): CounterHit {
    const now = this.now();
    const entry = this.entries.get(key);
    if (!entry || entry.expiresAt <= now) {
      this.entries.set(key, { count: 1, expiresAt: now + windowMs });
      return { count: 1, resetInMs: windowMs };
    }
    entry.count += 1;
    return { count: entry.count, resetInMs: entry.expiresAt - now };
  }

  peek(key: string): CounterHit | null {
    const now = this.now();
    const entry = this.entries.get(key);
    if (!entry || entry.expiresAt <= now) return null;
    return { count: entry.count, resetInMs: entry.expiresAt - now };
  }

  reset(key: string): void {
    this.entries.delete(key);
  }

  sweep(): void {
    const now = this.now();
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(key);
    }
  }

  dispose(): void {
    clearInterval(this.timer);
    this.entries.clear();
  }
}
