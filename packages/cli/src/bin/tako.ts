#!/usr/bin/env node
/**
 * Executable entry. Thin: parse `process.argv` and delegate to `runCli()`,
 * which sets `process.exitCode`.
 */
import { runCli } from '../cli.js';

await runCli(process.argv.slice(2));
