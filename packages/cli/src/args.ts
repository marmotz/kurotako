/**
 * `sharedArgs` — the options every sub-command carries. citty has no
 * first-class global-option slot, so this object is spread into each command's
 * `args` (`backlog/features/cli/technical.md` §Global option).
 */
import type { ArgsDef } from 'citty';

export const sharedArgs = {
  config: {
    type: 'string',
    description: 'path to the tako config file (default: ./tako.config.ts)',
  },
  /** Hidden: not advertised, kept minimal. Enables `debug` reporter output. */
  debug: {
    type: 'boolean',
    default: false,
  },
} as const satisfies ArgsDef;
