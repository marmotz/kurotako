# @kurotako/cli

The `tako` command-line interface for [kurotako](https://kurotako.marmotz.dev/), plus the
programmatic entry point (`runCli`, reporters, error helpers) for embedding the CLI in a
script.

Most projects install [`kurotako`](https://www.npmjs.com/package/kurotako) instead — it
ships this same binary together with `defineConfig`. Install `@kurotako/cli` directly
only for the programmatic API.

## Install

```bash
npm install -D @kurotako/cli
# bun add -d @kurotako/cli
```

Needs **Node.js >= 24**; runs unmodified on Node and Bun.

## Usage

```text
tako init      [--config <path>] [--force] [--monorepo | --no-monorepo]
tako generate  [--config <path>] [--watch] [--dry-run]
tako validate  [--config <path>]
tako check     [--config <path>]
tako --version
```

```ts
import { runCli } from '@kurotako/cli';

await runCli(['generate', '--dry-run']);
```

## Documentation

CLI reference: <https://kurotako.marmotz.dev/docs/reference/cli>.

`0.x`: the public API may change between minor versions.

## License

[MIT](https://github.com/marmotz/kurotako/blob/develop/LICENSE)
