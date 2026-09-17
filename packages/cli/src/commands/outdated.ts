/**
 * `tako outdated` — on-demand check of the installed `@kurotako/*` packages
 * in the target project against the npm registry. Informational only, always
 * exits 0.
 *
 * Design: `backlog/features/cli-self-update/technical.md` §`tako outdated`
 * command.
 */

import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { defineCommand } from 'citty';
import { sharedArgs } from '../args.js';
import { ConsoleReporter } from '../reporter.js';
import { compareVersions } from '../version-check.js';

interface PackageEntry {
  name: string;
  installed: string | undefined;
  latest: string | undefined;
}

function findProjectPackageJson(cwd: string): string | undefined {
  let dir = resolve(cwd);
  while (true) {
    const candidate = resolve(dir, 'package.json');
    if (existsSync(candidate)) {
      return candidate;
    }
    if (existsSync(resolve(dir, '.git'))) {
      return undefined;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      return undefined;
    }
    dir = parent;
  }
}

function collectKurotakoDependencies(packageJsonPath: string): string[] {
  const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const names = new Set([
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
  ]);
  return [...names].filter((name) => name.startsWith('@kurotako/')).sort();
}

function resolveInstalledVersion(
  packageJsonPath: string,
  name: string,
): string | undefined {
  try {
    const require = createRequire(packageJsonPath);
    // Packages only export their main entry point, not "./package.json"
    // (blocked by their `exports` field), so walk the same node_modules
    // lookup path Node would use and read the package.json directly instead
    // of going through module resolution.
    const searchPaths = require.resolve.paths(name) ?? [];
    for (const modulesDir of searchPaths) {
      const candidate = resolve(modulesDir, name, 'package.json');
      if (existsSync(candidate)) {
        const pkg = JSON.parse(readFileSync(candidate, 'utf8')) as {
          version?: string;
        };

        return pkg.version;
      }
    }

    return undefined;
  } catch {
    return undefined;
  }
}

async function fetchLatestVersion(name: string): Promise<string | undefined> {
  try {
    const response = await fetch(`https://registry.npmjs.org/${name}/latest`);
    if (!response.ok) {
      return undefined;
    }
    const body = (await response.json()) as { version?: unknown };
    return typeof body.version === 'string' ? body.version : undefined;
  } catch {
    return undefined;
  }
}

function formatTable(entries: PackageEntry[]): string {
  const rows = entries.map((entry) => ({
    name: entry.name,
    installed: entry.installed ?? 'unknown',
    latest: entry.latest ?? 'unknown',
    status:
      entry.installed === undefined || entry.latest === undefined
        ? 'unknown'
        : compareVersions(entry.latest, entry.installed) > 0
          ? 'outdated'
          : 'up to date',
  }));

  const widths = {
    name: Math.max(7, ...rows.map((r) => r.name.length)),
    installed: Math.max(9, ...rows.map((r) => r.installed.length)),
    latest: Math.max(6, ...rows.map((r) => r.latest.length)),
  };

  const header = `  ${'package'.padEnd(widths.name)}  ${'installed'.padEnd(widths.installed)}  ${'latest'.padEnd(widths.latest)}  status`;
  const lines = rows.map(
    (r) =>
      `  ${r.name.padEnd(widths.name)}  ${r.installed.padEnd(widths.installed)}  ${r.latest.padEnd(widths.latest)}  ${r.status}`,
  );

  return [header, ...lines].join('\n');
}

export const outdatedCommand = defineCommand({
  meta: {
    name: 'outdated',
    description:
      'check installed @kurotako/* packages against the npm registry',
  },
  args: { ...sharedArgs },
  run: async ({ args }) => {
    const reporter = new ConsoleReporter({ debug: Boolean(args.debug) });
    const cwd = process.cwd();

    const packageJsonPath = findProjectPackageJson(cwd);
    if (!packageJsonPath) {
      reporter.error('no package.json found (searched up to the project root)');
      process.exitCode ??= 0;
      return;
    }

    const names = collectKurotakoDependencies(packageJsonPath);
    if (names.length === 0) {
      reporter.info('no @kurotako/* dependency found');
      process.exitCode ??= 0;
      return;
    }

    const entries: PackageEntry[] = await Promise.all(
      names.map(async (name) => ({
        name,
        installed: resolveInstalledVersion(packageJsonPath, name),
        latest: await fetchLatestVersion(name),
      })),
    );

    reporter.info(`tako outdated\n${formatTable(entries)}`);
    process.exitCode ??= 0;
  },
});
