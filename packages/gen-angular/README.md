# @kurotako/gen-angular

The Angular generator for [kurotako](https://kurotako.marmotz.dev/): emits Angular types
and typed `FormGroup`s from kurotako's intermediate representation.

Embeds `@kurotako/gen-zod` as a private dependency: `core` runs its own copy of the Zod
generator for it, into `<namespace>/angular/zod/`, so you do not list `zodGenerator` in
`generators`. Set the Zod flavor with the `zodVersion` option (default `4`).

## Install

```bash
npm install -D @kurotako/gen-angular
# bun add -d @kurotako/gen-angular
```

Needs **Node.js >= 24**; runs unmodified on Node and Bun.

## Usage

```ts title="tako.config.ts"
import { defineConfig } from 'kurotako';
import { angularGenerator } from '@kurotako/gen-angular';

export default defineConfig({
  sources: {/* ... */},
  generators: [{ use: angularGenerator }],
  outputs: [{ dir: './generated/kurotako' }],
});
```

## Documentation

Catalog and guides: [https://kurotako.marmotz.dev/](https://kurotako.marmotz.dev/).

`0.x`: the public API may change between minor versions.

## License

[MIT](https://github.com/marmotz/kurotako/blob/develop/LICENSE)
