/**
 * `tako validate` — the same checks as `generate` up to (not including)
 * emission. `loadConfig()` + `run({ write: false })`; any `TakoError` propagates
 * to the top-level handler and exits 1
 * (`backlog/features/cli/technical.md` §`tako validate`).
 */
import { defineCommand } from 'citty';
import { sharedArgs } from '../args.js';
import { ConsoleReporter } from '../reporter.js';
import { loadAndRun } from './generate.js';

export const validateCommand = defineCommand({
  meta: {
    name: 'validate',
    description: 'check the config and schema without writing anything',
  },
  args: { ...sharedArgs },
  run: async ({ args }) => {
    const reporter = new ConsoleReporter({ debug: Boolean(args.debug) });
    await loadAndRun({
      cwd: process.cwd(),
      configPath: args.config || undefined,
      write: false,
      reporter,
    });
    reporter.info('config and schema are valid');
  },
});
