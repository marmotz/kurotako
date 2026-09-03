/**
 * `CONFIG_TEMPLATE` — the commented `tako.config.ts` `tako init` writes. Keeping
 * the string here means the config package owns what a valid file looks like.
 */
export const CONFIG_TEMPLATE = `import { defineConfig } from '@kurotako/config'
// import { prismaParser } from '@kurotako/parser-prisma'
// import { zodGenerator } from '@kurotako/gen-zod'

export default defineConfig({
  sources: {
    // pg: { use: prismaParser, options: { schema: './prisma/schema.prisma' } },
  },
  generators: [
    // { use: zodGenerator },
  ],
  output: { dir: './generated/kurotako' },
})
`;
