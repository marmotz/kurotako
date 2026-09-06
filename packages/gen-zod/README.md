# @kurotako/gen-zod

The Zod generator for [kurotako](https://kurotako.marmotz.dev/): emits Zod schemas from
kurotako's intermediate representation.

## Install

```bash
npm install -D @kurotako/gen-zod
# bun add -d @kurotako/gen-zod
```

Needs **Node.js >= 24**; runs unmodified on Node and Bun.

## Usage

```ts title="tako.config.ts"
import { defineConfig } from 'kurotako';
import { zodGenerator } from '@kurotako/gen-zod';

export default defineConfig({
  sources: {/* ... */},
  generators: [{ use: zodGenerator }],
  outputs: [{ dir: './generated/kurotako' }],
});
```

## Documentation

Catalog and guides: <https://kurotako.marmotz.dev/>.

`0.x`: the public API may change between minor versions.

## License

[MIT](https://github.com/marmotz/kurotako/blob/develop/LICENSE)
