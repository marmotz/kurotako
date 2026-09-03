/**
 * `tako init` — write the commented `tako.config.ts` skeleton into the current
 * directory. No prompts, no schema auto-detection; refuses to overwrite unless
 * `--force` (`backlog/features/cli/technical.md` §`tako init`).
 */
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { CONFIG_TEMPLATE } from '@kurotako/config';
import { defineCommand } from 'citty';
import { sharedArgs } from '../args.js';
import { ConfigExistsError } from '../errors.js';
import { ConsoleReporter } from '../reporter.js';

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

    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, CONFIG_TEMPLATE, 'utf8');

    reporter.info(`created ${relative(cwd, target) || 'tako.config.ts'}`);
  },
});
