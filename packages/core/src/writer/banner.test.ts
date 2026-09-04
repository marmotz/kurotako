import { describe, expect, it } from 'vitest';
import { applyBanner, BANNER } from './banner.js';

describe('applyBanner', () => {
  it('prepends the banner to .ts and .tsx files', () => {
    const out = applyBanner([
      { path: 'pg/zod/user.schema.ts', content: 'export const x = 1;\n' },
      { path: 'pg/angular/user.form.tsx', content: 'export const F = 1;\n' },
    ]);
    expect(out[0]?.content).toBe(`${BANNER}export const x = 1;\n`);
    expect(out[1]?.content).toBe(`${BANNER}export const F = 1;\n`);
  });

  it('prepends the comment form to tsconfig.json', () => {
    const out = applyBanner([
      { path: 'pg/zod/tsconfig.json', content: '{}\n' },
    ]);
    expect(out[0]?.content).toBe(`${BANNER}{}\n`);
  });

  it('leaves package.json and other .json files untouched', () => {
    const input = [{ path: 'pg/zod/package.json', content: '{"name":"x"}\n' }];
    expect(applyBanner(input)).toEqual(input);
  });

  it('is idempotent-safe — never double-prepends', () => {
    const once = applyBanner([{ path: 'a.ts', content: 'code\n' }]);
    const twice = applyBanner(once);
    expect(twice).toEqual(once);
    expect(twice[0]?.content).toBe(`${BANNER}code\n`);
  });

  it('produces constant output (no timestamp / version)', () => {
    const a = applyBanner([{ path: 'a.ts', content: 'x' }]);
    const b = applyBanner([{ path: 'a.ts', content: 'x' }]);
    expect(a).toEqual(b);
  });
});
