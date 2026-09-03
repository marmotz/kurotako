import { describe, expect, it } from 'vitest';
import { mergeTrees } from './collect.js';
import { InvalidOutputPathError, OutputCollisionError } from './errors.js';

describe('mergeTrees', () => {
  it('passes a single generator through, sorted by path', () => {
    const files = mergeTrees([
      {
        generator: 'zod',
        files: [
          { path: 'pg/zod/b.ts', content: 'b' },
          { path: 'pg/zod/a.ts', content: 'a' },
        ],
      },
    ]);
    expect(files.map((f) => f.path)).toEqual(['pg/zod/a.ts', 'pg/zod/b.ts']);
  });

  it('rejects a collision between two generators', () => {
    expect(() =>
      mergeTrees([
        { generator: 'zod', files: [{ path: 'pg/index.ts', content: '1' }] },
        {
          generator: 'angular',
          files: [{ path: 'pg/index.ts', content: '2' }],
        },
      ]),
    ).toThrow(OutputCollisionError);
  });

  it('rejects an escaping path', () => {
    expect(() =>
      mergeTrees([
        { generator: 'zod', files: [{ path: '../x.ts', content: '' }] },
      ]),
    ).toThrow(InvalidOutputPathError);
  });

  it('rejects an absolute path', () => {
    expect(() =>
      mergeTrees([
        { generator: 'zod', files: [{ path: '/x.ts', content: '' }] },
      ]),
    ).toThrow(InvalidOutputPathError);
  });

  it('normalizes and sorts the union across generators', () => {
    const files = mergeTrees([
      { generator: 'zod', files: [{ path: 'pg/zod/./m.ts', content: 'm' }] },
      {
        generator: 'angular',
        files: [{ path: 'pg\\angular\\a.ts', content: 'a' }],
      },
    ]);
    expect(files.map((f) => f.path)).toEqual([
      'pg/angular/a.ts',
      'pg/zod/m.ts',
    ]);
  });
});
