# Technical design — gen-typescript rejects every named enum as colliding with its own self-alias

**Status**: draft

See [`overview.md`](overview.md) for the reported crash, the goal, and the
scope decision (this bug covers both `gen-typescript` and `gen-zod`).

## Root cause, precisely

`parser-openapi` registers a named enum (top-level or synthesized-inline) in
two `SourceIR` maps at once
([`packages/parser-openapi/src/parser.ts:477-481`](../../../../packages/parser-openapi/src/parser.ts)):

```ts
enums[name] = { name, values: schema.enum.map((value) => ({ name: value })) };
aliases[name] = { name, type: { kind: 'enum', ref: name } };
```

This is not new to the 0.2.4 fix — it is unconditional for every named
string-enum `components.schemas` entry, top-level or inline. Before 0.2.4 no
inline enum ever resolved to a named `kind: 'enum'` type, so the shape was
never exercised end-to-end by `ekoz`-like documents; it was already latent.

`TypeAlias.type` is a `FieldType`
([`packages/ir/src/types.ts:35-56`](../../../../packages/ir/src/types.ts)); the
self-alias is the variant `{ kind: 'enum'; ref: string }` with `ref` equal to
the alias's own `name`. `docs/ir.md` "Closed points" §3 documents that the
IR's cross-reference pass resolves `ref`/type-alias resolution but never
forbids this specific shape — it is intentional, mirrored by
`gen-openapi`'s own comment at
[`packages/gen-openapi/src/document.ts:20-26`](../../../../packages/gen-openapi/src/document.ts):
a bare enum `$ref` in a field type resolves through the alias table, so every
named enum needs a self-alias entry for `$ref` resolution to work — the
alias is metadata for reference resolution, not a second declaration.

Two independent generators fail to treat it that way:

### `gen-typescript` — hard crash (the reported bug)

[`packages/gen-typescript/src/generator.ts:86-115`](../../../../packages/gen-typescript/src/generator.ts)
(`generatedPublicNames`) puts every `source.typeAliases` key into `aliasNames`
with no exclusion. [`validateSourceEmission`](../../../../packages/gen-typescript/src/generator.ts:117-147)
then flags any name in both `aliasNames` and `enumNames` as a collision
(line 128-136) — true for every named enum, unconditionally, since its
self-alias key is always in `aliasNames` and the enum itself is always in
`enumNames`. This throws `TypeScriptAliasPublicNameCollisionError` before a
single file is emitted, exactly as reported.

Loosening only the pre-flight check is not sufficient: even without it,
[`emit/aliases.ts`](../../../../packages/gen-typescript/src/emit/aliases.ts)
would still iterate `Object.values(source.typeAliases ?? {})` (line 9) and
emit, for the self-alias, `collectTypeDependencies` resolving `{kind:
'enum', ref: 'Status'}` to an import of `Status` from `./enums.js`
(`enumTypeName('Status') === 'Status'`,
[`names.ts:57-60`](../../../../packages/gen-typescript/src/names.ts)), then a
`export type Status = Status;` block (line 37) — importing and locally
re-declaring the same identifier `Status` in the same module is a
TypeScript duplicate-identifier error on its own, independent of the
pre-flight check. The self-alias must never reach `emitAliases`, not just
survive collision detection.

### `gen-zod` — silent broken output (found while investigating this report, not part of the original crash)

`gen-zod` has no pre-flight collision check, so `tako generate` does not
crash. But its enum and alias emitters share the same naming convention
(`enumSchemaName`/`aliasSchemaName` both format `${name}Schema`,
[`names.ts:63-75`](../../../../packages/gen-zod/src/names.ts)), so for the
self-alias `{ name: 'Status', type: { kind: 'enum', ref: 'Status' } }`:

- [`emit/enums.ts:50-65`](../../../../packages/gen-zod/src/emit/enums.ts) emits,
  in `enums.ts`: `export const Status = [...] as const;`, `export const
  StatusSchema = z.enum(Status);`, `export type Status = ...`.
- [`emit/aliases.ts`](../../../../packages/gen-zod/src/emit/aliases.ts) resolves
  the alias's `baseExpr` to `enumSchemaName('Status')` = `'StatusSchema'`
  (`render/scalars.ts:86-87`), records it as an enum dependency (line 79-81),
  and therefore emits in `aliases.ts`: `import { StatusSchema } from
  './enums.js';` **and** `export const StatusSchema = StatusSchema;` (line
  122, `aliasSchemaName('Status') === 'StatusSchema'`) — an import binding
  and a local `const` declaration sharing one identifier in the same module.
  This is a duplicate-identifier compile error in `aliases.ts` itself
  (`tsc` `TS2440`), before the barrel is even reached. (`overview.md`
  described this as an "ambiguous export at the barrel" — this design
  corrects that: the failure is inside `aliases.ts`, not at `index.ts`.)
- Independent of the above, `aliases.ts` and `enums.ts` both also export a
  type `Status`, so the sub-tree barrel
  ([`emit/barrel.ts`](../../../../packages/gen-zod/src/emit/barrel.ts):
  `export * from './enums'; export * from './aliases';`) would additionally
  be an ambiguous re-export once/if the first error were papered over.

`gen-zod`'s [`artifact.ts:100-109`](../../../../packages/gen-zod/src/artifact.ts)
compounds this: it registers `entities['<ns>.Status']` pointing at
`aliasModule`/`aliasSchemaName('Status')` for *every* type alias including
the self-alias — a phantom artifact entry claiming a symbol that (once fixed)
will no longer be emitted in `aliases.ts` at all. `generator-angular` is a
documented hard consumer of `entities[k].symbols` (file header comment,
line 4-6), so a stale entry here would misdirect a downstream import once
`aliases.ts` stops emitting `Status`. Enums are consumed by
`generator-angular` through `ZodArtifactExtra.perNamespace[ns].enums`
instead (populated correctly at
[`artifact.ts:113-`](../../../../packages/gen-zod/src/artifact.ts) from
`collectEnums`, unaffected by this bug) — so dropping the phantom
`entities['<ns>.Status']` entry has no consumer relying on it existing.

## Fix shape

### Shared `@kurotako/ir` helper

Add to [`packages/ir/src/helpers.ts`](../../../../packages/ir/src/helpers.ts)
(exported through the package's single barrel,
[`packages/ir/src/index.ts:7`](../../../../packages/ir/src/index.ts),
`export * from './helpers.js'` — no separate export line needed):

```ts
/**
 * `source.typeAliases` with the synthetic self-referencing entries removed.
 * A named enum is registered by parsers as both an `EnumDef` and a
 * self-referencing `typeAlias` of the same name (`{ kind: 'enum', ref:
 * <own name> }`), so a bare enum `$ref` in a field type resolves through
 * the alias table. That entry is reference-resolution metadata, not a
 * second declaration: generators must not treat it as colliding with the
 * enum, nor re-emit it as its own alias.
 *
 * The shape check (not a name-only check) matters: a *different* alias
 * that happens to share a name with an unrelated enum is a genuine
 * collision and must not be filtered out here.
 */
export function nonRedundantTypeAliases(source: SourceIR): TypeAlias[] {
  return Object.values(source.typeAliases ?? {}).filter(
    (alias) => !(alias.type.kind === 'enum' && alias.type.ref === alias.name),
  );
}
```

The predicate is **shape-based** (`type.kind === 'enum' && type.ref ===
name`), not name-based like `gen-openapi`'s current inline filter
(`!enumsByName.has(name) && ...`,
[`document.ts:79-81`](../../../../packages/gen-openapi/src/document.ts)).
This is a deliberate difference from the option previewed during discussion,
found while grounding the design in the existing test suite:
`gen-typescript/src/generator.test.ts:216-223` builds a source with
`.addEnum('Status', ...)` **and** a separately hand-written
`.addTypeAlias('Status', (alias) => alias.scalar('string'))` — a genuine
collision (same name, unrelated `string`-scalar alias, not the enum's own
self-alias) — and asserts it still throws
`TypeScriptAliasPublicNameCollisionError`. A name-only filter would silently
drop that alias instead of rejecting it, breaking this existing guarantee.
The shape check keeps the enum's own self-alias (and only that) excluded,
while any alias that merely shares a name is still caught as a collision by
the two consumer generators below.

`gen-openapi` does not have (and does not need) an equivalent collision
error — its comment already documents that the IR guarantees this specific
shape is the only way an alias and an enum name can coincide (`docs/ir.md`
"Closed points" §3) — but it is switched to the shared, more precise
predicate anyway, so there is exactly one place this invariant is encoded
instead of three.

### `gen-openapi` — migrate to the shared helper

[`document.ts:76-82`](../../../../packages/gen-openapi/src/document.ts):
replace the inline `.filter((name) => !enumsByName.has(name) &&
source.entities[name] === undefined)` with
`nonRedundantTypeAliases(source).map((a) => a.name).filter((name) =>
source.entities[name] === undefined)` (the entity-name exclusion is
unrelated to this bug — kept as-is, defensive against a name a parser has
never actually produced per `parser-openapi/src/parser.ts:353`'s
construction-time uniqueness check — not touched here).

### `gen-typescript` — stop treating the self-alias as a second declaration

- [`generator.ts:113`](../../../../packages/gen-typescript/src/generator.ts)
  (`generatedPublicNames`): `aliasNames` becomes
  `new Set(nonRedundantTypeAliases(source).map((a) => a.name))`.
- [`generator.ts:169`](../../../../packages/gen-typescript/src/generator.ts)
  and [`generator.ts:186`](../../../../packages/gen-typescript/src/generator.ts)
  (whether `aliases.ts` is emitted at all, and the `emitsAliases` flag
  passed to `emitBarrel`): both switch from
  `Object.keys(source.typeAliases ?? {}).length > 0` to
  `nonRedundantTypeAliases(source).length > 0`, so a namespace whose only
  "alias" is an enum self-alias emits no empty `aliases.ts` file and no
  dangling barrel re-export.
- [`emit/aliases.ts:9`](../../../../packages/gen-typescript/src/emit/aliases.ts):
  `const aliases = nonRedundantTypeAliases(source);` instead of
  `Object.values(source.typeAliases ?? {})` — the self-alias is never
  iterated, so it is never emitted as `export type Status = Status;`.
- [`emit/barrel.ts:9`](../../../../packages/gen-typescript/src/emit/barrel.ts):
  the default-parameter fallback for `emitsAliases` gets the same
  `nonRedundantTypeAliases` treatment, for callers that omit the third
  argument.
- `cyclicAliasNames` ([`generator.ts:48-83`](../../../../packages/gen-typescript/src/generator.ts))
  is left untouched: it only follows `{ kind: 'ref' }` edges
  (`collectTypeDependencies`/`refCycleMembers` in
  [`packages/ir/src/helpers.ts:68-`](../../../../packages/ir/src/helpers.ts)
  never treats `{ kind: 'enum' }` as a cycle edge), so a self-alias can
  never appear in `ctx.cycles` and this function's behavior is unaffected
  either way — verified by reading `refCycleMembers`, not changed.

### `gen-zod` — stop emitting a colliding self-alias

- [`generator.ts`](../../../../packages/gen-zod/src/generator.ts) (the local
  `aliases` variable, `~line 31`, and the `aliases.length > 0` gate for
  whether `aliases.ts` is emitted): switch to `nonRedundantTypeAliases(source)`.
- [`emit/aliases.ts:73`](../../../../packages/gen-zod/src/emit/aliases.ts):
  `const declared = nonRedundantTypeAliases(source);` instead of
  `Object.values(source.typeAliases ?? {})`.
- [`emit/barrel.ts:16`](../../../../packages/gen-zod/src/emit/barrel.ts):
  the `Object.keys(source.typeAliases ?? {}).length > 0` gate for the
  `export * from './aliases'` barrel line switches to
  `nonRedundantTypeAliases(source).length > 0`.
- [`artifact.ts:101`](../../../../packages/gen-zod/src/artifact.ts): the alias
  loop building `entities['<ns>.<name>']` switches to iterating
  `nonRedundantTypeAliases(source)` instead of
  `Object.values(source.typeAliases ?? {})`, removing the phantom entry for
  an enum's self-alias (enums keep being correctly represented through
  `ZodArtifactExtra.perNamespace[ns].enums`, populated separately and
  already unaffected by this bug).

`gen-zod` gets no new pre-flight error class: it has never validated
alias/enum name collisions (unlike `gen-typescript`), and this bug does not
introduce that check — a genuine name collision between a hand-written alias
and an unrelated enum will, after this fix, still produce colliding
`<Name>Schema`/`<Name>` exports in `gen-zod`'s output exactly as it would
have before parser-openapi 0.2.4 (pre-existing, out of scope for this bug:
nothing regresses, nothing new is introduced).

## Consequences verified

- No fixture or example in the repo currently exercises a named enum
  through `gen-typescript` or `gen-zod` end-to-end
  (`examples/*/openapi.json` have no top-level string-enum component; per
  `overview.md`'s investigation) — so this fix changes behavior with no
  existing example output to update.
- `gen-typescript/src/generator.test.ts:216-223` (genuine alias/enum name
  collision) keeps passing unchanged — verified above by construction of
  the shape-based predicate.
- `gen-openapi`'s existing behavior for real documents is unchanged: the
  migrated filter produces the same schema name list as before for every
  case its current inline filter already handles (the self-alias case was
  already excluded there; only the exclusion mechanism moves).

## Tests

- `packages/gen-typescript/src/generator.test.ts`: add a regression case —
  a source with `.addEnum('Status', ...)` and no hand-written alias of that
  name (i.e. the parser-produced self-alias shape, built directly through
  the same `{ kind: 'enum', ref: 'Status' }` self-alias `typeAliases` entry
  the builder/IR allow) generates successfully, `aliases.ts` is not emitted
  for a namespace whose only alias is that self-alias, and the enum itself
  still emits normally in `enums.ts`.
- `packages/gen-typescript/src/generator.test.ts:216-223` (existing genuine
  collision test): kept as-is, re-run to confirm it still throws.
- `packages/gen-zod/src/generator.test.ts` and/or
  `packages/gen-zod/src/emit/aliases.test.ts` /
  `aliases.compile.test.ts`: add the equivalent regression — a source with
  a named enum and its self-alias compiles (the `aliases.compile.test.ts`
  pattern already type-checks emitted output, per its name) with no
  duplicate-identifier error, `aliases.ts` is not emitted when the self-alias
  is the only alias, and `enums.ts` is unaffected.
- `packages/gen-zod/src/artifact.test.ts` (or equivalent): add a case
  asserting no `entities['<ns>.<enumName>']` entry is created for an enum's
  self-alias.
- `packages/ir/src/helpers.test.ts`: unit-test `nonRedundantTypeAliases`
  directly — excludes the shape-based self-alias, keeps a same-named
  alias whose `type` is not `{ kind: 'enum', ref: <own name> }`.
- `packages/gen-openapi/src/document.test.ts`: re-run after the migration to
  the shared helper to confirm no schema-name-list regression.

## Découpage en tâches d'implémentation

1. [#186](https://github.com/marmotz/kurotako/issues/186) — `@kurotako/ir`:
   add the shared `nonRedundantTypeAliases` helper.
2. [#187](https://github.com/marmotz/kurotako/issues/187) — `@kurotako/gen-openapi`:
   migrate its inline self-alias exclusion to the shared helper.
   Depends on #186.
3. [#188](https://github.com/marmotz/kurotako/issues/188) — `@kurotako/gen-typescript`:
   stop rejecting a named enum's own self-alias as a collision.
   Depends on #186.
4. [#189](https://github.com/marmotz/kurotako/issues/189) — `@kurotako/gen-zod`:
   stop emitting a colliding export and a phantom artifact entry for an
   enum self-alias. Depends on #186.
