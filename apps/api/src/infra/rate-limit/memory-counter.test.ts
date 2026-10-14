import { afterEach, describe, expect, it } from 'vitest';
import { MemoryCounter } from './memory-counter.js';

describe('MemoryCounter', () => {
  let now = 1_000_000;
  const counter = new MemoryCounter(() => now);

  afterEach(() => counter.reset('k'));

  it('oyna ichida sanaydi va oyna tugaganda qaytadan boshlaydi', () => {
    expect(counter.hit('k', 1_000)).toEqual({ count: 1, resetInMs: 1_000 });
    now += 400;
    expect(counter.hit('k', 1_000)).toEqual({ count: 2, resetInMs: 600 });
    expect(counter.peek('k')).toEqual({ count: 2, resetInMs: 600 });
    now += 600;
    expect(counter.peek('k')).toBeNull();
    expect(counter.hit('k', 1_000)).toEqual({ count: 1, resetInMs: 1_000 });
  });

  it('reset hisoblagichni tozalaydi', () => {
    counter.hit('k', 1_000);
    counter.reset('k');
    expect(counter.peek('k')).toBeNull();
  });
});
