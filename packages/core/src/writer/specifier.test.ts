import { describe, expect, it } from 'vitest';
import { jsFile, jsIndex } from './specifier.js';

describe('jsFile', () => {
  it('appends .js to a relative file specifier', () => {
    expect(jsFile('./aliases')).toBe('./aliases.js');
  });
});

describe('jsIndex', () => {
  it('appends /index.js to a relative directory specifier', () => {
    expect(jsIndex('./zod')).toBe('./zod/index.js');
  });
});
