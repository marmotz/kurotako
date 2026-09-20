# parser-openapi maps an inline string-enum property to `unknown`, not a union type

**Status**: fixed — [#183](https://github.com/marmotz/kurotako/issues/183) shipped; design in [technical.md](technical.md).

## Context

In the `ekoz` repo, `apps/server`'s OpenAPI description (produced by
`@nestjs/swagger` from Zod DTOs via `nestjs-zod`) declares several DTO
properties as inline string enums, e.g. `RoomViewDto`:

```json
"type": { "type": "string", "enum": ["space", "channel", "dm", "group_dm"] },
"visibility": { "type": "string", "enum": ["public", "private", "invite"] },
"defaultRole": { "type": "string", "enum": ["space_admin", "room_admin", "moderator", "member", "reader"] }
```

These are **not** `$ref`s to a named component schema — `nestjs-zod` inlines
a nested `z.enum([...])` directly on the property, only top-level DTOs get
their own `components.schemas` entry. Running Kurotako's OpenAPI parser +
`gen-zod`/`gen-typescript` over this document produces, for every one of
these properties:

```ts
// packages/sdk/src/generated/api/typescript/RoomViewDto.type.ts
export type RoomViewDtoDto = {
  /**
   * @see unknown: enum
   */
  type: unknown;
  ...
};
```

```ts
// packages/sdk/src/generated/api/zod-api/RoomViewDto.schema.ts
type: z.unknown() /* unknown: enum */,
```

instead of the expected `'space' | 'channel' | 'dm' | 'group_dm'` union /
`z.enum([...])`. This is not specific to `Room`: `AccountViewDto.status`
(`'active' | 'suspended' | 'deleted'`) hits the exact same code path and
degrades the same way — every inline enum property anywhere in the
generated OpenAPI document is affected.

## Root cause

[`packages/parser-openapi/src/parser.ts`](../../../../packages/parser-openapi/src/parser.ts)
has two separate places that recognise a JSON Schema string enum, and only
one of them can actually name it:

- **Top-level (named) schemas** — the loop over `components.schemas` entries
  ([`parser.ts:451-462`](../../../../packages/parser-openapi/src/parser.ts)):
  when a schema *at the top level* is itself `{ type: 'string', enum: [...] }`,
  it is registered as a proper `EnumDef` (`enums[name] = { name, values }`)
  and aliased to `{ kind: 'enum', ref: name }`. This is the path that already
  works correctly for a genuinely standalone enum schema.
- **Inline / nested schemas** — `mapSchema`
  ([`parser.ts:206`](../../../../packages/parser-openapi/src/parser.ts)), the
  recursive mapper used for every property's schema that is not itself a
  `$ref`. When it reaches a schema carrying `enum: [...]` that wasn't handled
  by any earlier branch (object, array, `$ref`, `oneOf`/`anyOf`), it falls
  through to
  [`parser.ts:307-312`](../../../../packages/parser-openapi/src/parser.ts):

  ```ts
  if (
    Array.isArray(schema.enum) &&
    schema.enum.every((item) => typeof item === 'string')
  )
    return { kind: 'unknown', hint: 'enum' };
  ```

  `FieldType`'s `enum` variant is `{ kind: 'enum'; ref: string }`
  ([`packages/ir/src/types.ts:35-43`](../../../../packages/ir/src/types.ts)) — it
  requires a name resolvable against `SourceIR.enums`/`typeAliases`. An
  inline enum reached through `mapSchema` has no such name (it is a bare
  property schema, not a `components.schemas` entry), so `mapSchema` cannot
  produce a `kind: 'enum'` value here and falls back to the generic
  `{ kind: 'unknown', hint: 'enum' }` placeholder — a deliberate, tested
  fallback ([`packages/gen-zod/src/emit/entity.test.ts:176`](../../../../packages/gen-zod/src/emit/entity.test.ts)),
  not an oversight in the fallback itself.

  Every downstream renderer then does exactly the right thing with a
  `kind: 'unknown'` field — `gen-zod`
  ([`packages/gen-zod/src/render/scalars.ts:88,151`](../../../../packages/gen-zod/src/render/scalars.ts))
  emits `z.unknown()`, `gen-typescript`
  ([`packages/gen-typescript/src/render/scalars.ts:58,94`](../../../../packages/gen-typescript/src/render/scalars.ts))
  emits the `unknown` type, and the `@see unknown: <hint>` JSDoc comment
  ([`packages/gen-typescript/src/render/jsdoc.ts:28-32`](../../../../packages/gen-typescript/src/render/jsdoc.ts))
  faithfully reports what it was given. None of these three are wrong; they
  are rendering a type that genuinely carries no enum information because
  `mapSchema` discarded it before it got there.

The IR's `enum` `FieldType` variant has no anonymous / inline form (no
`values: string[]` carried directly on the field type — only `ref: string`),
so there is currently no way for `mapSchema` to hand back "this is a string
enum with these values" without also inventing a name for it.

## Goal

An inline (non-`$ref`) JSON Schema string enum on a property — the shape
`nestjs-zod` produces for every nested `z.enum([...])` — should round-trip
through Kurotako as a real enum/union, not `unknown`, across every existing
generator that switches on `FieldType.kind` (`gen-zod`, `gen-typescript`,
`gen-angular`, and any other), not only the two exercised by `packages/sdk`'s
`api` namespace. Every other scalar and the named-schema enum path are
unaffected and must stay exactly as they are.

## Decisions acted upon

- **Fix shape: synthesize a name.** `mapSchema` (or its caller) invents a
  stable name for an anonymous inline enum (e.g. derived from the parent
  schema name + property name, `RoomViewDto` + `type` → `RoomViewDtoType`),
  registers it in `enums`/`aliases` the same way the top-level loop does,
  and returns `{ kind: 'enum', ref: syntheticName }`. Reuses the existing,
  already-correct `enum` rendering path end to end, so no generator needs to
  learn a new `FieldType.kind`. Naming stability and collision handling
  (e.g. two different DTOs both having a `status` property) are technical
  design concerns, not decided here.
- **Scope: all existing generators**, not only `gen-zod`/`gen-typescript`.
  Because the fix is IR-level (no new `FieldType.kind`), every generator that
  switches on `FieldType.kind` — `gen-angular` included — must be checked to
  confirm it already renders `kind: 'enum'` correctly for a synthesized name,
  the same way it does for a named top-level enum today.
