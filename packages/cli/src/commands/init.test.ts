import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CONFIG_TEMPLATE, CONFIG_TEMPLATE_MONOREPO } from '@kurotako/config';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runCli } from '../cli.js';

const PKG_DIR = join(import.meta.dirname, '..', '..');

let root: string;
let cwd: string;
let stderr: string;
let stderrSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  root = mkdtempSync(join(PKG_DIR, 'tmp-init-'));
  cwd = process.cwd();
  process.chdir(root);
  process.exitCode = undefined;
  stderr = '';
  stderrSpy = vi
    .spyOn(process.stderr, 'write')
    .mockImplementation((c: string | Uint8Array) => {
      stderr += c.toString();
      return true;
    });
});

afterEach(() => {
  process.chdir(cwd);
  rmSync(root, { recursive: true, force: true });
  stderrSpy.mockRestore();
  process.exitCode = undefined;
});

describe('tako init', () => {
  it('writes tako.config.ts into cwd with the template content', async () => {
    await runCli(['init']);
    expect(process.exitCode ?? 0).toBe(0);
    expect(readFileSync(join(root, 'tako.config.ts'), 'utf8')).toBe(
      CONFIG_TEMPLATE,
    );
  });

  it('refuses to overwrite an existing config (exit 1, config_exists)', async () => {
    writeFileSync(join(root, 'tako.config.ts'), 'old');
    await runCli(['init']);
    expect(process.exitCode).toBe(1);
    expect(stderr).toContain('config_exists');
    expect(readFileSync(join(root, 'tako.config.ts'), 'utf8')).toBe('old');
  });

  it('--force overwrites', async () => {
    writeFileSync(join(root, 'tako.config.ts'), 'old');
    await runCli(['init', '--force']);
    expect(process.exitCode ?? 0).toBe(0);
    expect(readFileSync(join(root, 'tako.config.ts'), 'utf8')).toBe(
      CONFIG_TEMPLATE,
    );
  });

  it('--config retargets the write', async () => {
    await runCli(['init', '--config', 'nested/custom.config.ts']);
    expect(readFileSync(join(root, 'nested', 'custom.config.ts'), 'utf8')).toBe(
      CONFIG_TEMPLATE,
    );
  });

  describe('--monorepo', () => {
    it('--monorepo forces the monorepo template even with a plain package.json', async () => {
      writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'x' }));
      await runCli(['init', '--monorepo']);
      expect(readFileSync(join(root, 'tako.config.ts'), 'utf8')).toBe(
        CONFIG_TEMPLATE_MONOREPO,
      );
      expect(stderr).toContain('monorepo layout');
    });

    it('--no-monorepo forces the single-project template even with workspaces', async () => {
      writeFileSync(
        join(root, 'package.json'),
        JSON.stringify({ name: 'x', workspaces: ['packages/*'] }),
      );
      await runCli(['init', '--no-monorepo']);
      expect(readFileSync(join(root, 'tako.config.ts'), 'utf8')).toBe(
        CONFIG_TEMPLATE,
      );
    });

    it('auto-detects a workspace from `workspaces` in package.json', async () => {
      writeFileSync(
        join(root, 'package.json'),
        JSON.stringify({ name: 'x', workspaces: ['apps/*'] }),
      );
      await runCli(['init']);
      expect(readFileSync(join(root, 'tako.config.ts'), 'utf8')).toBe(
        CONFIG_TEMPLATE_MONOREPO,
      );
    });

    it('auto-detects a workspace from `workspaces.packages`', async () => {
      writeFileSync(
        join(root, 'package.json'),
        JSON.stringify({ name: 'x', workspaces: { packages: ['apps/*'] } }),
      );
      await runCli(['init']);
      expect(readFileSync(join(root, 'tako.config.ts'), 'utf8')).toBe(
        CONFIG_TEMPLATE_MONOREPO,
      );
    });

    it('auto-detects a workspace from a sibling pnpm-workspace.yaml', async () => {
      writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'x' }));
      writeFileSync(
        join(root, 'pnpm-workspace.yaml'),
        "packages:\n  - 'apps/*'\n",
      );
      await runCli(['init']);
      expect(readFileSync(join(root, 'tako.config.ts'), 'utf8')).toBe(
        CONFIG_TEMPLATE_MONOREPO,
      );
    });

    it('auto-detects a plain package.json as single-project', async () => {
      writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'x' }));
      await runCli(['init']);
      expect(readFileSync(join(root, 'tako.config.ts'), 'utf8')).toBe(
        CONFIG_TEMPLATE,
      );
    });
  });
});
