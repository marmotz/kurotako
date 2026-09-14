# Bug: `Where`/`WhereDeep` schema fails to typecheck when the entity has zero filterable fields

**Status**: technical design done, see [technical.md](technical.md) — fix not started

## Context

Found in the same session as the other two `gen-zod` bugs filed today
([gen-zod-unknown-hint-comment-swallows-comma](../gen-zod-unknown-hint-comment-swallows-comma/overview.md),
[gen-zod-verbatim-module-syntax-type-only-exports](../gen-zod-verbatim-module-syntax-type-only-exports/overview.md)),
same downstream task
([ekoz](https://github.com/marmotz/ekoz) issue [#53](https://github.com/marmotz/ekoz/issues/53),
`zodGenerator` wired onto the `api` OpenAPI source). `SetupStateDto` in that
source has exactly one property, `state`, and it's a `{ kind: 'unknown', hint:
'enum' }` field (inline OpenAPI enum, not yet modeled by `parser-openapi` —
separate, already-known limitation). `filterClass` has no filter class for an
`unknown`-typed field, so `SetupStateDto`'s `Where`/`WhereDeep` schemas end up
with **zero** own filterable fields — the first entity in this codebase to hit
that.

## Reproduction

`@kurotako/gen-zod@0.3.3` emits, for `SetupStateDto`:

```ts
const SetupStateDtoWhereSchemaBase = z.object({});
export const SetupStateDtoWhereSchema: z.ZodType<SetupStateDtoWhereDto> = z.lazy(() => SetupStateDtoWhereSchemaBase.extend({
  AND: z.union([SetupStateDtoWhereSchema, z.array(SetupStateDtoWhereSchema)]).optional(),
  OR: z.union([SetupStateDtoWhereSchema, z.array(SetupStateDtoWhereSchema)]).optional(),
  NOT: z.union([SetupStateDtoWhereSchema, z.array(SetupStateDtoWhereSchema)]).optional(),
}));
export type SetupStateDtoWhereDto = z.infer<typeof SetupStateDtoWhereSchemaBase> & { AND?: SetupStateDtoWhereDto | SetupStateDtoWhereDto[]; OR?: SetupStateDtoWhereDto | SetupStateDtoWhereDto[]; NOT?: SetupStateDtoWhereDto | SetupStateDtoWhereDto[]; };
```

`tsc` (zod v4 installed: `4.6.2`) rejects the `z.ZodType<SetupStateDtoWhereDto>`
annotation on `SetupStateDtoWhereSchema`:

```
error TS2322: Type 'ZodLazy<ZodObject<{ AND: ...; OR: ...; NOT: ...; }, $strip>>'
  is not assignable to type 'ZodType<SetupStateDtoWhereDto, unknown, $ZodTypeInternals<SetupStateDtoWhereDto, unknown>>'.
  Types of property '_output' are incompatible.
    Type '{ AND?: SetupStateDtoWhereDto | ...; ... }' is not assignable to type 'SetupStateDtoWhereDto'.
      ... is not assignable to type 'Record<string, never>'.
        Property 'AND' is incompatible with index signature.
          Type 'SetupStateDtoWhereDto | SetupStateDtoWhereDto[]' is not assignable to type 'never'.
```

Zod v4 infers `z.infer<typeof z.object({})>` with an implicit `Record<string,
never>`-shaped index signature (not a plain `{}`), so intersecting it with
`{ AND?: ...; OR?: ...; NOT?: ...; }` produces a type where `AND` collides
with that index signature instead of just adding the optional property —
breaking the recursive `Where` type for any entity whose own filterable-field
set is empty.

## Impact

Blocks `tsc` for `SetupStateDto`'s generated schema file specifically; any
other entity that ends up with zero filterable own fields (every field either
a relation, or a still-unsupported `unknown`-hint type, as here) would hit the
same thing. Not observed anywhere in `apps/server`'s `db` (Prisma) output —
every Prisma model there has at least one plain scalar field — so this is the
first entity anywhere in this codebase's generated output to have an empty
`WhereSchemaBase`.

## Root cause

`packages/gen-zod/src/emit/entity.ts`'s `renderWhereBlock` (lines 302-337)
always types the schema as `z.ZodType<${dto}>` and derives `${dto}` as
`z.infer<typeof ${baseName}>${typeIntersection} & { AND?: ...; ... }`
regardless of whether `${baseName}`'s object has any properties. It doesn't
special-case the zero-fields case, which is what surfaces the empty-object
`z.infer` quirk above.

## Decisions made

- **Scope**: `gen-zod`'s `renderWhereBlock` only — this is about how the
  `Where`/`WhereDeep` type is assembled when there are zero own filterable
  fields, not about `parser-openapi`'s `unknown`-hint classification (that's
  what causes `state` to be unfilterable here, but the same empty-`Where`
  case could arise for other reasons — e.g. a Prisma model consisting only of
  relations — so the fix belongs in the `Where`-assembly logic, not in
  upstream field classification).
- Not yet decided: exact fix shape. Candidates to evaluate — replace the
  `z.object({})` base with something whose inferred type doesn't carry an
  index signature (e.g. `z.object({}).strict()` — needs checking against zod
  v4's actual inference for that combination), or special-case the type
  expression when `ownEntries.length === 0` to skip the `z.infer<typeof
  ${baseName}>` intersection member entirely (the base contributes nothing to
  the type in that case anyway).
- Not yet decided: priority against the other two bugs filed today.
