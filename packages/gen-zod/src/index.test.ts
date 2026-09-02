import { describe, expect, it } from 'vitest';
import { version } from './index.js';

describe('@kurotako/gen-zod', () => {
  it('exposes a version string', () => {
    expect(typeof version).toBe('string');
  });
});
