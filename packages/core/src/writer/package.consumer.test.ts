/**
 * End-to-end check of the generated mode-B `package.json` `exports`: a real
 * `tsup` build (not mocked), then a consumer project importing every sub-path
 * as ESM, as CJS and through the TypeScript resolver. Guards the regression where
 * `./*` mapped `<pkg>/zod` to the non-existent `dist/zod.js`.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { VirtualFile } from '../types.js';
import { packageWriter } from './package.js';

vi.mock('./pm.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./pm.js')>();
  return { ...actual, runInstall: vi.fn().mockResolvedValue(undefined) };
});

const coreDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);
// Inside the package so `typescript` / `tsup` resolve by walking up.
let root: string;

const files: VirtualFile[] = [
  { path: 'pg/index.ts', content: "export * from './typescript/index.js';\n" },
  {
    path: 'pg/typescript/index.ts',
    content: "export * from './User.type.js';\n",
  },
  {
    path: 'pg/typescript/User.type.ts',
    content:
      'export type UserDto = { id: string };\nexport const kind = "typescript";\n',
  },
  { path: 'pg/zod/index.ts', content: "export * from './User.schema.js';\n" },
  {
    path: 'pg/zod/User.schema.ts',
    content: 'export const UserSchema = { name: "zod" };\n',
  },
  { path: 'pg/angular/index.ts', content: 'export const forms = "angular";\n' },
];

beforeAll(async () => {
  root = await fs.mkdtemp(path.join(coreDir, 'tmp-consumer-'));
  await fs.writeFile(
    path.join(root, 'tsconfig.base.json'),
    JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        strict: true,
        skipLibCheck: true,
      },
    }),
    'utf8',
  );
  await fs.writeFile(path.join(root, 'tsup.config.base.ts'), '', 'utf8');
  await fs.writeFile(
    path.join(root, 'package.json'),
    JSON.stringify({ name: 'consumer', private: true, type: 'module' }),
    'utf8',
  );
  await packageWriter.write({
    files,
    artifacts: {},
    output: {
      mode: 'package',
      packagesDir: path.join(root, 'packages'),
      scope: '@kurotako',
      packageManager: 'bun',
    },
  });
  // What `<pm> install` would do: link the generated package into the consumer.
  const linkDir = path.join(root, 'node_modules', '@kurotako');
  await fs.mkdir(linkDir, { recursive: true });
  await fs.symlink(
    path.join(root, 'packages', 'kurotako-pg'),
    path.join(linkDir, 'pg'),
    'dir',
  );
}, 120_000);

afterAll(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

function node(args: string[]): string {
  return execFileSync(process.execPath, args, { cwd: root, encoding: 'utf8' });
}

describe('generated package sub-path exports', () => {
  it.each([
    ['@kurotako/pg/typescript', 'kind'],
    ['@kurotako/pg/zod', 'UserSchema'],
    ['@kurotako/pg/angular', 'forms'],
    ['@kurotako/pg/zod/User.schema', 'UserSchema'],
  ])('resolves %s as ESM and CJS', (specifier, exportName) => {
    const esm = node([
      '--input-type=module',
      '-e',
      `const m = await import(${JSON.stringify(specifier)}); console.log(typeof m[${JSON.stringify(exportName)}]);`,
    ]);
    expect(esm.trim()).not.toBe('undefined');
    const cjs = node([
      '-e',
      `const m = require(${JSON.stringify(specifier)}); console.log(typeof m[${JSON.stringify(exportName)}]);`,
    ]);
    expect(cjs.trim()).not.toBe('undefined');
  });

  it('keeps angular out of the root entry (no root-level re-export of a UI framework)', () => {
    // The fixture root barrel only re-exports `typescript`, mirroring a run whose
    // angular artifact sets `exportFromRoot: false`.
    const out = node([
      '--input-type=module',
      '-e',
      "const m = await import('@kurotako/pg'); console.log(Object.keys(m).sort().join(','));",
    ]);
    expect(out.trim()).toBe('kind');
  });

  it('resolves every sub-path through the TypeScript resolver', async () => {
    await fs.writeFile(
      path.join(root, 'consumer.ts'),
      [
        "import { kind } from '@kurotako/pg/typescript';",
        "import { UserSchema } from '@kurotako/pg/zod';",
        "import { forms } from '@kurotako/pg/angular';",
        "import type { UserDto } from '@kurotako/pg/typescript';",
        'export const all: [string, unknown, string] = [kind, UserSchema, forms];',
        'export type Id = UserDto["id"];',
        '',
      ].join('\n'),
      'utf8',
    );
    await fs.writeFile(
      path.join(root, 'tsconfig.json'),
      JSON.stringify({
        extends: './tsconfig.base.json',
        compilerOptions: { noEmit: true },
        include: ['consumer.ts'],
      }),
      'utf8',
    );
    const tsc = createRequire(path.join(coreDir, 'noop.js')).resolve(
      'typescript/lib/tsc.js',
    );
    expect(() => node([tsc, '-p', 'tsconfig.json'])).not.toThrow();
  });
});
