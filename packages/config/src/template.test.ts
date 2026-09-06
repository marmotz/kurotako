import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadConfig } from './load.js';
import { CONFIG_TEMPLATE, CONFIG_TEMPLATE_MONOREPO } from './template.js';

const PKG_DIR = join(import.meta.dirname, '..');

describe('CONFIG_TEMPLATE', () => {
  it('is a non-empty string importing defineConfig from kurotako', () => {
    expect(CONFIG_TEMPLATE.length).toBeGreaterThan(0);
    expect(CONFIG_TEMPLATE).toContain(
      "import { defineConfig } from 'kurotako'",
    );
    expect(CONFIG_TEMPLATE).not.toContain('@kurotako/config');
    expect(CONFIG_TEMPLATE).toContain('export default defineConfig(');
    expect(CONFIG_TEMPLATE).toContain(
      "outputs: [{ dir: './generated/kurotako' }]",
    );
  });

  it('evaluates to a default export of the expected shape', async () => {
    // The template has empty `sources`, which fails the structural schema
    // (minEntries 1). Give it one commented-in driver so it loads, then assert
    // the resolved shape.
    const root = mkdtempSync(join(PKG_DIR, 'tmp-tmpl-'));
    try {
      const filled = CONFIG_TEMPLATE.replace(
        '  sources: {\n',
        "  sources: {\n    pg: { use: { name: 'p', parse: () => ({ namespace: 'pg', parser: 'p', entities: {}, enums: {} }) } },\n",
      )
        .replace(
          '  generators: [\n',
          "  generators: [\n    { use: { name: 'g', optionsSchema: v.object({ zodVersion: v.optional(v.picklist([3, 4]), 4) }), generate: () => ({ files: [], artifact: { entities: {} } }) } },\n",
        )
        .replace(
          "import { defineConfig } from 'kurotako'",
          "import * as v from 'valibot'",
        );
      writeFileSync(
        join(root, 'tako.config.ts'),
        filled.replace('export default defineConfig(', 'export default ('),
      );
      const { config } = await loadConfig({ cwd: root });
      expect(Object.keys(config.sources)).toEqual(['pg']);
      // The generator entry omits `options`; the all-default optionsSchema
      // still resolves to its defaults.
      expect(config.generators.g?.options).toEqual({ zodVersion: 4 });
      expect(config.outputs[0]?.dir).toBe(join(root, 'generated', 'kurotako'));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('CONFIG_TEMPLATE_MONOREPO', () => {
  it('imports defineConfig and carries per-sub-project outputs', () => {
    expect(CONFIG_TEMPLATE_MONOREPO).toContain(
      "import { defineConfig } from 'kurotako'",
    );
    expect(CONFIG_TEMPLATE_MONOREPO).not.toContain('@kurotako/config');
    expect(CONFIG_TEMPLATE_MONOREPO).toContain('export default defineConfig(');
    expect(CONFIG_TEMPLATE_MONOREPO).toContain(
      "{ dir: './libs/db/src/generated', generators: ['zod'] }",
    );
    expect(CONFIG_TEMPLATE_MONOREPO).toContain(
      "{ dir: './apps/web/src/generated' }",
    );
  });

  it('evaluates to a default export of the expected shape', async () => {
    const root = mkdtempSync(join(PKG_DIR, 'tmp-tmpl-mono-'));
    try {
      const filled = CONFIG_TEMPLATE_MONOREPO.replace(
        '  sources: {\n',
        "  sources: {\n    pg: { use: { name: 'p', parse: () => ({ namespace: 'pg', parser: 'p', entities: {}, enums: {} }) } },\n",
      ).replace(
        '  generators: [\n',
        "  generators: [\n    { use: { name: 'zod', generate: () => ({ files: [], artifact: { entities: {} } }) } },\n",
      );
      writeFileSync(
        join(root, 'tako.config.ts'),
        filled.replace('export default defineConfig(', 'export default ('),
      );
      const { config } = await loadConfig({ cwd: root });
      expect(Object.keys(config.sources)).toEqual(['pg']);
      expect(config.outputs.map((o) => o.dir)).toEqual([
        join(root, 'libs', 'db', 'src', 'generated'),
        join(root, 'apps', 'web', 'src', 'generated'),
      ]);
      expect(config.outputs[0]?.generators).toEqual(['zod']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
