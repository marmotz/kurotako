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
import {
  PACKAGE_TSCONFIG_BASE,
  PACKAGE_TSUP_CONFIG_BASE,
} from '@kurotako/core';
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

const TSUP_BASE_EXTENSIONS = ['.ts', '.js', '.mjs', '.cjs'];

/**
 * Scaffold the two files mode `package` requires one level above `packagesDir`.
 * Never overwrites: a file that already exists (any `tsup.config.base.*`
 * extension) is reported and left untouched.
 */
async function scaffoldPackageBase(
  packagesDir: string,
  reporter: ConsoleReporter,
  cwd: string,
): Promise<void> {
  const workspaceRoot = dirname(resolve(cwd, packagesDir));
  const shown = (path: string) => relative(cwd, path) || path;
  const tsconfig = resolve(workspaceRoot, 'tsconfig.base.json');
  const tsup = resolve(workspaceRoot, 'tsup.config.base.ts');
  const tsupExisting = TSUP_BASE_EXTENSIONS.map((ext) =>
    resolve(workspaceRoot, `tsup.config.base${ext}`),
  ).find((path) => existsSync(path));

  await mkdir(workspaceRoot, { recursive: true });
  if (existsSync(tsconfig)) {
    reporter.info(`kept existing ${shown(tsconfig)}`);
  } else {
    await writeFile(tsconfig, PACKAGE_TSCONFIG_BASE, 'utf8');
    reporter.info(`created ${shown(tsconfig)}`);
  }
  if (tsupExisting) {
    reporter.info(`kept existing ${shown(tsupExisting)}`);
  } else {
    await writeFile(tsup, PACKAGE_TSUP_CONFIG_BASE, 'utf8');
    reporter.info(`created ${shown(tsup)}`);
  }
}

export const initCommand = defineCommand({
  meta: {
    name: 'init',
    description:
      "create a tako.config.ts in the current directory, or with --package-base the workspace files mode 'package' requires",
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
    'package-base': {
      type: 'boolean',
      description:
        "instead of the config, create tsconfig.base.json and tsup.config.base.ts (mode 'package') one level above --packages-dir; never overwrites",
      default: false,
    },
    'packages-dir': {
      type: 'string',
      description: "the output 'packagesDir' for --package-base",
      default: './packages',
    },
  },
  run: async ({ args }) => {
    const reporter = new ConsoleReporter({ debug: Boolean(args.debug) });
    const cwd = process.cwd();
    if (args['package-base']) {
      await scaffoldPackageBase(String(args['packages-dir']), reporter, cwd);
      return;
    }
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
