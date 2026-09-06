# kurotako

One install for the [`tako`](https://kurotako.marmotz.dev/docs/reference/cli) CLI and the
`defineConfig` helper your `tako.config.ts` imports.

kurotako is a modular framework for synchronizing TypeScript schemas from the data model
down to frontend forms, through a validation layer: one `parser` input, N `generator`
outputs, wired by a dependency graph.

## Install

```bash
npm install -D kurotako
# bun add -d kurotako
```

`tako` needs **Node.js >= 24** and runs unmodified on Node and Bun.

## Quickstart

```bash
npm install -D @kurotako/parser-prisma @kurotako/gen-zod @kurotako/gen-angular
npx tako init          # writes a commented tako.config.ts
npx tako generate
```

```ts title="tako.config.ts"
import { defineConfig } from 'kurotako';
import { prismaParser } from '@kurotako/parser-prisma';
import { zodGenerator } from '@kurotako/gen-zod';
import { angularGenerator } from '@kurotako/gen-angular';

export default defineConfig({
  sources: {
    db: { use: prismaParser, options: { schema: './prisma/schema.prisma' } },
  },
  generators: [{ use: zodGenerator }, { use: angularGenerator }],
  outputs: [{ dir: './generated/kurotako' }],
});
```

`kurotako` is an umbrella over `@kurotako/cli` (the binary) and `@kurotako/config`
(`defineConfig`); pick a parser and the generators you need on top.

## Documentation

Full guide, CLI and config reference: <https://kurotako.marmotz.dev/>.

`0.x`: the public API may change between minor versions.

## License

[MIT](https://github.com/marmotz/kurotako/blob/develop/LICENSE)
