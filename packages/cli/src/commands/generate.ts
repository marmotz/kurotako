/**
 * `tako generate` — `loadConfig()` then `run()`. `--dry-run` runs everything but
 * skips the Writer; `--watch` hands off to the chokidar loop
 * (`backlog/features/cli/technical.md` §`tako generate`).
 */
import { relative } from 'node:path';
import { type LoadResult, loadConfig } from '@kurotako/config';
import type { OutputConfig, ResolvedConfig, RunResult } from '@kurotako/core';
import { run } from '@kurotako/core';
import { defineCommand } from 'citty';
import { sharedArgs } from '../args.js';
import { ConsoleReporter } from '../reporter.js';
import { watchAndRun } from '../watch.js';

export interface LoadAndRunOptions {
  cwd: string;
  configPath?: string;
  write: boolean;
  signal?: AbortSignal;
  reporter: ConsoleReporter;
}

export interface LoadAndRunResult {
  result: RunResult;
  config: ResolvedConfig;
  configFile: string;
  rootDir: string;
}

/** The directory named in the `wrote N files -> …` summary line, for one output. */
export function outputSummaryDir(
  output: OutputConfig,
  config: ResolvedConfig,
): string {
  return output.mode === 'package'
    ? (output.packagesDir ?? config.rootDir)
    : (output.dir ?? config.rootDir);
}

/**
 * The shared body of `generate`, `validate` and each watch cycle: resolve +
 * load the config, then run the pipeline. `write: false` also skips the
 * `afterEmit` hook (`@kurotako/core` `run()`).
 */
export async function loadAndRun(
  opts: LoadAndRunOptions,
): Promise<LoadAndRunResult> {
  const loaded: LoadResult = await loadConfig({
    cwd: opts.cwd,
    configPath: opts.configPath,
  });
  const result = await run(loaded.config, {
    logger: opts.reporter,
    write: opts.write,
    signal: opts.signal,
  });
  return {
    result,
    config: loaded.config,
    configFile: loaded.configFile,
    rootDir: loaded.rootDir,
  };
}

export const generateCommand = defineCommand({
  meta: {
    name: 'generate',
    description: 'run the pipeline and write the generated code',
  },
  args: {
    ...sharedArgs,
    watch: {
      type: 'boolean',
      description: 'rebuild on every schema / config change',
      default: false,
    },
    'dry-run': {
      type: 'boolean',
      description: 'run everything but write nothing',
      default: false,
    },
  },
  run: async ({ args }) => {
    const reporter = new ConsoleReporter({ debug: Boolean(args.debug) });
    const cwd = process.cwd();
    const configPath = args.config || undefined;

    if (args.watch) {
      await watchAndRun({ cwd, configPath, reporter });
      return;
    }

    const dryRun = Boolean(args['dry-run']);
    const { result, config } = await loadAndRun({
      cwd,
      configPath,
      write: !dryRun,
      reporter,
    });

    if (dryRun) {
      reporter.info(`dry run: ${result.files.length} files would be written`);
      return;
    }

    const dirs = config.outputs
      .map((output) => relative(cwd, outputSummaryDir(output, config)))
      .join(', ');
    reporter.info(`wrote ${result.files.length} files -> ${dirs}`);
  },
});
