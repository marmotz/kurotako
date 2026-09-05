#!/usr/bin/env node
/**
 * `kurotako`'s `tako` entry. Handles `--version` / `-v` itself (so it reports
 * the version the user installed, not `@kurotako/cli`'s), then delegates
 * everything else to the CLI.
 */
import { runCli } from '@kurotako/cli';

declare const __TAKO_VERSION__: string;

const argv = process.argv.slice(2);
if (argv[0] === '--version' || argv[0] === '-v') {
  process.stdout.write(`${__TAKO_VERSION__}\n`);
  process.exitCode = 0;
} else {
  await runCli(argv);
}
