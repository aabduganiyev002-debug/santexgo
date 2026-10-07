import { describe, expect, it } from 'vitest';
import { isPrivateAddress } from './private-address.js';

describe('isPrivateAddress', () => {
  it('ichki tarmoq manzillari', () => {
    for (const ip of [
      '127.0.0.1',
      '::1',
      '10.0.0.5',
      '172.18.0.3',
      '192.168.1.10',
      '::ffff:172.20.0.2',
      'fd00::1',
    ]) {
      expect(isPrivateAddress(ip)).toBe(true);
    }
  });

  it('internet manzillari', () => {
    for (const ip of [
      '8.8.8.8',
      '172.32.0.1',
      '213.230.64.1',
      '2001:4860::8888',
      undefined,
      'abc',
    ]) {
      expect(isPrivateAddress(ip)).toBe(false);
    }
  });
});
