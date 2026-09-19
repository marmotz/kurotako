# gen-typescript rejects every named enum as colliding with its own self-alias

**Status**: [technical.md](technical.md)

## Context

Consuming `@kurotako/parser-openapi@0.2.4` (the fix for
[`openapi-inline-enum-unknown`](../openapi-inline-enum-unknown/overview.md))
from the `ekoz` repo, `bun run generate` (`tako generate`) now fails outright:

```
tako error [driver_error]: generator 'typescript' threw during generate
  generator: typescript
  cause: source type aliases 'AccountViewDtoStatus', 'AdminUserDetailDtoStatus',
  'AdminUserListResponseDtoItemsStatus', 'InvitationViewDtoStatus', 'MeViewDtoStatus',
  'MyPermissionsResponseDtoCapabilities', 'RoomViewDtoDefaultRole', 'RoomViewDtoType',
  'RoomViewDtoVisibility', 'SetupOwnerResponseDtoUserStatus', 'SetupStateDtoState',
  'UsernameChangeAppliedDtoStatus', 'UsernameChangePendingDtoStatus',
  'UsernameChangeRequestDtoStatus' collide with generated public identifiers in
  namespace 'api'; rename one of the conflicting source definitions
```

Every single name in that list is a name the 0.2.4 fix just started
synthesizing — i.e. the fix that made inline enums resolvable at all
(`openapi-inline-enum-unknown`) is entirely correct on the parser side (see
that bug's `technical.md` and its passing test suite), but it exposes a
second, previously-latent bug in `gen-typescript`: **it treats every named
enum as colliding with itself.**

## Root cause

`parser-openapi` registers a named enum (top-level *or*, since 0.2.4,
synthesized-inline) in two places at once, by design:

```ts
enums[name] = { name, values: schema.enum.map((value) => ({ name: value })) };
aliases[name] = { name, type: { kind: 'enum', ref: name } };
```

This exact pattern is called out and *correctly* handled elsewhere in the
codebase — [`packages/gen-openapi/src/document.ts:20-25`](../../../packages/gen-openapi/src/document.ts):

> "`render/schema.ts` maps `FieldType.kind === 'enum'` to a bare `$ref`
> (mirroring `parser-openapi`'s self-referencing `typeAliases[name] = { kind:
> 'enum', ref: name }` entry) ... the synthetic self-referencing alias is
> skipped in favour of this one."

`gen-openapi`'s own name-collection ([`document.ts:76-82`](../../../packages/gen-openapi/src/document.ts))
does exactly that: it builds the schema name list as entities ∪ enums ∪
(type aliases *minus* whatever is already an entity or an enum), so an
enum's self-alias never counts as a second, competing declaration.

`gen-typescript`'s pre-flight check has no equivalent exclusion. In
[`packages/gen-typescript/src/generator.ts`](../../../packages/gen-typescript/src/generator.ts):

- `generatedPublicNames` (line 86) computes `enumNames` (every name in
  `collectEnums(source)`, which reads `source.enums` — line 95) and
  `aliasNames` (literally `Object.keys(source.typeAliases ?? {})`,
  line 113) as two independent sets, with no cross-filtering between them.
- `validateSourceEmission` (line 117) then does, at line 128:

  ```ts
  const aliasCollisions = [...aliasNames].filter(
    (name) => enumNames.has(name) || generatedTypeNames.has(name),
  );
  ```

  For **every** named enum, `name` is in `aliasNames` (its self-alias) *and*
  in `enumNames` (its own `EnumDef`) — so `aliasCollisions` always contains
  every enum name in the source, and line 132 always throws
  `TypeScriptAliasPublicNameCollisionError`.

This has nothing to do with the enum being synthesized vs. genuinely
top-level in the OpenAPI document, and nothing to do with `ekoz` specifically:
**no OpenAPI document with a named enum reaching `gen-typescript` could ever
have worked.** It stayed unnoticed until now purely because, before
`parser-openapi@0.2.4`, no enum ever survived as a named `kind: 'enum'` type
unless it was already a bare top-level `components.schemas` entry — a shape
`nestjs-zod`/`ekoz` never produced, and apparently no fixture or example in
this repo exercises either (`examples/*/openapi.json` have no top-level
string-enum component; `packages/gen-typescript/src/generator.test.ts` has no
fixture where a name appears in both `source.enums` and `source.typeAliases`).

`gen-zod` reaches the same self-aliased shape (`generator.ts:31`:
`Object.values(source.typeAliases ?? {})` includes the enum's self-alias) but
has no equivalent pre-flight collision check, so it does not crash `tako
generate`. It has a twin bug instead: `emitEnums`/`emitAliases` both name a
schema/type after the bare enum name (`${name}Schema` / `${name}`,
[`names.ts:83-90`](../../../packages/gen-zod/src/names.ts)), so `enums.ts`
and `aliases.ts` each export a `<Name>Schema` const and a `<Name>` type for
the same name, and the sub-tree barrel re-exports both
(`export * from './enums'; export * from './aliases';`,
[`emit/barrel.ts`](../../../packages/gen-zod/src/emit/barrel.ts)) — an
ambiguous-export error at `tsc` time for whoever consumes the generated
barrel. Confirmed by reading `emit/aliases.ts` and `emit/barrel.ts`; not
reproduced end-to-end here.

## Goal

Both `gen-typescript` and `gen-zod` must treat a name registered as both an
`EnumDef` and its own self-referencing `typeAlias` — the shape
`parser-openapi` has always produced for a named enum, before and after the
0.2.4 fix — as one declaration, not two:

- `gen-typescript`'s pre-flight validation must stop rejecting it as a
  collision (the crash reported above).
- `gen-zod` must stop emitting a redundant, colliding `<Name>Schema`/`<Name>`
  pair for the self-alias alongside the real enum schema (the barrel
  ambiguous-export bug found while investigating this report).

A **genuine** collision (two *different* declarations claiming the same
name — e.g. a hand-written `typeAlias` that happens to share a name with an
unrelated enum, or an entity variant name reused as an alias) must still be
rejected/kept distinct exactly as it is today, in both generators.

## Decisions acted upon

- Scope covers both `gen-typescript` (crash) and `gen-zod` (silent
  duplicate-export bug) in this same bug, since both stem from the same root
  cause and fixing only one would just move the bug rather than close it.
- Exact fix shape (e.g. mirroring `gen-openapi/document.ts`'s enum/alias
  exclusion in each generator) is deferred to `technical.md`.
