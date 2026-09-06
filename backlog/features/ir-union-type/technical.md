# IR union type — technical design

Turns the [overview.md](overview.md) decisions into a concrete change surface across
`@kurotako/ir`, `@kurotako/gen-zod` and `@kurotako/gen-angular`. Product scope is settled
in the overview; this document does not reopen it.

## Starting point (current code)

- `@kurotako/ir` is implemented. Format source of truth:
  [`packages/ir/src/schemas.ts`](../../../packages/ir/src/schemas.ts). `FieldTypeSchema`
  ([`schemas.ts:82`](../../../packages/ir/src/schemas.ts)) is a
  `v.variant('kind', [...])` over `scalar` / `enum` / `unknown`. `SourceIrSchema`
  ([`schemas.ts:181`](../../../packages/ir/src/schemas.ts)) has `entities` and `enums`
  records, no alias registry.
- Types are all inferred: [`packages/ir/src/types.ts`](../../../packages/ir/src/types.ts)
  is `v.InferOutput<typeof …Schema>`, no hand-written interface.
- `IR_VERSION = '1'`, `isCompatible` is strict equality
  ([`packages/ir/src/version.ts`](../../../packages/ir/src/version.ts)).
- Validation: [`packages/ir/src/validate.ts`](../../../packages/ir/src/validate.ts) —
  `v.safeParse` then `checkSource(...)` cross-reference pass; `IrIssueCode` union at
  [`validate.ts:18`](../../../packages/ir/src/validate.ts). The enum-ref check is
  [`validate.ts:180`](../../../packages/ir/src/validate.ts).
- Builder: [`packages/ir/src/builder.ts`](../../../packages/ir/src/builder.ts) —
  `FieldBuilderImpl` at [`builder.ts:132`](../../../packages/ir/src/builder.ts),
  `EntityBuilderImpl` at [`builder.ts:327`](../../../packages/ir/src/builder.ts),
  `SourceIrBuilderImpl.build()` at
  [`builder.ts:484`](../../../packages/ir/src/builder.ts).
- Helpers: [`packages/ir/src/helpers.ts`](../../../packages/ir/src/helpers.ts) —
  `resolveEnum` at [`helpers.ts:30`](../../../packages/ir/src/helpers.ts), `scalarTsType`
  at [`helpers.ts:157`](../../../packages/ir/src/helpers.ts) (`switch` over the three
  current kinds, non-exhaustive-safe today).
- `gen-zod` type → expression: `baseExpr` / `scalarExpr` / `baseClass` in
  [`packages/gen-zod/src/render/scalars.ts`](../../../packages/gen-zod/src/render/scalars.ts);
  field assembly `fieldExpr` in
  [`packages/gen-zod/src/render/field.ts`](../../../packages/gen-zod/src/render/field.ts);
  artifact symbol matrix in
  [`packages/gen-zod/src/artifact.ts`](../../../packages/gen-zod/src/artifact.ts) (keyed
  `${namespace}.${entity}`).
- `gen-angular` control typing: `baseType` / `controlType` / `zeroValue` in
  [`packages/gen-angular/src/render/controls.ts`](../../../packages/gen-angular/src/render/controls.ts).
- `parser-prisma` builds through `createSourceIR`
  ([`packages/parser-prisma/src/map/build.ts:103`](../../../packages/parser-prisma/src/map/build.ts))
  — it never touches alias/union, so it is source-compatible if the new `SourceIR` key is
  optional.
- Root barrel ambiguity check reads `artifact.entities[key].symbols`
  ([`packages/core/src/writer/barrel.ts:63`](../../../packages/core/src/writer/barrel.ts)).

## 1. Schema changes — `packages/ir/src/schemas.ts`

### 1.1 `FieldTypeSchema` gains two variants

```ts
export const FieldTypeSchema: v.GenericSchema<FieldType> = v.lazy(() =>
  v.variant('kind', [
    v.object({ kind: v.literal('scalar'), scalar: ScalarTypeSchema }),
    v.object({ kind: v.literal('enum'), ref: v.string() }),
    v.object({ kind: v.literal('unknown'), hint: v.optional(v.string()) }),
    v.object({ kind: v.literal('ref'), ref: v.string() }),
    v.object({
      kind: v.literal('union'),
      variants: v.array(FieldTypeSchema),
      discriminator: v.optional(
        v.object({
          propertyName: v.string(),
          mapping: v.optional(v.record(v.string(), v.string())),
        }),
      ),
    }),
  ]),
);
```

- `FieldTypeSchema` becomes recursive → wrap in `v.lazy` with an explicit
  `v.GenericSchema<FieldType>` annotation, exactly as `JsonValueSchema`
  ([`schemas.ts:21`](../../../packages/ir/src/schemas.ts)) already does. `FieldType` in
  `types.ts` therefore becomes a **hand-written** recursive type (like `JsonValue`), not a
  pure `v.InferOutput` — see §2.
- `ref` — `{ kind: 'ref'; ref: string }`. `ref` is a bare name resolved against the
  **same source** (`entities` then `typeAliases`); no namespace qualifier in v1
  (overview: same-namespace only).
- `union` — `variants` flattened by producers (no union-of-union); the schema does **not**
  enforce `length >= 2` (overview: degenerate unions tolerated, normalised in cross-ref).
- `discriminator.mapping` — `Record<discriminatorValue, refName>`; `refName` must be one
  of the union's `ref` variants (checked in cross-ref, §3).

### 1.2 `TypeAlias` + `SourceIR.typeAliases`

```ts
export const TypeAliasSchema = v.object({
  name: v.string(),
  type: FieldTypeSchema,          // any FieldType (overview decision)
  doc: v.optional(v.string()),
});

export const SourceIrSchema = v.object({
  namespace: v.string(),
  parser: v.string(),
  parserVersion: v.optional(v.string()),
  entities: v.record(v.string(), EntitySchema),
  enums: v.record(v.string(), EnumDefSchema),
  typeAliases: v.optional(v.record(v.string(), TypeAliasSchema)),
});
```

`typeAliases` is **optional** (mirrors `Entity.enums` at
[`schemas.ts:173`](../../../packages/ir/src/schemas.ts)): absent for every current parser,
no fixture migration, helpers treat `undefined` as `{}`.

### Alternative considered — required `typeAliases: {}`

Rejected: forces a one-line change in `builder.ts:484` **and** in every hand-built
`SourceIR` test fixture across `core`, `config`, `gen-*` (grep shows ~10 test files build
IR literals). Optional matches the existing `Entity.enums` precedent and keeps the diff
inside this feature's packages.

### Alternative considered — root unions as a marked `Entity`

Rejected (overview): every `Object.values(source.entities)` loop in `gen-zod` /
`gen-angular` / `core` (e.g.
[`gen-zod/src/emit/barrel.ts:11`](../../../packages/gen-zod/src/emit/barrel.ts),
[`gen-zod/src/generator.ts:29`](../../../packages/gen-zod/src/generator.ts)) would need a
`kind === 'alias'` guard. A separate registry keeps entity iteration untouched and makes
"emit a type alias, not a schema+form" the natural default.

## 2. Type surface — `packages/ir/src/types.ts`

`FieldType` moves from inferred to hand-written recursive (same pattern as `JsonValue`):

```ts
export type FieldType =
  | { kind: 'scalar'; scalar: ScalarType }
  | { kind: 'enum'; ref: string }
  | { kind: 'unknown'; hint?: string }
  | { kind: 'ref'; ref: string }
  | {
      kind: 'union';
      variants: FieldType[];
      discriminator?: { propertyName: string; mapping?: Record<string, string> };
    };
```

`TypeAlias` = `v.InferOutput<typeof TypeAliasSchema>`. `SourceIR` stays inferred (the new
key rides along). `types.test-d.ts` gains a recursive-shape assertion.

## 3. Validation — `packages/ir/src/validate.ts`

New `IrIssueCode` members:

| code | meaning |
|---|---|
| `unresolved_ref` | a `{ kind: 'ref' }` names no entity and no type alias in the source |
| `unresolved_type_alias` | a `discriminator.mapping` value names no alias/entity present in `variants` |
| `type_alias_key_mismatch` | `typeAliases[k].name !== k` |
| `degenerate_union` | union with `< 2` variants — **warning-level**, not fatal (see below) |

`checkSource` ([`validate.ts:137`](../../../packages/ir/src/validate.ts)) additions:

1. **Field-type walk.** Today the loop at
   [`validate.ts:168`](../../../packages/ir/src/validate.ts) only inspects
   `field.type.kind === 'enum'`. Replace with a recursive `walkFieldType(type, path)` that:
   - `enum` → existing enum-ref resolution;
   - `ref` → resolve against `entity`-local? no; against `source.entities` then
     `source.typeAliases` → `unresolved_ref` if missing;
   - `union` → recurse into every variant; if `variants.length < 2` push a
     `degenerate_union` issue; if `discriminator?.mapping`, every value must resolve to a
     `ref` variant in `variants` → `unresolved_type_alias`;
   - `scalar` / `unknown` → nothing.
2. **Type-alias pass.** For each `typeAliases[k]`: key/name match, then `walkFieldType` on
   `alias.type` with path `${namespace}.typeAliases.${k}`.
3. **Cycle detection (informational).** After resolution, a DFS over `ref` edges
   (field-type `ref`, alias `type` `ref`, union variant `ref`) records cycles but **does
   not** push an issue — overview decision "recursion allowed". A cycle set is attached to
   the `IrValidation` result as `info` (new optional `info?: IrIssue[]` on the `ok: true`
   branch, code `union_cycle`) so a generator can log it. `degenerate_union` rides the
   same `info` channel rather than failing the parse (overview: "toléré, normalisé en
   cross-ref").

`validateSourceIR` runs items 1–3 with the this-source-only `lookup`; `validateIR` runs
them per source after merge. Cross-source `ref` (namespace-qualified) is out of scope —
the schema has no qualifier field, so it cannot occur in v1.

### `info` channel — alternative considered

Rejected making `degenerate_union` / `union_cycle` hard errors: the overview explicitly
tolerates both and expects the generator to unfold (1 variant → the bare type, 0 →
`unknown`). A non-fatal `info` list keeps `assertIR` / `parseIR` green while still
surfacing the condition. `IrValidationError` is unchanged (fatal issues only).

## 4. Builder — `packages/ir/src/builder.ts`

`FieldBuilder` gains:

```ts
ref(name: string): this;
union(build: (u: UnionBuilder) => void): this;

interface UnionBuilder {
  scalar(t: ScalarType): this;
  enum(ref: string): this;
  ref(name: string): this;
  union(build: (u: UnionBuilder) => void): this;   // nested, flattened on build
  unknown(hint?: string): this;
  discriminator(propertyName: string, mapping?: Record<string, string>): this;
}
```

`SourceIrBuilder` gains `addTypeAlias(name, build: (t: TypeAliasBuilder) => void)` where
`TypeAliasBuilder` exposes the same type-setters as `UnionBuilder` plus `doc(text)`.
`SourceIrBuilderImpl.build()` ([`builder.ts:484`](../../../packages/ir/src/builder.ts))
adds `typeAliases` to the literal only when non-empty (same guard style as
`entity.enums`).

Incremental checks (throw immediately, like `format()` at
[`builder.ts:225`](../../../packages/ir/src/builder.ts)): `union()` with `< 2` variants
throws `IrBuildError` (the builder is stricter than the schema — a hand-built degenerate
IR is tolerated on read, but a builder call site is a bug); `discriminator` mapping values
that are not `ref` variants throw.

## 5. Helpers — `packages/ir/src/helpers.ts`

```ts
export function resolveRef(source: SourceIR, ref: string): Entity | TypeAlias | undefined;
export function resolveTypeAlias(source: SourceIR, name: string): TypeAlias | undefined;
export function* iterTypeAliases(ir: IR): Iterable<{ namespace: string; alias: TypeAlias }>;
/** Flatten nested unions, dedupe structurally-identical variants. */
export function flattenUnion(type: Extract<FieldType, { kind: 'union' }>): FieldType[];
```

`scalarTsType` ([`helpers.ts:157`](../../../packages/ir/src/helpers.ts)) extends its
`switch`:

- `ref` → the ref name verbatim (identifiers never prefixed, ADR-0004);
- `union` → the variant TS types joined with ` | ` (recursively via `scalarTsType`),
  wrapped in parens when nested.

The `switch` stays exhaustive over the widened `FieldType` so `tsc` flags any generator
that forgets a kind — this is the mechanism that enforces the overview's "mandatory
support".

## 6. `IR_VERSION` — `packages/ir/src/version.ts`

`IR_VERSION = '2'`. `isCompatible` stays strict equality. Consequence: every
`@kurotako/*` package is rebuilt and re-released together (monorepo, changesets). Any
persisted `--emit-ir` dump at `irVersion: '1'` is rejected with `version_incompatible` —
acceptable, the dump is a debug artifact, not a stored format.

## 7. `gen-zod` impact

- **`render/scalars.ts`**: `baseExpr`
  ([`scalars.ts:59`](../../../packages/gen-zod/src/render/scalars.ts)) gains:
  - `ref` → `` `${refName}Schema` `` when the ref is a type alias or entity in the same
    namespace, wrapped `z.lazy(() => …)` when the ref participates in a cycle (from the
    validation `info`), else a bare reference;
  - `union` → `z.union([<variant exprs>])`; with `discriminator` →
    `z.discriminatedUnion('<propertyName>', [<variant exprs>])` (both dialects: check
    `dialect` for the v3 spelling `z.discriminatedUnion(name, [...])` which is identical
    in v4). `baseClass` returns `'other'` for `ref` / `union` (no scalar constraint
    chain).
- **`render/field.ts`**: `fieldExpr`
  ([`field.ts:18`](../../../packages/gen-zod/src/render/field.ts)) is unchanged in shape —
  `list` / `nullable` / `optional` still wrap the base expr.
- **New emit: type aliases.** A `emit/aliases.ts` produces
  `<ns>/zod/aliases.ts` with, per alias, `export const <Name>Schema = <expr>;` and
  `export type <Name> = z.infer<typeof <Name>Schema>;`. Wired into
  [`generator.ts`](../../../packages/gen-zod/src/generator.ts) alongside `enums.ts` /
  `filters.ts`, added to the `<ns>/zod` barrel
  ([`emit/barrel.ts`](../../../packages/gen-zod/src/emit/barrel.ts)).
- **`names.ts`**: add `aliasSchemaName(name) => \`${name}Schema\``, `aliasModule(ns)`.
- **`artifact.ts`**: `buildArtifact`
  ([`artifact.ts:86`](../../../packages/gen-zod/src/artifact.ts)) adds one
  `entities[`${ns}.${aliasName}`]` entry per alias with
  `symbols: { schema: '<Name>Schema', type: '<Name>' }` and `module: aliasModule(ns)`, so
  `gen-angular` and the root barrel see aliases through the existing contract. `iterEntities`
  is entity-only, so iterate `ir.sources[ns].typeAliases` explicitly.
- Recursive entity/alias references already work through the existing `Deep` family's
  `z.lazy` machinery in
  [`render/relations.ts`](../../../packages/gen-zod/src/render/relations.ts) — reuse the
  same `z.lazy` wrapper helper.

## 8. `gen-angular` impact

- **`render/controls.ts`**: `baseType`
  ([`controls.ts:29`](../../../packages/gen-angular/src/render/controls.ts)) gains:
  - `ref` → the referenced alias/entity DTO type name (from the zod artifact
    `entities[k].symbols.type`);
  - `union` → the variant types joined ` | `.
- **`controlType`** keeps wrapping `list` / `nullable`.
- **Discriminated union → sub-`FormGroup`** (overview: "sous-groupes par variante si
  discriminator"): when `field.type.kind === 'union'` and `discriminator` is set, emit a
  `FormGroup` whose controls are keyed by discriminator value, each a nested
  `FormGroup<<Variant>FormControls>` built from the resolved `ref` variant's entity/alias.
  A small runtime switch (in `zod-forms.runtime.ts`) toggles the active sub-group on the
  discriminator control's `valueChanges`. Without `discriminator`, or on a **recursive
  branch** (validation `info`), fall back to `FormControl<A | B>` (or
  `FormControl<unknown>` when a variant is itself recursive) plus a
  `// union: validated by zodValidator(schema)` comment and a `logger.warn`.
- **`zeroValue`** ([`controls.ts:70`](../../../packages/gen-angular/src/render/controls.ts)):
  `ref` / non-discriminated `union` → `'undefined'` (control type includes `| undefined`
  for a no-default field); discriminated union → the first variant's zero sub-object.
- **`artifact.ts`** ([`gen-angular/src/artifact.ts:84`](../../../packages/gen-angular/src/artifact.ts)):
  form symbols for alias-backed groups added the same way as `gen-zod`.

## 9. `parser-prisma` impact

None. It builds via `createSourceIR` and never calls `ref` / `union` / `addTypeAlias`;
`typeAliases` stays absent. Its test fixtures are unaffected (optional key). A single
regression test asserts a Prisma-built `SourceIR` still validates under `IR_VERSION = '2'`.

## 10. `core` impact

- `writer/barrel.ts` ([`barrel.ts:63`](../../../packages/core/src/writer/barrel.ts))
  already iterates `artifact.entities` generically — alias entries flow through the
  ambiguous-re-export check with no change.
- `mergeIR` / `assertIR` in the run pipeline pick up the new `validate.ts` checks for
  free. If the `IrValidation` `info` channel is added (§3), `core` logs
  `union_cycle` / `degenerate_union` at `warn` after merge.
- `--emit-ir` dump: no code change, the new keys serialize as plain JSON.

## 11. Test surface

- `ir`: schema round-trip for `ref` / `union` / nested union / discriminated union /
  `typeAliases`; `validate` fixtures for each new `IrIssueCode`; cycle detection returns
  `info` not a fatal issue; degenerate union tolerated on read, rejected by the builder;
  `scalarTsType` fixture rows for `ref` and `union`; `types.test-d.ts` recursive assertion.
- `gen-zod`: `z.union` / `z.discriminatedUnion` / `z.lazy` snapshots; `aliases.ts` emit;
  artifact exposes alias symbols; compile test (tsc over emitted output) with a recursive
  alias.
- `gen-angular`: discriminated sub-`FormGroup` snapshot + runtime switch compile test;
  non-discriminated fallback `FormControl` + warning; recursive-branch fallback.
- `core`: run-pipeline test with a source carrying a `typeAliases` entry end-to-end
  (mode A + mode B).

## 12. Consequences verified against the current repo

- `FieldTypeSchema` recursion forces `FieldType` to a hand-written type — precedent
  exists (`JsonValue`), `types.ts` already imports `type * as v`.
- Every `FieldType` `switch` in `gen-zod` / `gen-angular` / `helpers.ts` becomes
  non-exhaustive at compile time the moment `IR_VERSION` bumps — `tsc -b` (Stop-hook
  enforced) is the gate that no generator ships without handling `ref` / `union`.
- No parser other than a future `parser-openapi` produces the new shapes; `parser-prisma`
  and all current fixtures are source-compatible via the optional key.
- Changesets: `minor` for `@kurotako/ir`, `@kurotako/gen-zod`, `@kurotako/gen-angular`
  (new public surface, `0.x`); `patch` for `@kurotako/core` (behaviour only). The
  `IR_VERSION` bump is called out in the `@kurotako/ir` changeset body.

## Découpage en tâches d'implémentation

Fichiers sous [`../../tasks/`](../../tasks/), issues sur `marmotz/kurotako`.

1. [#112 ir-union-schema-types](../../tasks/112-ir-union-schema-types.md) — `schemas.ts`
   (`FieldTypeSchema` → `v.lazy` + variantes `ref` / `union`, `TypeAliasSchema`,
   `SourceIR.typeAliases?`), `types.ts` (`FieldType` récursif écrit à la main, `TypeAlias`),
   `version.ts` (`IR_VERSION = '2'`). Aucune dépendance.
2. [#113 ir-union-validation](../../tasks/113-ir-union-validation.md) — `validate.ts` :
   `walkFieldType` récursif, nouveaux `IrIssueCode`, passe `typeAliases`, détection de
   cycle informative, canal `info` sur `IrValidation` (dep : #112).
3. [#114 ir-union-builder-helpers](../../tasks/114-ir-union-builder-helpers.md) —
   `builder.ts` (`f.ref` / `f.union` / `UnionBuilder` / `addTypeAlias`), `helpers.ts`
   (`resolveRef`, `resolveTypeAlias`, `iterTypeAliases`, `flattenUnion`, `scalarTsType`
   élargi et exhaustif) (deps : #112, #113).
4. [#115 gen-zod-union](../../tasks/115-gen-zod-union.md) — `render/scalars.ts` (`z.union`
   / `z.discriminatedUnion` / `z.lazy`), `emit/aliases.ts`, `names.ts`, wiring generator +
   barrel, `artifact.ts` (symboles d'alias) (dep : #114).
5. [#116 gen-angular-union](../../tasks/116-gen-angular-union.md) — `render/controls.ts`
   (`ref` / `union`), sous-`FormGroup` discriminé + switch runtime, repli `FormControl` +
   warning, `artifact.ts` (dep : #115).
6. [#117 ir-union-integration](../../tasks/117-ir-union-integration.md) — log `info` dans
   `core`, test de régression `parser-prisma`, test run pipeline avec `typeAliases`,
   changesets (`minor` ir / gen-zod / gen-angular, `patch` core) (deps : #115, #116).
