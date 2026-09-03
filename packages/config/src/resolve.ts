/**
 * `resolveConfigFile` — locate the `tako.config.ts` to load.
 *
 * Overview decision: fixed name `tako.config.ts`, walk up from `cwd`,
 * `--config <path>` override, `.ts` family only. No `Bun.*` — `node:fs` /
 * `node:path`.
 */
import { existsSync } from 'node:fs';
import { dirname, extname, isAbsolute, resolve } from 'node:path';
import { ConfigNotFoundError } from './errors.js';

const CONFIG_NAME = 'tako.config.ts';
const TS_EXTENSIONS = new Set(['.ts', '.mts', '.cts']);

export function resolveConfigFile(opts: {
  cwd: string;
  configPath?: string;
}): string {
  const { cwd, configPath } = opts;

  if (configPath !== undefined) {
    const abs = isAbsolute(configPath) ? configPath : resolve(cwd, configPath);
    if (!TS_EXTENSIONS.has(extname(abs))) {
      throw new ConfigNotFoundError(
        `the --config path '${configPath}' must end in .ts, .mts or .cts`,
        [abs],
      );
    }
    if (!existsSync(abs)) {
      throw new ConfigNotFoundError(
        `the --config path '${configPath}' does not exist`,
        [abs],
      );
    }
    return abs;
  }

  const tried: string[] = [];
  let dir = resolve(cwd);
  while (true) {
    const candidate = resolve(dir, CONFIG_NAME);
    tried.push(candidate);
    if (existsSync(candidate)) {
      return candidate;
    }
    // Stop at a project root (a directory containing `.git`), inclusive.
    if (existsSync(resolve(dir, '.git'))) {
      break;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }

  throw new ConfigNotFoundError(
    `no ${CONFIG_NAME} found. Tried:\n${tried.map((p) => `  - ${p}`).join('\n')}`,
    tried,
  );
}
