/**
 * `tako init` — write the commented `tako.config.ts` skeleton into the current
 * directory. No prompts, no schema auto-detection; refuses to overwrite unless
 * `--force` (`backlog/features/cli/technical.md` §`tako init`).
 *
 * `--monorepo` / `--no-monorepo` picks between `CONFIG_TEMPLATE` and
 * `CONFIG_TEMPLATE_MONOREPO`; unset, it auto-detects a workspace by walking up
 * for the nearest `package.json` (`workspaces` key, or a sibling
 * `pnpm-workspace.yaml`).
 */
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { CONFIG_TEMPLATE, CONFIG_TEMPLATE_MONOREPO } from '@kurotako/config';
import { defineCommand } from 'citty';
import { sharedArgs } from '../args.js';
import { ConfigExistsError } from '../errors.js';
import { ConsoleReporter } from '../reporter.js';

/**
 * Walk up from `startDir` to the first directory holding a `package.json`. A
 * workspace when that `package.json` has a `workspaces` key (array, or
 * `{ packages: [...] }`), or when a `pnpm-workspace.yaml` sits next to it.
 * Returns `false` when no `package.json` is found.
 */
function detectMonorepo(startDir: string): boolean {
  let dir = resolve(startDir);
  while (true) {
    const pkgPath = resolve(dir, 'package.json');
    if (existsSync(pkgPath)) {
      if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) {
        return true;
      }
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
          workspaces?: unknown;
        };
        const ws = pkg.workspaces;
        if (
          Array.isArray(ws) ||
          (typeof ws === 'object' &&
            ws !== null &&
            Array.isArray((ws as { packages?: unknown }).packages))
        ) {
          return true;
        }
      } catch {
        // Unreadable / invalid package.json: treat as not a workspace.
      }
      return false;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      return false;
    }
    dir = parent;
  }
}

export const initCommand = defineCommand({
  meta: {
    name: 'init',
    description: 'create a tako.config.ts in the current directory',
  },
  args: {
    ...sharedArgs,
    force: {
      type: 'boolean',
      description: 'overwrite an existing config file',
      default: false,
    },
    monorepo: {
      type: 'boolean',
      description:
        'write the monorepo config layout (auto-detected from workspaces when unset)',
      default: undefined,
    },
  },
  run: async ({ args }) => {
    const reporter = new ConsoleReporter({ debug: Boolean(args.debug) });
    const cwd = process.cwd();
    // Unlike `loadConfig`, `init` never walks up: it always targets `cwd`.
    const target = args.config
      ? resolve(cwd, args.config)
      : resolve(cwd, 'tako.config.ts');

    if (existsSync(target) && !args.force) {
      throw new ConfigExistsError(target);
    }

    // citty leaves an unset boolean flag `undefined` (no `default`), so
    // `--monorepo` / `--no-monorepo` win and absence falls back to detection.
    const monorepo: boolean =
      typeof args.monorepo === 'boolean' ? args.monorepo : detectMonorepo(cwd);

    await mkdir(dirname(target), { recursive: true });
    await writeFile(
      target,
      monorepo ? CONFIG_TEMPLATE_MONOREPO : CONFIG_TEMPLATE,
      'utf8',
    );

    const name = relative(cwd, target) || 'tako.config.ts';
    reporter.info(
      monorepo ? `created ${name} (monorepo layout)` : `created ${name}`,
    );
  },
});
