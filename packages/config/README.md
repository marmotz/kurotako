# @kurotako/config

Config loading and validation for [kurotako](https://kurotako.marmotz.dev/): resolves and
loads `tako.config.ts`, validates it with Valibot, and exposes the `defineConfig`,
`defineParser` and `defineGenerator` helpers.

Most projects get `defineConfig` through the [`kurotako`](https://www.npmjs.com/package/kurotako)
package. Install `@kurotako/config` directly only for the loader internals (`loadConfig`,
`TakoConfigSchema`, the error classes).

## Install

```bash
npm install @kurotako/config
# bun add @kurotako/config
```

Needs **Node.js >= 24**; runs unmodified on Node and Bun.

## Documentation

`tako.config.ts` reference: <https://kurotako.marmotz.dev/docs/reference/tako-config>.

`0.x`: the public API may change between minor versions.

## License

[MIT](https://github.com/marmotz/kurotako/blob/develop/LICENSE)
