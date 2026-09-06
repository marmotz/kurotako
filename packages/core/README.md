# @kurotako/core

The pipeline core for [kurotako](https://kurotako.marmotz.dev/): the parser/generator
contracts, the generator dependency DAG and its topological ordering, and the `run()`
entry the CLI drives.

You only depend on this package directly for programmatic use. Normal `tako` usage pulls
it in transitively.

## Install

```bash
npm install @kurotako/core
# bun add @kurotako/core
```

Needs **Node.js >= 24**; runs unmodified on Node and Bun.

## Documentation

Concepts and API reference: <https://kurotako.marmotz.dev/docs/concepts/parsers-and-generators>.

`0.x`: the public API may change between minor versions.

## License

[MIT](https://github.com/marmotz/kurotako/blob/develop/LICENSE)
