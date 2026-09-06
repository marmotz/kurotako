# @kurotako/parser-prisma

The Prisma parser for [kurotako](https://kurotako.marmotz.dev/): turns a
`schema.prisma` into kurotako's intermediate representation, under the namespace you give
its `sources` entry.

## Install

```bash
npm install -D @kurotako/parser-prisma
# bun add -d @kurotako/parser-prisma
```

Needs **Node.js >= 24**; runs unmodified on Node and Bun. In a monorepo, install
`@prisma/internals` in the sub-project that owns the schema.

## Usage

```ts title="tako.config.ts"
import { defineConfig } from 'kurotako';
import { prismaParser } from '@kurotako/parser-prisma';

export default defineConfig({
  sources: {
    db: { use: prismaParser, options: { schema: './prisma/schema.prisma' } },
  },
  generators: [/* ... */],
  outputs: [{ dir: './generated/kurotako' }],
});
```

## Documentation

Catalog and guides: [https://kurotako.marmotz.dev/](https://kurotako.marmotz.dev/).

`0.x`: the public API may change between minor versions.

## License

[MIT](https://github.com/marmotz/kurotako/blob/develop/LICENSE)
