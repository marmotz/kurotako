# @kurotako/parser-openapi

The OpenAPI parser for [kurotako](https://kurotako.marmotz.dev/): turns an
OpenAPI 3.0 or 3.1 document into kurotako's intermediate representation, under the
namespace you give its `sources` entry.

## Install

```bash
npm install -D @kurotako/parser-openapi
# bun add -d @kurotako/parser-openapi
```

Needs **Node.js >= 24**; runs unmodified on Node and Bun.

## Usage

```ts title="tako.config.ts"
import { defineConfig } from 'kurotako';
import { openapiParser } from '@kurotako/parser-openapi';

export default defineConfig({
  sources: {
    api: { use: openapiParser, options: { document: './openapi.yaml' } },
  },
  generators: [/* ... */],
  outputs: [{ dir: './generated/kurotako' }],
});
```

`document` is required: a local JSON or YAML path (resolved against the config
directory) or an unauthenticated `http:`/`https:` URL. References are resolved but
never dereferenced; unsupported schemes, credential-bearing URLs, unresolved
references, name collisions, and unsupported JSON Schema keywords fail with one of
the exported `OpenApi*Error` classes.

## Documentation

Catalog and guides: [https://kurotako.marmotz.dev/](https://kurotako.marmotz.dev/).

`0.x`: the public API may change between minor versions.

## License

[MIT](https://github.com/marmotz/kurotako/blob/develop/LICENSE)
