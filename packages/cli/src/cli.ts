/**
 * `runCli()` — build the citty command tree, dispatch, map every `TakoError` to
 * a formatted message + exit 1. `--version` / `--help` are handled here (citty's
 * own handling lives in `runMain`, which hard-exits — not what a testable
 * `runCli` wants).
 *
 * `backlog/features/cli/technical.md` §Command surface, §Errors and exit codes.
 */
import { TakoError } from '@kurotako/core';
import { type CommandDef, defineCommand, renderUsage, runCommand } from 'citty';
import { checkCommand } from './commands/check.js';
import { generateCommand } from './commands/generate.js';
import { initCommand } from './commands/init.js';
import { validateCommand } from './commands/validate.js';
import { renderError } from './errors.js';
import { ConsoleReporter } from './reporter.js';

declare const __TAKO_VERSION__: string;
const VERSION =
  typeof __TAKO_VERSION__ === 'string' ? __TAKO_VERSION__ : '0.0.0-dev';

const subCommands = {
  init: initCommand,
  generate: generateCommand,
  validate: validateCommand,
  check: checkCommand,
};

const main = defineCommand({
  meta: {
    name: 'tako',
    version: VERSION,
    description: 'synchronise TypeScript schemas from data model to forms',
  },
  subCommands,
});

export async function runCli(argv: string[]): Promise<void> {
  const reporter = new ConsoleReporter({
    debug: argv.includes('--debug') || Boolean(process.env.TAKO_DEBUG),
  });

  if (argv.includes('--version') || argv.includes('-v')) {
    process.stdout.write(`${VERSION}\n`);
    process.exitCode ??= 0;
    return;
  }

  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    const sub = argv.find((a) => !a.startsWith('-'));
    const isSub = sub !== undefined && sub in subCommands;
    const cmd = (
      isSub ? subCommands[sub as keyof typeof subCommands] : main
    ) as CommandDef;
    process.stdout.write(
      `${await renderUsage(cmd, isSub ? (main as CommandDef) : undefined)}\n`,
    );
    process.exitCode ??= 0;
    return;
  }

  try {
    await runCommand(main, { rawArgs: argv });
    process.exitCode ??= 0;
  } catch (error) {
    if (error instanceof TakoError) {
      reporter.error(renderError(error));
      process.exitCode = 1;
    } else if (error instanceof Error && error.name === 'CLIError') {
      // citty usage error (unknown command, missing argument, …).
      reporter.error(error.message);
      process.exitCode = 1;
    } else {
      reporter.error('internal error (this is a bug):');
      console.error(error);
      process.exitCode = 1;
    }
  }
}
