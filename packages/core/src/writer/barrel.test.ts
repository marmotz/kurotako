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
    expect(log.warn).toHaveBeenCalledTimes(1);
    const [message, meta] = vi.mocked(log.warn).mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(message).toContain(
      "Name clash in namespace 'pg': typescript and zod each generate a declaration named 'User'.",
    );
    expect(message).toContain("so it keeps the one from 'typescript'");
    expect(message).toContain('This is not an error.');
    expect(message).toContain("import from the generator's path");
    expect(message).toContain("import … from 'pg/zod'");
    expect(message).toContain('To silence this warning');
    expect(message).toContain('Names affected (1): User.');
    expect(meta).toEqual({
      namespace: 'pg',
      generators: ['typescript', 'zod'],
      collisionCount: 1,
      identifiers: ['User'],
      sample: ['User'],
      resolutions: { User: 'typescript' },
    });
  });

  function manyCollisions(names: string[]): VirtualFile[] {
    const gen = (g: string, decl: (n: string) => string): VirtualFile[] => [
      {
        path: `pg/${g}/index.ts`,
        content: names.map((n) => `export * from './${n}';`).join('\n'),
      },
      ...names.map((n) => ({ path: `pg/${g}/${n}.ts`, content: decl(n) })),
    ];
    return [
      ...gen('typescript', (n) => `export interface ${n} {}\n`),
      ...gen('zod', (n) => `export const ${n} = {}\n`),
    ];
  }

  it('emits one plain-language warning per namespace with a bounded, ordered sample', () => {
    const log = logger();
    synthesizeRootBarrels(
      manyCollisions([
        'Order',
        'Task',
        'Account',
        'Invoice',
        'Project',
        'User',
      ]),
      undefined,
      log,
    );
    expect(log.warn).toHaveBeenCalledTimes(1);
    const [message, meta] = vi.mocked(log.warn).mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(message).toBe(
      [
        "Name clash in namespace 'pg': typescript and zod each generate 6 " +
          "identically-named declarations (for example 'Account').",
        "The shared entry point 'pg' can expose only one declaration per name, " +
          "so it keeps the one from 'typescript'. Nothing is lost: every " +
          "declaration stays reachable from its own generator's path.",
        '',
        'This is not an error. Generation succeeded and the output is valid; ' +
          'this is the normal outcome when several generators describe the same model.',
        '',
        "To use a specific one, import from the generator's path instead of the namespace:",
        "  import … from 'pg/typescript'   (same as 'pg')",
        "  import … from 'pg/zod'",
        'To silence this warning, point the output at a single generator (the ' +
          "'generators' list in your output config).",
        '',
        'Names affected (6): Account, Invoice, Order, Project, Task and 1 more.',
      ].join('\n'),
    );
    expect(meta).toEqual({
      namespace: 'pg',
      generators: ['typescript', 'zod'],
      collisionCount: 6,
      identifiers: ['Account', 'Invoice', 'Order', 'Project', 'Task', 'User'],
      sample: ['Account', 'Invoice', 'Order', 'Project', 'Task'],
      resolutions: {
        Account: 'typescript',
        Invoice: 'typescript',
        Order: 'typescript',
        Project: 'typescript',
        Task: 'typescript',
        User: 'typescript',
      },
    });
  });

  it('keeps the root barrel byte-for-byte equivalent regardless of warning shape', () => {
    const files = manyCollisions(['Order', 'Task', 'User']);
    expect(synthesizeRootBarrels(files)[0]).toEqual({
      path: 'pg/index.ts',
      content:
        "export * from './typescript';\nexport * from './zod';\n" +
        "export { Order } from './typescript';\n" +
        "export { Task } from './typescript';\n" +
        "export { User } from './typescript';\n",
    });
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
