# @kurotako/ir

The intermediate representation for [kurotako](https://kurotako.marmotz.dev/): the schema
model that parsers produce and generators consume, keyed by `(namespace, entity)`, with
Valibot schemas for validation.

You only depend on this package directly for programmatic use (writing a parser or a
generator). Normal `tako` usage never imports it.

## Install

```bash
npm install @kurotako/ir
# bun add @kurotako/ir
```

Needs **Node.js >= 24**; runs unmodified on Node and Bun.

## Documentation

Concepts and API reference: <https://kurotako.marmotz.dev/docs/concepts/intermediate-representation>.

`0.x`: the public API may change between minor versions.

## License

[MIT](https://github.com/marmotz/kurotako/blob/develop/LICENSE)
