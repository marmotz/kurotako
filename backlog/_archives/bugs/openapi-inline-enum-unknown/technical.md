# Technical design — inline enum synthesis in `parser-openapi`

**Status**: design

## Summary

Synthesize a name for a JSON Schema string enum found inline on an entity
property (or on an array of that property), by extending the exact same
code path `parser-openapi` already uses to synthesize names for inline
*object* schemas ([`parser.ts:400-421`](../../../../packages/parser-openapi/src/parser.ts)).
No IR change, no generator change: the fix is entirely contained in
`packages/parser-openapi/src/parser.ts`.

## Current code shape

Inside `addNamedSchema`'s property loop ([`parser.ts:399-421`](../../../../packages/parser-openapi/src/parser.ts)):

```ts
const property = asSchema(value);
const inline =
  property.type === 'array' ? asSchema(property.items) : property;
const inlineName =
  typeof inline.title === 'string' && pascalCase(inline.title) !== ''
    ? pascalCase(inline.title)
    : `${name}${key.charAt(0).toUpperCase()}${key.slice(1)}`;
const synthesizeInline =
  typeof inline.$ref !== 'string' &&
  (inline.type === 'object' || inline.properties !== undefined) &&
  inline.additionalProperties === undefined;
let type: FieldType;
if (synthesizeInline) {
  addNamedSchema(inlineName, inline);
  type = { kind: 'ref', ref: inlineName };
} else {
  type = mapSchema(inline, names, resolveRef, external);
}
```

`inline` already unwraps `property.type === 'array'` down to `property.items`,
so both the direct-property and array-of-property cases share one code path.
`inlineName` is already computed generically (`title` override, else
`<EntityName><PascalKey>`) — it doesn't only apply to objects, it's just
currently only *used* by the object branch.

The top-level enum loop ([`parser.ts:450-461`](../../../../packages/parser-openapi/src/parser.ts))
shows the three statements needed to register a name as an enum:

```ts
claim(name, schema);
enums[name] = { name, values: schema.enum.map((value) => ({ name: value })) };
aliases[name] = { name, type: { kind: 'enum', ref: name } };
```

`claim` ([`parser.ts:342-348`](../../../../packages/parser-openapi/src/parser.ts))
is the same collision guard `addNamedSchema` itself uses: it throws
`OpenApiNameCollisionError` if `inlineName` is already allocated to a
*different* schema object, and is a no-op (returns `false`, nothing
re-registered) if the same schema is claimed again — this already handles
the "two different DTOs both have a `status` property" case for the object
path today, because `inlineName` is entity-name-prefixed (`RoomViewDtoStatus`
vs. `AccountViewDtoStatus` never collide); it will do the same for enums
with no extra code.

`mapSchema`'s own inline-enum fallback (`{ kind: 'unknown', hint: 'enum' }`,
[`parser.ts:307-312`](../../../../packages/parser-openapi/src/parser.ts)) stays
exactly as it is — it remains the correct outcome for a string enum reached
through `mapSchema` directly (nested in a `oneOf`/`anyOf` variant, an
`additionalProperties` value, or any other schema position that isn't a
direct entity property). This mirrors the existing, accepted behavior of the
object-inline case: `mapSchema`'s generic object fallback
(`{ kind: 'unknown', hint: 'object' }`, [`parser.ts:298`](../../../../packages/parser-openapi/src/parser.ts))
is likewise never given a name outside the property loop. Extending name
synthesis to every position `mapSchema` can reach is out of scope for this
fix (see overview.md's "Décisions actées").

## Change

Extract a small helper for "is this schema a bare string enum" (the same
predicate already inlined at `parser.ts:308-311`), then use it in the
property loop alongside the existing object check:

```ts
function isStringEnumSchema(schema: Schema): boolean {
  return (
    Array.isArray(schema.enum) &&
    schema.enum.every((item) => typeof item === 'string')
  );
}
```

Property-loop change ([`parser.ts:399-421`](../../../../packages/parser-openapi/src/parser.ts)):

```ts
const synthesizeInline =
  typeof inline.$ref !== 'string' &&
  (inline.type === 'object' || inline.properties !== undefined) &&
  inline.additionalProperties === undefined;
const synthesizeEnum =
  !synthesizeInline && typeof inline.$ref !== 'string' && isStringEnumSchema(inline);
let type: FieldType;
if (synthesizeInline) {
  addNamedSchema(inlineName, inline);
  type = { kind: 'ref', ref: inlineName };
} else if (synthesizeEnum) {
  claim(inlineName, inline);
  enums[inlineName] = {
    name: inlineName,
    values: inline.enum.map((value) => ({ name: value as string })),
  };
  aliases[inlineName] = { name: inlineName, type: { kind: 'enum', ref: inlineName } };
  type = { kind: 'enum', ref: inlineName };
} else {
  type = mapSchema(inline, names, resolveRef, external);
}
```

`mapSchema`'s own `{ kind: 'unknown', hint: 'enum' }` branch
([`parser.ts:307-312`](../../../../packages/parser-openapi/src/parser.ts)) is
left untouched — it is unreachable from this property loop once
`synthesizeEnum` is true, and remains the correct answer everywhere else
`mapSchema` is called (nested `oneOf`/`anyOf` variants, `additionalProperties`
values, top-level aliases that are themselves inline compositions, etc.).

The `title`-override behavior falls out for free: a `title` on an inline
enum schema names it exactly like a `title` on an inline object schema does
today, consistent with `RoomViewDto` + `type` → `RoomViewDtoType` and
`AccountViewDto` + `status` → `AccountViewDtoStatus` when no `title` is
given.

## Generators — verified, no change needed

All four generators already treat `FieldType.kind === 'enum'` completely
generically, resolving `ref` against `SourceIR.enums` (or an entity-scoped
`enums` map, via `resolveEnum` in [`packages/ir/src/helpers.ts:32-38`](../../../../packages/ir/src/helpers.ts)) —
nothing in their code distinguishes a top-level named enum from a
synthesized one, since both are ordinary entries in `enums[name]` /
`aliases[name]`:

- **gen-zod**: `baseExpr` ([`packages/gen-zod/src/render/scalars.ts:86`](../../../../packages/gen-zod/src/render/scalars.ts))
  emits `enumSchemaName(type.ref)`; `collectTypeDeps`
  ([`packages/gen-zod/src/render/scalars.ts:133`](../../../../packages/gen-zod/src/render/scalars.ts))
  imports it from `./enums`.
- **gen-typescript**: `renderFieldType`
  ([`packages/gen-typescript/src/render/scalars.ts:93`](../../../../packages/gen-typescript/src/render/scalars.ts))
  and `collectTypeDependencies`
  ([`packages/gen-typescript/src/render/scalars.ts:30`](../../../../packages/gen-typescript/src/render/scalars.ts))
  resolve it through `resolveEnum`.
- **gen-angular**: `typeBase`
  ([`packages/gen-angular/src/render/controls.ts:52`](../../../../packages/gen-angular/src/render/controls.ts))
  and `variantType`
  ([`packages/gen-angular/src/render/unions.ts:116`](../../../../packages/gen-angular/src/render/unions.ts))
  both resolve it via the injected `enumTypeName` resolver, itself backed by
  `resolveEnum`.
- **gen-openapi**: `renderFieldType`
  ([`packages/gen-openapi/src/render/schema.ts:47`](../../../../packages/gen-openapi/src/render/schema.ts))
  emits `{ $ref: schemaRef(type.ref) }` — round-tripping a synthesized enum
  back through `gen-openapi` produces a genuine standalone
  `components.schemas` entry, which is a strictly more faithful contract
  than the current `unknown` output, not a behavior change to guard against.

This confirms the "synthesize a name" choice from `overview.md`: it reuses
the already-correct `kind: 'enum'` rendering path end to end, and the
"scope: all existing generators" decision is satisfied by inspection — none
of them needs a code change or a new `FieldType.kind` case.

## Consequences / what changes for existing behavior

- Every inline string-enum property directly on an entity (or on an array of
  such a property) now produces a real union / `z.enum([...])` instead of
  `unknown`, matching the `Goal` in `overview.md`.
- A genuinely top-level named enum schema (`components.schemas.Status`) is
  unaffected — it still goes through the pre-existing top-level loop
  ([`parser.ts:450-461`](../../../../packages/parser-openapi/src/parser.ts)),
  which this change does not touch.
- `mapSchema`'s `{ kind: 'unknown', hint: 'enum' }` fallback
  ([`packages/gen-zod/src/emit/entity.test.ts:176`](../../../../packages/gen-zod/src/emit/entity.test.ts)
  covers its rendering) stays reachable and correct for every enum position
  outside the direct-entity-property case — no test asserting that fallback
  needs to change.
- New generated names appear in `enums` / `SourceIR.typeAliases` for
  documents that previously hit the `unknown` fallback — this is an additive
  change to generated output (new exported symbols), not a breaking one for
  any consumer that was already working around `unknown` fields.

## Tests

- `packages/parser-openapi/src/parser.test.ts`: new case mirroring
  `'allocates inline object schemas once with an owner-derived name'`
  ([`parser.test.ts:304`](../../../../packages/parser-openapi/src/parser.test.ts))
  for an inline string enum — asserts `source.enums.RoomViewDtoType` (or
  equivalent synthesized name) and
  `source.entities.RoomViewDto.fields[...].type` equal
  `{ kind: 'enum', ref: '...' }`.
- A second case mirroring `'names a synthetic inline entity from its title
  when present'` ([`parser.test.ts:492`](../../../../packages/parser-openapi/src/parser.test.ts))
  for the `title`-override path on an inline enum.
- A third case for the array-of-inline-enum property (`property.type ===
  'array'`, `items` is a bare string enum), confirming `entry.list` is still
  set and the element type is the synthesized `kind: 'enum'`.
- A regression case asserting an inline enum nested inside a `oneOf` (not a
  direct entity property) still maps to `{ kind: 'unknown', hint: 'enum' }`,
  to lock in the scope boundary decided above.
- A collision case: two different entities each with a same-named property
  holding a *different* enum (`RoomViewDto.status` vs. some future
  `OtherDto.status` with different values, if ever entity-prefixed names
  could theoretically collide) is already covered by `claim`'s existing
  `OpenApiNameCollisionError` behavior — no new collision-handling code is
  being added, so no new collision test is required beyond confirming the
  entity-name prefix keeps the two apart (covered by the first test above
  using two different entities).

## Découpage en tâches d'implémentation

The whole fix lives in `packages/parser-openapi` — no generator needs a
change — so there is one task, not a per-package split:

- [#183](https://github.com/marmotz/kurotako/issues/183) — synthesize a name
  for inline string enums instead of falling back to `unknown`.
