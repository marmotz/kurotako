import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const PKG_DIR = join(import.meta.dirname, '..');

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ConfigLoadError,
  ConfigShapeError,
  DriverOptionsError,
  DuplicateGeneratorError,
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
      const gen = { name: 'zod', dependsOn: ['x'], generate: () => ({ files: [], artifact: { entities: {} } }) }
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
    expect(config.generators.zod?.generator.dependsOn).toEqual(['x']);
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
