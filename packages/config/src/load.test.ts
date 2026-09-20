import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const PKG_DIR = join(import.meta.dirname, '..');

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ConfigLoadError,
  ConfigShapeError,
  DependencyCycleError,
  DriverOptionsError,
  DuplicateDependencyError,
  DuplicateGeneratorError,
  LegacyDependencyError,
  NoDefaultExportError,
  UnknownGeneratorError,
  UnknownNamespaceError,
} from './errors.js';
import { loadConfig } from './load.js';

// Temp fixtures live under the package dir so `jiti` resolves `valibot` /
// `@kurotako/*` through the normal node_modules walk.
let root: string;

beforeEach(() => {
  root = mkdtempSync(join(PKG_DIR, 'tmp-load-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function writeConfig(source: string): string {
  const file = join(root, 'tako.config.ts');
  writeFileSync(file, source);
  return file;
}

describe('loadConfig', () => {
  it('builds a ResolvedConfig: generators keyed by name, absolute output.dir, rootDir, hooks', async () => {
    writeConfig(`
      const parser = { name: 'p', parse: () => ({ namespace: 'pg', parser: 'p', entities: {}, enums: {} }) }
      const gen = { name: 'zod', generate: () => ({ files: [], artifact: { entities: {} } }) }
      export const hooks = { afterEmit: () => {} }
      export default {
        sources: { pg: { use: parser } },
        generators: [{ use: gen }],
        outputs: [{}],
        hooks,
      }
    `);
    const { config, configFile, rootDir } = await loadConfig({ cwd: root });
    expect(configFile).toBe(join(root, 'tako.config.ts'));
    expect(rootDir).toBe(root);
    expect(config.rootDir).toBe(root);
    expect(Object.keys(config.generators)).toEqual(['zod']);
    expect(config.generators.zod?.generator.dependsOn).toBeUndefined();
    expect(config.outputs).toHaveLength(1);
    expect(config.outputs[0]?.mode).toBe('dir');
    expect(config.outputs[0]?.dir).toBe(join(root, 'generated', 'kurotako'));
    expect(typeof config.hooks?.afterEmit).toBe('function');
  });

  it('validates options against optionsSchema and curries the parsed value into parse/generate', async () => {
    writeConfig(`
      import * as v from 'valibot'
      const schema = v.object({ n: v.pipe(v.number(), v.transform(x => x * 2)) })
      let seen
      const parser = {
        name: 'p',
        optionsSchema: schema,
        parse: (_ctx, options) => { seen = options; return { namespace: 'pg', parser: 'p', entities: {}, enums: {} } },
      }
      export default {
        sources: { pg: { use: parser, options: { n: 21 } } },
        generators: [],
        outputs: [{}],
      }
      export const _peek = () => seen
    `);
    const { config } = await loadConfig({ cwd: root });
    expect(config.sources.pg?.options).toEqual({ n: 42 });
    await config.sources.pg?.parser.parse({
      namespace: 'pg',
      cwd: root,
      logger: { debug() {}, info() {}, warn() {}, error() {} },
    });
  });

  it('curries the validated options into parser.anchor and passes rootDir through', async () => {
    writeConfig(`
      import * as v from 'valibot'
      const parser = {
        name: 'p',
        optionsSchema: v.object({ suffix: v.pipe(v.string(), v.transform(s => s.toUpperCase())) }),
        parse: () => ({ namespace: 'pg', parser: 'p', entities: {}, enums: {} }),
        anchor: (rootDir, options) => rootDir + '/' + options.suffix,
      }
      export default {
        sources: { pg: { use: parser, options: { suffix: 'db' } } },
        generators: [],
        outputs: [{}],
      }
    `);
    const { config } = await loadConfig({ cwd: root });
    const anchor = config.sources.pg?.parser.anchor;
    expect(anchor).toBeTypeOf('function');
    expect(await anchor?.('/repo')).toBe('/repo/DB');
  });

  it('leaves parser.anchor undefined when the driver declares no anchor hook', async () => {
    writeConfig(`
      export default {
        sources: { pg: { use: { name: 'p', parse: () => ({ namespace: 'pg', parser: 'p', entities: {}, enums: {} }) } } },
        generators: [],
        outputs: [{}],
      }
    `);
    const { config } = await loadConfig({ cwd: root });
    expect(config.sources.pg?.parser.anchor).toBeUndefined();
  });

  it('normalises a missing options key to {} so an all-default optionsSchema resolves to its defaults', async () => {
    writeConfig(`
      import * as v from 'valibot'
      const gen = {
        name: 'zod',
        optionsSchema: v.object({ zodVersion: v.optional(v.picklist([3, 4]), 4) }),
        generate: () => ({ files: [], artifact: { entities: {} } }),
      }
      export default {
        sources: { pg: { use: { name: 'p', parse: () => ({ namespace: 'pg', parser: 'p', entities: {}, enums: {} }) } } },
        generators: [{ use: gen }],
        outputs: [{}],
      }
    `);
    const { config } = await loadConfig({ cwd: root });
    expect(config.generators.zod?.options).toEqual({ zodVersion: 4 });
  });

  it('rejects bad options with a DriverOptionsError naming the driver + namespace', async () => {
    writeConfig(`
      import * as v from 'valibot'
      const parser = {
        name: 'prisma',
        optionsSchema: v.object({ schema: v.string() }),
        parse: () => ({ namespace: 'pg', parser: 'prisma', entities: {}, enums: {} }),
      }
      export default { sources: { pg: { use: parser, options: { schema: 42 } } }, generators: [], outputs: [{}] }
    `);
    try {
      await loadConfig({ cwd: root });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(DriverOptionsError);
      expect((err as DriverOptionsError).role).toBe('parser');
      expect((err as DriverOptionsError).driverName).toBe('prisma');
      expect((err as DriverOptionsError).namespace).toBe('pg');
    }
  });

  it('rejects a driver with no optionsSchema but a non-object options', async () => {
    writeConfig(`
      const gen = { name: 'zod', generate: () => ({ files: [], artifact: { entities: {} } }) }
      export default {
        sources: { pg: { use: { name: 'p', parse: () => ({ namespace: 'pg', parser: 'p', entities: {}, enums: {} }) } } },
        generators: [{ use: gen, options: 'nope' }],
        outputs: [{}],
      }
    `);
    await expect(loadConfig({ cwd: root })).rejects.toBeInstanceOf(
      DriverOptionsError,
    );
  });

  it('rejects duplicate generator names', async () => {
    writeConfig(`
      const gen = { name: 'zod', generate: () => ({ files: [], artifact: { entities: {} } }) }
      export default {
        sources: { pg: { use: { name: 'p', parse: () => ({ namespace: 'pg', parser: 'p', entities: {}, enums: {} }) } } },
        generators: [{ use: gen }, { use: { ...gen } }],
        outputs: [{}],
      }
    `);
    await expect(loadConfig({ cwd: root })).rejects.toBeInstanceOf(
      DuplicateGeneratorError,
    );
  });

  it('rejects a namespaces allowlist naming an unknown namespace', async () => {
    writeConfig(`
      const gen = { name: 'zod', generate: () => ({ files: [], artifact: { entities: {} } }) }
      export default {
        sources: { pg: { use: { name: 'p', parse: () => ({ namespace: 'pg', parser: 'p', entities: {}, enums: {} }) } } },
        generators: [{ use: gen, namespaces: ['nope'] }],
        outputs: [{}],
      }
    `);
    await expect(loadConfig({ cwd: root })).rejects.toBeInstanceOf(
      UnknownNamespaceError,
    );
  });

  const parserSrc =
    "{ name: 'p', parse: () => ({ namespace: 'pg', parser: 'p', entities: {}, enums: {} }) }";

  it("rejects outputs[].mode 'package' with neither packagesDir nor scope", async () => {
    writeConfig(`
      export default {
        sources: { pg: { use: ${parserSrc} } },
        generators: [],
        outputs: [{ mode: 'package' }],
      }
    `);
    await expect(loadConfig({ cwd: root })).rejects.toBeInstanceOf(
      ConfigShapeError,
    );
  });

  it("rejects outputs[].mode 'package' with packagesDir but no scope", async () => {
    writeConfig(`
      export default {
        sources: { pg: { use: ${parserSrc} } },
        generators: [],
        outputs: [{ mode: 'package', packagesDir: './pkgs' }],
      }
    `);
    try {
      await loadConfig({ cwd: root });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigShapeError);
      expect((err as ConfigShapeError).issues.map((i) => i.path)).toEqual([
        'outputs.0.scope',
      ]);
    }
  });

  it("rejects outputs[].mode 'package' with scope but no packagesDir", async () => {
    writeConfig(`
      export default {
        sources: { pg: { use: ${parserSrc} } },
        generators: [],
        outputs: [{ mode: 'package', scope: '@acme' }],
      }
    `);
    try {
      await loadConfig({ cwd: root });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigShapeError);
      expect((err as ConfigShapeError).issues.map((i) => i.path)).toEqual([
        'outputs.0.packagesDir',
      ]);
    }
  });

  it("rejects outputs[].mode 'package' with a scope containing a '/' (would nest the generated package dir)", async () => {
    writeConfig(`
      export default {
        sources: { pg: { use: ${parserSrc} } },
        generators: [],
        outputs: [{ mode: 'package', packagesDir: './pkgs', scope: '@acme/dto' }],
      }
    `);
    try {
      await loadConfig({ cwd: root });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigShapeError);
      const issues = (err as ConfigShapeError).issues;
      expect(issues.map((i) => i.path)).toEqual(['outputs.0.scope']);
      expect(issues[0]?.message).toContain('not a valid npm scope');
    }
  });

  it('rejects a no-optionsSchema driver whose options is an exotic object (Date)', async () => {
    writeConfig(`
      const gen = { name: 'zod', generate: () => ({ files: [], artifact: { entities: {} } }) }
      export default {
        sources: { pg: { use: ${parserSrc} } },
        generators: [{ use: gen, options: new Date() }],
        outputs: [{}],
      }
    `);
    await expect(loadConfig({ cwd: root })).rejects.toBeInstanceOf(
      DriverOptionsError,
    );
  });

  it("resolves outputs[].mode 'package' with both packagesDir and scope, passing packageManager through", async () => {
    writeConfig(`
      export default {
        sources: { pg: { use: { name: 'p', parse: () => ({ namespace: 'pg', parser: 'p', entities: {}, enums: {} }) } } },
        generators: [],
        outputs: [{ mode: 'package', packagesDir: './pkgs', scope: '@acme', packageManager: 'pnpm' }],
      }
    `);
    const { config } = await loadConfig({ cwd: root });
    expect(config.outputs[0]?.mode).toBe('package');
    expect(config.outputs[0]?.packagesDir).toBe(join(root, 'pkgs'));
    expect(config.outputs[0]?.scope).toBe('@acme');
    expect(config.outputs[0]?.packageManager).toBe('pnpm');
  });

  it('rejects outputs[1].generators naming a generator absent from generators[]', async () => {
    writeConfig(`
      const gen = { name: 'zod', generate: () => ({ files: [], artifact: { entities: {} } }) }
      export default {
        sources: { pg: { use: ${parserSrc} } },
        generators: [{ use: gen }],
        outputs: [{}, { generators: ['nope'] }],
      }
    `);
    try {
      await loadConfig({ cwd: root });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(UnknownGeneratorError);
      expect((err as UnknownGeneratorError).outputIndex).toBe(1);
      expect((err as UnknownGeneratorError).generator).toBe('nope');
    }
  });

  it("rejects outputs[].mode 'package' missing scope in the second of two outputs, leaving the first unaffected", async () => {
    writeConfig(`
      export default {
        sources: { pg: { use: ${parserSrc} } },
        generators: [],
        outputs: [{ mode: 'dir' }, { mode: 'package', packagesDir: './pkgs' }],
      }
    `);
    try {
      await loadConfig({ cwd: root });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigShapeError);
      expect((err as ConfigShapeError).issues.map((i) => i.path)).toEqual([
        'outputs.1.scope',
      ]);
    }
  });

  it('resolves a valid two-entry outputs, each dir/packagesDir absolutized independently', async () => {
    writeConfig(`
      export default {
        sources: { pg: { use: ${parserSrc} } },
        generators: [],
        outputs: [
          { dir: './out-a' },
          { mode: 'package', packagesDir: './pkgs-b', scope: '@acme' },
        ],
      }
    `);
    const { config } = await loadConfig({ cwd: root });
    expect(config.outputs).toHaveLength(2);
    expect(config.outputs[0]?.dir).toBe(join(root, 'out-a'));
    expect(config.outputs[1]?.mode).toBe('package');
    expect(config.outputs[1]?.packagesDir).toBe(join(root, 'pkgs-b'));
    expect(config.outputs[1]?.scope).toBe('@acme');
  });

  it('wraps an import-time throw as ConfigLoadError with cause', async () => {
    writeConfig(`throw new Error('boom')`);
    try {
      await loadConfig({ cwd: root });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigLoadError);
      expect((err as ConfigLoadError).cause).toBeInstanceOf(Error);
    }
  });

  it('throws NoDefaultExportError when there is no default export', async () => {
    writeConfig(`export const foo = 1`);
    await expect(loadConfig({ cwd: root })).rejects.toBeInstanceOf(
      NoDefaultExportError,
    );
  });
});

describe('loadConfig: private generator dependencies', () => {
  const PRELUDE = `
    const parser = { name: 'p', parse: () => ({ namespace: 'pg', parser: 'p', entities: {}, enums: {} }) }
    const out = { files: [], artifact: { entities: {} } }
  `;

  function withGenerators(body: string, generators: string): void {
    writeConfig(`
      import * as v from 'valibot'
      ${PRELUDE}
      ${body}
      export default {
        sources: { pg: { use: parser } },
        generators: ${generators},
        outputs: [{}],
      }
    `);
  }

  it('curries a static descriptor array into core generators with options bound', async () => {
    withGenerators(
      `
      const zod = {
        name: 'zod',
        optionsSchema: v.object({ zodVersion: v.optional(v.picklist([3, 4]), 4) }),
        generate: (_ctx, options) => ({ files: [], artifact: { entities: {}, extra: options } }),
      }
      const angular = {
        name: 'angular',
        dependsOn: [{ use: zod, options: { zodVersion: 3 } }],
        generate: () => out,
      }
      `,
      '[{ use: angular }]',
    );
    const { config } = await loadConfig({ cwd: root });
    const angular = config.generators.angular?.generator;
    expect(Object.keys(config.generators)).toEqual(['angular']);
    expect(angular?.dependsOn?.map((g) => g.name)).toEqual(['zod']);
    const out = await angular?.dependsOn?.[0]?.generate({} as never);
    expect(out?.artifact.extra).toEqual({ zodVersion: 3 });
  });

  it('applies the dependency schema defaults when the descriptor omits options', async () => {
    withGenerators(
      `
      const zod = {
        name: 'zod',
        optionsSchema: v.object({ zodVersion: v.optional(v.picklist([3, 4]), 4) }),
        generate: (_ctx, options) => ({ files: [], artifact: { entities: {}, extra: options } }),
      }
      const angular = { name: 'angular', dependsOn: [{ use: zod }], generate: () => out }
      `,
      '[{ use: angular }]',
    );
    const { config } = await loadConfig({ cwd: root });
    const out =
      await config.generators.angular?.generator.dependsOn?.[0]?.generate(
        {} as never,
      );
    expect(out?.artifact.extra).toEqual({ zodVersion: 4 });
  });

  it('calls the function form with the dependent validated options', async () => {
    withGenerators(
      `
      const zod = {
        name: 'zod',
        optionsSchema: v.object({ zodVersion: v.picklist([3, 4]) }),
        generate: (_ctx, options) => ({ files: [], artifact: { entities: {}, extra: options } }),
      }
      const angular = {
        name: 'angular',
        optionsSchema: v.object({ zodVersion: v.optional(v.picklist([3, 4]), 4) }),
        dependsOn: (options) => [{ use: zod, options: { zodVersion: options.zodVersion } }],
        generate: () => out,
      }
      `,
      '[{ use: angular, options: { zodVersion: 3 } }]',
    );
    const { config } = await loadConfig({ cwd: root });
    const out =
      await config.generators.angular?.generator.dependsOn?.[0]?.generate(
        {} as never,
      );
    expect(out?.artifact.extra).toEqual({ zodVersion: 3 });
  });

  it('resolves a deep chain, each level curried', async () => {
    withGenerators(
      `
      const c = { name: 'c', generate: () => out }
      const b = { name: 'b', dependsOn: [{ use: c }], generate: () => out }
      const a = { name: 'a', dependsOn: [{ use: b }], generate: () => out }
      `,
      '[{ use: a }]',
    );
    const { config } = await loadConfig({ cwd: root });
    const a = config.generators.a?.generator;
    expect(a?.dependsOn?.[0]?.name).toBe('b');
    expect(a?.dependsOn?.[0]?.dependsOn?.[0]?.name).toBe('c');
    expect(Object.keys(config.generators)).toEqual(['a']);
  });

  it('keeps top-level uniqueness independent of private instances', async () => {
    withGenerators(
      `
      const zod = { name: 'zod', generate: () => out }
      const angular = { name: 'angular', dependsOn: [{ use: zod }], generate: () => out }
      `,
      '[{ use: angular }, { use: zod }]',
    );
    const { config } = await loadConfig({ cwd: root });
    expect(Object.keys(config.generators)).toEqual(['angular', 'zod']);
  });

  it('a function form that throws becomes a ConfigShapeError naming the generator', async () => {
    withGenerators(
      `
      const angular = {
        name: 'angular',
        dependsOn: () => { throw new Error('nope') },
        generate: () => out,
      }
      `,
      '[{ use: angular }]',
    );
    const error = await loadConfig({ cwd: root }).catch((e) => e);
    expect(error).toBeInstanceOf(ConfigShapeError);
    expect(error.issues).toEqual([
      {
        path: 'generators.angular.dependsOn',
        message: 'dependsOn() threw: nope',
      },
    ]);
  });

  it('a function form returning a non-array becomes a ConfigShapeError', async () => {
    withGenerators(
      `
      const angular = { name: 'angular', dependsOn: () => 'zod', generate: () => out }
      `,
      '[{ use: angular }]',
    );
    const error = await loadConfig({ cwd: root }).catch((e) => e);
    expect(error).toBeInstanceOf(ConfigShapeError);
    expect(error.issues[0].path).toBe('generators.angular.dependsOn');
  });

  it('a malformed descriptor becomes a ConfigShapeError locating the entry', async () => {
    withGenerators(
      `
      const angular = { name: 'angular', dependsOn: [{ options: {} }], generate: () => out }
      `,
      '[{ use: angular }]',
    );
    const error = await loadConfig({ cwd: root }).catch((e) => e);
    expect(error).toBeInstanceOf(ConfigShapeError);
    expect(error.issues[0].path).toBe('generators.angular.dependsOn.0');
  });

  it('a bad dependency option names both the dependency and its dependent', async () => {
    withGenerators(
      `
      const zod = {
        name: 'zod',
        optionsSchema: v.strictObject({ zodVersion: v.picklist([3, 4]) }),
        generate: () => out,
      }
      const angular = {
        name: 'angular',
        dependsOn: [{ use: zod, options: { zodVersion: 9 } }],
        generate: () => out,
      }
      `,
      '[{ use: angular }]',
    );
    const error = await loadConfig({ cwd: root }).catch((e) => e);
    expect(error).toBeInstanceOf(DriverOptionsError);
    expect(error).toMatchObject({ driverName: 'zod', via: 'angular' });
    expect(error.message).toContain(
      "invalid options for generator 'zod' (required by 'angular')",
    );
  });

  it('rejects two descriptors of the same driver in one dependsOn', async () => {
    withGenerators(
      `
      const zod = { name: 'zod', generate: () => out }
      const angular = {
        name: 'angular',
        dependsOn: [{ use: zod }, { use: zod }],
        generate: () => out,
      }
      `,
      '[{ use: angular }]',
    );
    const error = await loadConfig({ cwd: root }).catch((e) => e);
    expect(error).toBeInstanceOf(DuplicateDependencyError);
    expect(error).toMatchObject({ generator: 'angular', dependency: 'zod' });
  });

  it('rejects a dependency cycle reachable through the function form', async () => {
    withGenerators(
      `
      const a = { name: 'a', dependsOn: () => [{ use: b }], generate: () => out }
      const b = { name: 'b', dependsOn: () => [{ use: a }], generate: () => out }
      `,
      '[{ use: a }]',
    );
    const error = await loadConfig({ cwd: root }).catch((e) => e);
    expect(error).toBeInstanceOf(DependencyCycleError);
    expect(error.code).toBe('dependency_cycle');
    expect(error.cycle).toEqual(['a', 'b', 'a']);
  });

  it('rejects a name-based string dependency with LegacyDependencyError', async () => {
    withGenerators(
      `const angular = { name: 'angular', dependsOn: ['zod'], generate: () => out }`,
      '[{ use: angular }]',
    );
    const error = await loadConfig({ cwd: root }).catch((e) => e);
    expect(error).toBeInstanceOf(LegacyDependencyError);
    expect(error.message).toContain("'zod'");
    expect(error.message).toContain('dependsOn: [{ use:');
  });

  it('rejects optionalDependsOn with LegacyDependencyError', async () => {
    withGenerators(
      `const angular = { name: 'angular', optionalDependsOn: ['zod'], generate: () => out }`,
      '[{ use: angular }]',
    );
    const error = await loadConfig({ cwd: root }).catch((e) => e);
    expect(error).toBeInstanceOf(LegacyDependencyError);
    expect(error.message).toContain('optionalDependsOn');
  });

  it('rejects a legacy string dependency inside a nested dependency', async () => {
    withGenerators(
      `
      const zod = { name: 'zod', dependsOn: ['base'], generate: () => out }
      const angular = { name: 'angular', dependsOn: [{ use: zod }], generate: () => out }
      `,
      '[{ use: angular }]',
    );
    const error = await loadConfig({ cwd: root }).catch((e) => e);
    expect(error).toBeInstanceOf(LegacyDependencyError);
    expect(error.generator).toBe('zod');
  });
});
