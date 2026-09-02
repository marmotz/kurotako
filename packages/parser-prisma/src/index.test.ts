import { describe, expect, it } from 'vitest';
import { version } from './index.js';

describe('@kurotako/parser-prisma', () => {
  it('exposes a version string', () => {
    expect(typeof version).toBe('string');
  });
});
