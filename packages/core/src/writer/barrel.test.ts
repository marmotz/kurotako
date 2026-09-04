import { describe, expect, it, vi } from 'vitest';
import type { GeneratorArtifact, Logger, VirtualFile } from '../types.js';
import { synthesizeRootBarrels } from './barrel.js';

function file(path: string): VirtualFile {
  return { path, content: '' };
}

function logger(): Logger {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

describe('synthesizeRootBarrels', () => {
  it('emits one sorted barrel per namespace for every contributing generator', () => {
    const barrels = synthesizeRootBarrels([
      file('pg/zod/user.schema.ts'),
      file('pg/angular/user.form.ts'),
      file('pg/zod/enums.ts'),
    ]);
    expect(barrels).toEqual([
      {
        path: 'pg/index.ts',
        content: "export * from './angular';\nexport * from './zod';\n",
      },
    ]);
  });

  it('still emits a barrel for a single-generator namespace', () => {
    expect(synthesizeRootBarrels([file('pg/zod/enums.ts')])).toEqual([
      { path: 'pg/index.ts', content: "export * from './zod';\n" },
    ]);
  });

  it('ignores files with fewer than three path segments', () => {
    expect(
      synthesizeRootBarrels([file('pg/index.ts'), file('README.md')]),
    ).toEqual([]);
  });

  it('warns when two artifacts export the same identifier for one namespace', () => {
    const log = logger();
    const zod: GeneratorArtifact = {
      entities: {
        'pg.User': { module: 'pg/zod/user.schema', symbols: { type: 'User' } },
      },
    };
    const angular: GeneratorArtifact = {
      entities: {
        'pg.User': {
          module: 'pg/angular/user.form',
          symbols: { form: 'User' },
        },
      },
    };
    const barrels = synthesizeRootBarrels(
      [file('pg/zod/user.schema.ts'), file('pg/angular/user.form.ts')],
      { zod, angular },
      log,
    );
    expect(log.warn).toHaveBeenCalledTimes(1);
    expect(vi.mocked(log.warn).mock.calls[0]?.[0]).toContain(
      "identifier 'User'",
    );
    expect(barrels).toHaveLength(1);
  });

  it('does not warn when identifiers are role-distinct', () => {
    const log = logger();
    synthesizeRootBarrels(
      [file('pg/zod/user.schema.ts'), file('pg/angular/user.form.ts')],
      {
        zod: {
          entities: { 'pg.User': { module: 'm', symbols: { type: 'User' } } },
        },
        angular: {
          entities: {
            'pg.User': { module: 'm', symbols: { form: 'UserFormFactory' } },
          },
        },
      },
      log,
    );
    expect(log.warn).not.toHaveBeenCalled();
  });
});
