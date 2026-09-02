import { describe, expect, it } from 'vitest';
import { version } from './index.js';

describe('@kurotako/core', () => {
  it('exposes a version string', () => {
    expect(typeof version).toBe('string');
  });
});
