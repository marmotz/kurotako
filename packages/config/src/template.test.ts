import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadConfig } from './load.js';
import { CONFIG_TEMPLATE } from './template.js';

const PKG_DIR = join(import.meta.dirname, '..');

describe('CONFIG_TEMPLATE', () => {
  it('is a non-empty string importing defineConfig from @kurotako/config', () => {
    expect(CONFIG_TEMPLATE.length).toBeGreaterThan(0);
    expect(CONFIG_TEMPLATE).toContain(
      "import { defineConfig } from '@kurotako/config'",
    );
    expect(CONFIG_TEMPLATE).toContain('export default defineConfig(');
    expect(CONFIG_TEMPLATE).toContain(
      "output: { dir: './generated/kurotako' }",
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
      ).replace("import { defineConfig } from '@kurotako/config'", '');
      writeFileSync(
        join(root, 'tako.config.ts'),
        filled.replace('export default defineConfig(', 'export default ('),
      );
      const { config } = await loadConfig({ cwd: root });
      expect(Object.keys(config.sources)).toEqual(['pg']);
      expect(config.generators).toEqual({});
      expect(config.output.dir).toBe(join(root, 'generated', 'kurotako'));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
