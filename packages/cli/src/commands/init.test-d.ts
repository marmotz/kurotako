/**
 * Compile-only fixture. `tsc -b` type-checks this file; vitest ignores it (no
 * `.test.ts` suffix). It pins that the body `tako init` writes into
 * `CONFIG_TEMPLATE` — once its example lines are uncommented — type-checks
 * against the real `prismaParser` / `zodGenerator` drivers, and that a strict
 * Prisma option schema rejects an unknown key at the config entry.
 */
import { defineConfig, type SourceEntry } from '@kurotako/config';
import { zodGenerator } from '@kurotako/gen-zod';
import { prismaParser } from '@kurotako/parser-prisma';
import { initCommand } from './init.js';

// `tako init --monorepo` is declared as a boolean flag with no `default`, so at
// runtime citty leaves it `undefined` unless `--monorepo` / `--no-monorepo` is
// passed; `init.ts` narrows with `typeof === 'boolean'` before falling back to
// auto-detection.
const initArgs = initCommand.args as {
  monorepo: { type: 'boolean'; default?: boolean | undefined };
};
export const monorepoDefault: boolean | undefined = initArgs.monorepo.default;

// The uncommented body of `CONFIG_TEMPLATE` (packages/config/src/template.ts).
export const config = defineConfig({
  sources: {
    pg: { use: prismaParser, options: { schema: './prisma/schema.prisma' } },
  },
  generators: [{ use: zodGenerator }],
  outputs: [{ dir: './generated/kurotako' }],
});

// `PrismaParserOptions` is a `v.strictObject` — an unknown key is a type error at
// the entry, not just at load time.
export const unknownPrismaOption: SourceEntry<typeof prismaParser> = {
  use: prismaParser,
  // @ts-expect-error — `schemaPath` is not a known Prisma option key
  options: { schemaPath: './x' },
};
