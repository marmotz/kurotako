/**
 * Real-compiles the generator's actual output (this package's own generated
 * text, plus `@kurotako/gen-zod`'s, since Angular imports its symbols)
 * against hand-verified `@angular/forms/signals` / `@angular/forms` / `zod`
 * `.d.ts` stubs — see `testing/angular-stubs.ts` for why this exists: this
 * package has no runtime dependency on Angular/Zod, so nothing else catches
 * a drift against the real, experimental `@angular/forms/signals` surface
 * (the exact class of bug this generator hit once: a guessed `FieldPath` /
 * `ctx.field` that don't exist on the real types).
 *
 * Covers both `relations: 'flat'` and `relations: 'deep'`, both form
 * surfaces together, on a fixture with an enum, a nullable field, an
 * expr-defaulted field, and a one + many relation pair.
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { zodGenerator } from '@kurotako/gen-zod';
import type { IR } from '@kurotako/ir';
import { createSourceIR, IR_VERSION } from '@kurotako/ir';
import * as ts from 'typescript';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { angularGenerator } from '../generator.js';
import type { AngularGeneratorOptions } from '../options.js';
import {
  ANGULAR_CORE_DTS,
  ANGULAR_FORMS_DTS,
  ANGULAR_FORMS_SIGNALS_DTS,
  ZOD_DTS,
} from '../testing/angular-stubs.js';

const noopLogger = { debug() {}, info() {}, warn() {}, error() {} };

function fixtureIr(): IR {
  const source = createSourceIR({ namespace: 'pg', parser: 'test' })
    .addEnum('Role', (e) => e.value('ADMIN').value('USER'))
    .addEntity('User', (t) => {
      t.field('id', (f) =>
        f.scalar('uuid').primary().default({ kind: 'expr', expr: 'uuid()' }),
      );
      t.field('email', (f) => f.scalar('string'));
      t.field('role', (f) =>
        f.enum('Role').default({ kind: 'value', value: 'USER' }),
      );
      t.field('createdAt', (f) =>
        f.scalar('datetime').default({ kind: 'expr', expr: 'now()' }),
      );
      t.field('archivedAt', (f) => f.scalar('datetime').nullable());
      t.relation('posts', (r) =>
        r.to('pg', 'Post').many().backRelation('author'),
      );
    })
    .addEntity('Post', (t) => {
      t.field('id', (f) =>
        f
          .scalar('int')
          .primary()
          .default({ kind: 'expr', expr: 'autoincrement()' }),
      );
      t.field('title', (f) => f.scalar('string'));
      t.field('authorId', (f) => f.scalar('uuid'));
      t.relation('author', (r) =>
        r
          .to('pg', 'User')
          .one()
          .owning()
          .fkFields('authorId')
          .references('id')
          .backRelation('posts'),
      );
    })
    .build();
  return { irVersion: IR_VERSION, sources: { pg: source } };
}

async function writeFile(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');
}

async function writeAmbientPackage(
  root: string,
  name: string,
  files: Record<string, string>,
  exportsMap: Record<string, string>,
): Promise<void> {
  const pkgDir = path.join(root, 'node_modules', name);
  await writeFile(
    path.join(pkgDir, 'package.json'),
    JSON.stringify({ name, version: '0.0.0', exports: exportsMap }),
  );
  for (const [file, content] of Object.entries(files)) {
    await writeFile(path.join(pkgDir, file), content);
  }
}

let dir: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gen-angular-compile-'));

  await writeAmbientPackage(
    dir,
    '@angular/core',
    { 'index.d.ts': ANGULAR_CORE_DTS },
    { '.': './index.d.ts' },
  );
  await writeAmbientPackage(
    dir,
    '@angular/forms',
    {
      'index.d.ts': ANGULAR_FORMS_DTS,
      'signals.d.ts': ANGULAR_FORMS_SIGNALS_DTS,
    },
    { '.': './index.d.ts', './signals': './signals.d.ts' },
  );
  await writeAmbientPackage(
    dir,
    'zod',
    { 'index.d.ts': ZOD_DTS },
    { '.': './index.d.ts' },
  );

  await writeFile(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'gen-angular-compile-fixture', type: 'module' }),
  );
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

async function typecheck(
  files: { path: string; content: string }[],
): Promise<readonly ts.Diagnostic[]> {
  for (const file of files) {
    await writeFile(path.join(dir, 'pg', file.path.slice(3)), file.content);
  }

  const tsconfigPath = path.join(dir, 'tsconfig.json');
  await writeFile(
    tsconfigPath,
    JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        lib: ['ES2023'],
        module: 'ESNext',
        moduleResolution: 'bundler',
        strict: true,
        noUncheckedIndexedAccess: true,
        verbatimModuleSyntax: true,
        noEmit: true,
        baseUrl: '.',
        paths: { 'pg/*': ['./pg/*'] },
        types: [],
      },
      include: ['pg'],
    }),
  );

  const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, dir);
  const program = ts.createProgram({
    rootNames: parsed.fileNames,
    options: parsed.options,
  });
  // Scoped to this package's own output: `pg/zod/*` is `@kurotako/gen-zod`'s
  // emitted code, which has its own test suite and is not what this check is
  // validating (its real build goes through tsup's dts bundler, which is
  // lenient about a couple of strict-tsc-only diagnostics these minimal
  // stubs otherwise surface here).
  return ts
    .getPreEmitDiagnostics(program)
    .filter((d) => d.file?.fileName.includes('/pg/angular/'));
}

function formatDiagnostics(diagnostics: readonly ts.Diagnostic[]): string {
  return ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: (f) => f,
    getCurrentDirectory: () => dir,
    getNewLine: () => '\n',
  });
}

async function generate(options: AngularGeneratorOptions) {
  const ir = fixtureIr();
  const zodOut = await zodGenerator.generate(
    { ir, dependencies: {}, logger: noopLogger },
    { zodVersion: 4 },
  );
  const angularOut = await angularGenerator.generate(
    { ir, dependencies: { zod: zodOut.artifact }, logger: noopLogger },
    options,
  );
  return [...zodOut.files, ...angularOut.files];
}

describe('generated output compiles against real @angular/forms/signals shapes', () => {
  it('relations: flat, forms: [reactive, signal]', async () => {
    const files = await generate({
      forms: ['reactive', 'signal'],
      relations: 'flat',
    });
    const diagnostics = await typecheck(files);
    expect(formatDiagnostics(diagnostics)).toBe('');
  });

  it('relations: deep, forms: [reactive, signal]', async () => {
    const files = await generate({
      forms: ['reactive', 'signal'],
      relations: 'deep',
    });
    const diagnostics = await typecheck(files);
    expect(formatDiagnostics(diagnostics)).toBe('');
  });

  it('relations: deep, forms: [signal] only', async () => {
    const files = await generate({ forms: ['signal'], relations: 'deep' });
    const diagnostics = await typecheck(files);
    expect(formatDiagnostics(diagnostics)).toBe('');
  });
});
