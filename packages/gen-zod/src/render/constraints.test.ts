import type { Constraints } from '@kurotako/ir';
import { describe, expect, it } from 'vitest';
import { dialectFor } from '../dialect.js';
import { applyConstraints } from './constraints.js';

const v4 = dialectFor(4);
const v3 = dialectFor(3);

describe('applyConstraints — string base', () => {
  it('format: email replaces base (v4) / chains (v3)', () => {
    expect(
      applyConstraints('z.string()', { format: 'email' }, 'string', v4),
    ).toBe('z.email()');
    expect(
      applyConstraints('z.string()', { format: 'email' }, 'string', v3),
    ).toBe('z.string().email()');
  });

  it('minLength / maxLength -> .min / .max', () => {
    expect(
      applyConstraints(
        'z.string()',
        { minLength: 2, maxLength: 8 },
        'string',
        v4,
      ),
    ).toBe('z.string().min(2).max(8)');
  });

  it('regex -> .regex(new RegExp(...))', () => {
    expect(
      applyConstraints('z.string()', { regex: '^a.$' }, 'string', v4),
    ).toBe('z.string().regex(new RegExp("^a.$"))');
  });

  it('fixed order: format then length then regex', () => {
    const c: Constraints = { format: 'email', maxLength: 5, regex: 'x' };
    expect(applyConstraints('z.string()', c, 'string', v4)).toBe(
      'z.email().max(5).regex(new RegExp("x"))',
    );
  });
});

describe('applyConstraints — numeric base', () => {
  it('min / max', () => {
    expect(applyConstraints('z.int()', { min: 0, max: 9 }, 'number', v4)).toBe(
      'z.int().min(0).max(9)',
    );
  });
});

describe('applyConstraints — unique', () => {
  it('produces no output', () => {
    expect(applyConstraints('z.string()', { unique: true }, 'string', v4)).toBe(
      'z.string()',
    );
  });
});
