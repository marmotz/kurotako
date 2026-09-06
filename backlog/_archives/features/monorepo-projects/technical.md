# Technical design — Running `tako` in a consumer monorepo

Design for the decisions in [`overview.md`](./overview.md). Scope is narrow: a
**per-source anchor directory** so a parser resolves its own schema-toolchain
dependency (`@prisma/internals`) from where the source's schema lives, plus a
monorepo-aware `tako init`.

Cross-cutting references: [`docs/architecture.md`](../../../../docs/architecture.md)
(parsers / `ParseContext`), [`backlog/_archives/features/core-pipeline/technical.md`](../core-pipeline/technical.md),
[`backlog/_archives/features/parser-prisma/technical.md`](../parser-prisma/technical.md),
[`backlog/_archives/features/cli/technical.md`](../cli/technical.md).

## 1. Current behavior

### 1.1 Everything anchors on `rootDir`

- [`config/src/load.ts:60`](../../../../packages/config/src/load.ts) —
  `rootDir = resolve(configFile, '..')`.
- [`core/src/run.ts:53-57`](../../../../packages/core/src/run.ts) — the only
  `ParseContext` built for `parse()` is `{ namespace, cwd: config.rootDir, logger }`.
- [`core/src/types.ts:91-95`](../../../../packages/core/src/types.ts) — `ParseContext`
  is exactly `{ namespace; cwd; logger }`.
- [`parser-prisma/src/parser.ts:27`](../../../../packages/parser-prisma/src/parser.ts) —
  `resolveInput(ctx.cwd, options, ctx.namespace)`, and
  [`detect.ts:126`](../../../../packages/parser-prisma/src/detect.ts) —
  `resolve(cwd, o.schema)`. So `options.schema` is `rootDir`-relative.
- [`parser-prisma/src/dmmf/load.ts:36`](../../../../packages/parser-prisma/src/dmmf/load.ts) —
  `createRequire(join(ctx.cwd, 'noop.js'))` then `require.resolve('@prisma/internals')`
  and `require.resolve('@prisma/internals/package.json')` (line 60). Both resolve from
  `rootDir`, i.e. the `tako.config.ts` directory.

### 1.2 Consequence for a consumer monorepo

`tako.config.ts` at repo root, schema at `libs/db/prisma/schema.prisma`,
`@prisma/internals` installed in `libs/db`: `require.resolve` walks up from
`<root>/node_modules`, never sees `libs/db/node_modules`, throws
`PrismaPeerMissingError` ([`errors.ts:25`](../../../../packages/parser-prisma/src/errors.ts)).
The only fix today is hoisting `@prisma/internals` to the repo root — exactly what the
`examples/nestjs11-prisma7-angular22-outputdir` example does
([its `package.json`](../../../../examples/nestjs11-prisma7-angular22-outputdir/package.json)
lists `@prisma/internals` as a root devDependency).

### 1.3 `defineParser` currying

[`config/src/define-driver.ts:19-36`](../../../../packages/config/src/define-driver.ts)
and [`config/src/types.ts:26-33`](../../../../packages/config/src/types.ts): a driver
declares `parse(ctx, options)` / `watchPaths(ctx, options)`;
[`load.ts:156-163`](../../../../packages/config/src/load.ts) curries `options` away so
`@kurotako/core` sees a plain `Parser` with `parse(ctx)` / `watchPaths(ctx)`.

## 2. Design

### 2.1 `ParseContext.anchorDir` (core)

Add one **optional** field to `ParseContext`
([`core/src/types.ts:91`](../../../../packages/core/src/types.ts)):

```ts
export interface ParseContext {
  namespace: string;
  /** Absolute; the config-file directory. Base for `options.schema` and output paths. */
  cwd: string;
  /**
   * Absolute; the directory this source is anchored at — where its schema lives.
   * A parser resolves the source's own toolchain dependencies (`@prisma/internals`
   * and equivalents) from here, letting Node walk up `node_modules` to `cwd` and
   * beyond. Absent (⇒ treat as `cwd`) when the parser declares no `anchor` hook.
   */
  anchorDir?: string;
  logger: Logger;
}
```

Optional, not required: `watch.ts` builds a `ParseContext` for `watchPaths`
([`cli/src/watch.ts:109-113`](../../../../packages/cli/src/watch.ts)) and `watchPaths`
has no use for it; keeping it optional avoids touching that call site and the shared
test `ctx()` helpers ([`parser-prisma/src/parser.test.ts:68`](../../../../packages/parser-prisma/src/parser.test.ts),
[`dmmf/load.test.ts:14`](../../../../packages/parser-prisma/src/dmmf/load.test.ts)).

### 2.2 `Parser.anchor` hook (core + config)

`@kurotako/core` `Parser` ([`core/src/types.ts:81-89`](../../../../packages/core/src/types.ts))
gains an optional, already-curried hook:

```ts
export interface Parser {
  name: string;
  parse(ctx: ParseContext): Promise<SourceIR> | SourceIR;
  watchPaths?(ctx: ParseContext): string[] | Promise<string[]>;
  /**
   * The directory this source is anchored at, for toolchain-dependency
   * resolution. `run()` calls it before `parse()` and passes the result as
   * `ParseContext.anchorDir`. Return `undefined` (or omit the hook) to anchor on
   * `rootDir`. Never throws for a "not found" case — a bad path is the parser's
   * problem to surface during `parse()`.
   */
  anchor?(rootDir: string): string | undefined | Promise<string | undefined>;
}
```

`rootDir` is passed in (rather than captured) to mirror how `run()` already feeds
config data to drivers, and because the curried wrapper is the natural place to bind
`options`. Driver-facing declaration in `@kurotako/config`
([`types.ts:26`](../../../../packages/config/src/types.ts) `TakoParser`,
[`define-driver.ts:19`](../../../../packages/config/src/define-driver.ts) `defineParser`):

```ts
anchor?(rootDir: string, options: O): string | undefined | Promise<string | undefined>;
```

### 2.3 Currying in `config/load.ts`

In the source loop ([`load.ts:156-163`](../../../../packages/config/src/load.ts)),
alongside the existing `watchPaths` binding:

```ts
if (use.anchor) {
  const anchor = use.anchor.bind(use);
  parser.anchor = (rootDir) => anchor(rootDir, parsedOptions);
}
```

### 2.4 `run()` wiring (core)

In the parse loop ([`run.ts:46-67`](../../../../packages/core/src/run.ts)), before
`parser.parse(ctx)`:

```ts
const anchorDir = (await source.parser.anchor?.(config.rootDir)) ?? config.rootDir;
const ctx = {
  namespace,
  cwd: config.rootDir,
  anchorDir,
  logger: childLogger(logger, { namespace }),
};
```

A throw from `anchor()` is caught by the existing `try/catch` and wrapped as a
`DriverError` like any parse failure — acceptable, and the hook contract says not to
throw for the ordinary case.

### 2.5 parser-prisma

**`anchor` implementation** — add to `prismaParser`
([`parser-prisma/src/parser.ts:22`](../../../../packages/parser-prisma/src/parser.ts)):

```ts
anchor(rootDir, options) {
  // The directory the schema lives in. `dirname` is correct for a `.prisma`
  // file and for a `contract.json`; for a schema *folder* it yields the parent,
  // which is still a valid walk-up base for `node_modules` resolution.
  return dirname(resolve(rootDir, options.schema));
},
```

No `stat` — the hook must stay cheap and the parent-of-folder case still resolves
`@prisma/internals` correctly (Node walks up every ancestor `node_modules`).

**Resolution base** — `resolveInternals`
([`dmmf/load.ts:33-36`](../../../../packages/parser-prisma/src/dmmf/load.ts)):

```ts
const base = ctx.anchorDir ?? ctx.cwd;
const require = createRequire(join(base, 'noop.js'));
```

This covers both `require.resolve('@prisma/internals')` (line 40) and
`require.resolve('@prisma/internals/package.json')` (line 60), since they share the
one `require`.

**`options.schema` / `resolveInput` — unchanged.** `parser.ts:27` keeps passing
`ctx.cwd`; `detect.ts` keeps `resolve(cwd, o.schema)`. Per the overview decision the
schema path stays config-file-relative, so existing configs are byte-for-byte
unaffected.

**`watchPaths` — unchanged.** `resolve(ctx.cwd, options.schema)`
([`parser.ts:49`](../../../../packages/parser-prisma/src/parser.ts)) still points at the
right file.

**`PrismaPeerMissingError` message** — extend the hint to mention that installing
`@prisma/internals` next to the schema (in the sub-project) now works, not only at the
repo root ([`errors.ts:25-39`](../../../../packages/parser-prisma/src/errors.ts)).

### 2.6 `tako init --monorepo` (cli + config)

**Detection** — in `initCommand`
([`cli/src/commands/init.ts:28`](../../../../packages/cli/src/commands/init.ts)):

1. New boolean arg `monorepo` (citty, `default: undefined`). `--monorepo` forces on,
   `--no-monorepo` forces off.
2. When undefined, auto-detect: walk up from `cwd` for the first `package.json`; it is
   a monorepo when it has a `workspaces` key (array, or `{ packages: [...] }`). Also
   treat a sibling `pnpm-workspace.yaml` as a positive.
3. The chosen template is written; `reporter.info` states which mode was used.

**Template** — `@kurotako/config` exports a second constant
`CONFIG_TEMPLATE_MONOREPO` next to `CONFIG_TEMPLATE`
([`config/src/template.ts`](../../../../packages/config/src/template.ts)). It differs by:

- `sources` example pointing at a sub-project path
  (`options: { schema: './libs/db/prisma/schema.prisma' }`);
- `outputs` example with two entries targeting different sub-projects, referencing the
  `outputs[]` + `generators` filter already in place;
- a comment block explaining that `@prisma/internals` may be installed in the
  sub-project holding the schema (not necessarily the repo root), and that
  `options.schema` stays relative to this config file.

`init.test.ts` / `init.test-d.ts` extended for the flag and both auto-detect branches
(fixture dirs with / without `workspaces`).

## 3. Alternatives considered

| Option | Rejected because |
| --- | --- |
| Resolve `@prisma/internals` by walking up from the schema dir **inside parser-prisma only**, no core change | Every future toolchain-resolving parser (drizzle, typebox, …) re-implements the same walk-up and the same `rootDir`-vs-schema-dir reasoning. Overview decision: core concern. |
| New explicit `sources: { db: { cwd: './libs/db' } }` field, resolved by config-system | Manual, has to be repeated per source, and does not cover the common case out of the box. Kept only as a possible future override; not in this design. |
| Parser option `internalsFrom: './libs/db'` | Prisma-specific, verbose, leaks a dependency-management concern into user config. |
| Make `ParseContext.cwd` itself become the schema dir per source | Breaks `options.schema` resolution and output-path anchoring, which are legitimately config-file-relative; forces a compat migration for every existing config. |
| `anchor(ctx)` receiving a `ParseContext` | Chicken-and-egg: the context's `anchorDir` is what we are computing. A plain `(rootDir)` argument is honest about what is available. |
| Required `ParseContext.anchorDir` | Forces edits to `watch.ts` and every test `ctx()` helper for a field only the DMMF path reads; optional with a documented `?? cwd` fallback is equivalent and smaller. |

## 4. Consequences

- **Backward compatible.** Single-project layouts: `anchor` returns
  `dirname(<rootDir>/prisma/schema.prisma)` = `<rootDir>/prisma`; `@prisma/internals`
  at the repo root still resolves via walk-up. No config change, no output change.
- **New public API surface** (changesets required):
  - `@kurotako/core` — `ParseContext.anchorDir`, `Parser.anchor` (minor).
  - `@kurotako/config` — `TakoParser.anchor`, `defineParser` accepts `anchor`,
    `CONFIG_TEMPLATE_MONOREPO` export (minor).
  - `@kurotako/parser-prisma` — resolves `@prisma/internals` from the schema
    directory; `anchor` hook (minor / notable fix).
  - `@kurotako/cli` — `tako init --monorepo` and auto-detection (minor).
- **Docs.** A "Using tako in a monorepo" page under `apps/docs` (where to install
  `@prisma/internals`, that `options.schema` is config-relative, per-sub-project
  `outputs[]`). Not a code task but tracked with the feature.
- **`examples/`.** The `-outputdir` example can move `@prisma/internals` from the root
  `package.json` into `apps/backend/package.json` to demonstrate the new behavior;
  optional, decide at task time.
- **Not addressed here** (already noted in the overview as out of scope): `run()`
  rewrapping `TakoError` into `DriverError` — belongs to core-pipeline.

## 5. Découpage en tâches d'implémentation

- [`89-core-parse-context-anchor-dir`](../../tasks/89-core-parse-context-anchor-dir.md)
  — core: `ParseContext.anchorDir`, `Parser.anchor` hook, `run()` wiring (§2.1, §2.2, §2.4).
- [`90-cli-tako-init-monorepo`](../../tasks/90-cli-tako-init-monorepo.md)
  — `tako init --monorepo`, auto-detection, `CONFIG_TEMPLATE_MONOREPO` (§2.6). No dep.
- [`91-config-parser-anchor-currying`](../../tasks/91-config-parser-anchor-currying.md)
  — `@kurotako/config`: `TakoParser.anchor`, `defineParser`, currying in `load.ts`
  (§2.2, §2.3). Depends on #89.
- [`92-parser-prisma-anchor-internals-resolution`](../../tasks/92-parser-prisma-anchor-internals-resolution.md)
  — parser-prisma: `anchor` impl + resolve `@prisma/internals` from `anchorDir` +
  error message (§2.5). Depends on #89, #91.
- [`93-docs-monorepo-usage-and-example`](../../tasks/93-docs-monorepo-usage-and-example.md)
  — docs page + move `@prisma/internals` into the example sub-project (§4). Depends on
  #92, #90.
