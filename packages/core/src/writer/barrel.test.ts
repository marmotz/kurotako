import { describe, expect, it, vi } from 'vitest';
import type { Logger, VirtualFile } from '../types.js';
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

  it('resolves colliding declarations from the first generator at the root', () => {
    const log = logger();
    const barrels = synthesizeRootBarrels(
      [
        {
          path: 'pg/typescript/index.ts',
          content: "export type * from './User';\n",
        },
        {
          path: 'pg/typescript/User.ts',
          content: 'export interface User {}\n',
        },
        { path: 'pg/zod/index.ts', content: "export * from './User';\n" },
        { path: 'pg/zod/User.ts', content: 'export const User = {}\n' },
      ],
      undefined,
      log,
    );
    expect(barrels).toEqual([
      {
        path: 'pg/index.ts',
        content:
          "export * from './typescript';\nexport * from './zod';\nexport { User } from './typescript';\n",
      },
    ]);
    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining("identifier 'User'"),
      {
        namespace: 'pg',
        identifier: 'User',
        generators: ['typescript', 'zod'],
      },
    );
  });

  it('detects collisions outside artifact entity symbols, including filters', () => {
    const barrels = synthesizeRootBarrels([
      {
        path: 'pg/typescript/index.ts',
        content: "export type * from './filters';\n",
      },
      {
        path: 'pg/typescript/filters.ts',
        content: 'export interface StringFilter {}\n',
      },
      { path: 'pg/zod/index.ts', content: "export * from './filters';\n" },
      {
        path: 'pg/zod/filters.ts',
        content: 'export const StringFilter = {}\n',
      },
    ]);
    expect(barrels[0]?.content).toContain(
      "export { StringFilter } from './typescript';",
    );
  });
});
