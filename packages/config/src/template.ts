/**
 * `CONFIG_TEMPLATE` — the commented `tako.config.ts` `tako init` writes. Keeping
 * the string here means the config package owns what a valid file looks like.
 * `CONFIG_TEMPLATE_MONOREPO` is its workspace-aware sibling (`tako init
 * --monorepo`).
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
  outputs: [{ dir: './generated/kurotako' }],
})
`;

export const CONFIG_TEMPLATE_MONOREPO = `import { defineConfig } from '@kurotako/config'
// import { prismaParser } from '@kurotako/parser-prisma'
// import { zodGenerator } from '@kurotako/gen-zod'

// Monorepo layout: this file sits at the workspace root, but the schema lives in
// a sub-project. \`options.schema\` is always resolved relative to THIS config
// file, not to the schema's package.
//
// \`@prisma/internals\` is resolved from the schema's directory (walking up
// \`node_modules\`), so it can be a devDependency of the sub-project holding the
// schema — it does not have to be hoisted to the workspace root.

export default defineConfig({
  sources: {
    // pg: { use: prismaParser, options: { schema: './libs/db/prisma/schema.prisma' } },
  },
  generators: [
    // { use: zodGenerator },
  ],
  // One destination per sub-project, narrowed with the \`generators\` filter.
  outputs: [
    { dir: './libs/db/src/generated', generators: ['zod'] },
    { dir: './apps/web/src/generated' },
  ],
})
`;
