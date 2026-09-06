# @kurotako/gen-angular

The Angular generator for [kurotako](https://kurotako.marmotz.dev/): emits Angular types
and typed `FormGroup`s from kurotako's intermediate representation.

Depends on `@kurotako/gen-zod`: it declares `dependsOn: ['zod']`, so `core` always runs
the Zod generator first. List both in `generators`.

## Install

```bash
npm install -D @kurotako/gen-angular @kurotako/gen-zod
# bun add -d @kurotako/gen-angular @kurotako/gen-zod
```

Needs **Node.js >= 24**; runs unmodified on Node and Bun.

## Usage

```ts title="tako.config.ts"
import { defineConfig } from 'kurotako';
import { zodGenerator } from '@kurotako/gen-zod';
import { angularGenerator } from '@kurotako/gen-angular';

export default defineConfig({
  sources: {/* ... */},
  generators: [{ use: zodGenerator }, { use: angularGenerator }],
  outputs: [{ dir: './generated/kurotako' }],
});
```

## Documentation

Catalog and guides: <https://kurotako.marmotz.dev/>.

`0.x`: the public API may change between minor versions.

## License

[MIT](https://github.com/marmotz/kurotako/blob/develop/LICENSE)
