/**
 * `tako check` — drift guard. Runs the pipeline in plan mode (no disk writes,
 * no `afterEmit`), then compares the planned tree against what is on disk.
 * Exit 0 when they match, exit 1 on any drift or any `TakoError` (the latter
 * via the top-level handler in `cli.ts`).
 *
 * Design: `backlog/features/drift-guard/technical.md` §Command surface.
 */
import { existsSync } from 'node:fs';
import { relative } from 'node:path';
import { loadConfig } from '@kurotako/config';
import { run } from '@kurotako/core';
import { defineCommand } from 'citty';
import { sharedArgs } from '../args.js';
import {
  comparePlanToDisk,
  type DriftEntry,
  ignoreBuildArtifacts,
  markedPackageDirs,
} from '../diff.js';
import { ConsoleReporter } from '../reporter.js';

export const checkCommand = defineCommand({
  meta: {
    name: 'check',
    description:
      'check the generated output on disk matches a fresh generate (drift guard)',
  },
  args: { ...sharedArgs },
  run: async ({ args }) => {
    const reporter = new ConsoleReporter({ debug: Boolean(args.debug) });
    const cwd = process.cwd();

    const { config } = await loadConfig({
      cwd,
      configPath: args.config || undefined,
    });
    const { plan = [] } = await run(config, { logger: reporter, plan: true });

    const roots: string[] = [];
    const ignores: ((absPath: string) => boolean)[] = [];

    for (const output of config.outputs) {
      if (output.mode === 'package') {
        ignores.push(ignoreBuildArtifacts);
        if (output.packagesDir) {
          roots.push(...(await markedPackageDirs(output.packagesDir)));
        }
      } else {
        const dir = output.dir;
        if (!dir) {
          continue;
        }
        if (!existsSync(dir)) {
          reporter.info(
            `output directory ${relative(config.rootDir, dir)} does not exist — run tako generate`,
          );
          process.exitCode = 1;
          return;
        }
        roots.push(dir);
      }
    }

    const ignore = (absPath: string): boolean =>
      ignores.some((fn) => fn(absPath));

    const drift = await comparePlanToDisk({
      plan,
      roots,
      ignore,
      rootDir: config.rootDir,
    });

    if (drift.length === 0) {
      reporter.info('output is in sync');
      process.exitCode ??= 0;
      return;
    }

    reporter.error(formatDrift(drift));
    process.exitCode = 1;
  },
});

function formatDrift(drift: DriftEntry[]): string {
  const width = Math.max(...drift.map((entry) => entry.kind.length));
  const lines = drift.map(
    (entry) => `  ${entry.kind.padEnd(width)}  ${entry.path}`,
  );
  return [
    'drift detected',
    '',
    ...lines,
    '',
    `${drift.length} files differ from a fresh generate. Run \`tako generate\`.`,
  ].join('\n');
}
