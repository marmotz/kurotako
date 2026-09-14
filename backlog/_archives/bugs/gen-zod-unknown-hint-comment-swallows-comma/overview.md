# Bug: `@kurotako/gen-zod` emits invalid syntax for a non-trailing `unknown`-hint field

**Status**: fixed — `objectExpr`/`extendExpr` no longer append a comma after a
trailing hint comment (issue #163)

## Context

Found while wiring `zodGenerator` onto the `api` source (OpenAPI → Zod, for
client-side form validation) in a downstream monorepo
([`ekoz`](https://github.com/marmotz/ekoz), see its
[SDK foundations technical design §11.2](https://github.com/marmotz/ekoz/blob/develop/backlog/features/sdk-foundations/technical.md#112-c%C3%A2blage-takoconfigts)
and [issue #53](https://github.com/marmotz/ekoz/issues/53)). That source's
OpenAPI document ([`apps/server/openapi.json`](https://github.com/marmotz/ekoz/blob/develop/apps/server/openapi.json))
has every enum property declared inline (`{ "type": "string", "enum": [...] }`)
— there are no named/`$ref`-able enum components anywhere in the document.

`@kurotako/parser-openapi` classifies an inline string enum as
`{ kind: 'unknown', hint: 'enum' }` (the same "IR doesn't model this shape yet"
fallback used for other unsupported constructs) rather than, say, a
`z.enum([...])`/literal union. That classification itself is a known,
separate limitation — not what this bug is about. This bug is about what
`gen-zod` emits for that classification: syntactically invalid code whenever
the field is not the object's last property.

## Reproduction

`@kurotako/gen-zod@0.3.2` (same behavior confirmed against this repo's current
`main` checkout of `packages/gen-zod`, so unreleased work does not fix it
either). Given an OpenAPI schema:

```json
{
  "type": "object",
  "properties": {
    "displayName": { "type": "string" },
    "status": { "type": "string", "enum": ["active", "suspended", "deleted"] },
    "createdAt": { "type": "string", "format": "date-time" }
  }
}
```

`tako generate` produces:

```ts
export const AdminUserDetailDtoSchema = z.object({
  displayName: z.string(),
  status: z.unknown() // unknown: enum,
  createdAt: z.coerce.date(),
});
```

`status: z.unknown() // unknown: enum,` is a single line comment — everything
from `//` to the end of the line, **including the trailing comma**, is
comment text. The next property (`createdAt`) is therefore missing its
preceding comma, which is a hard syntax error (`tsc`: `TS1005: ',' expected`).

Only `unknown`-hint fields that are **not the object's last property** hit
this — `status: z.unknown() // unknown: enum` as the final property before
`});` is valid (nothing follows it needing a comma), which is why not every
generated file with an enum property fails. In the `AdminUserDetailDto`
example above, `AccountViewDto`, `InvitationViewDto` and `SetupStateDto`
happened to have their enum field last and compiled fine; `AdminUserDetailDto`,
`MeViewDto`, `UsernameChangeRequestDto`, `UsernameChangeAppliedDto`,
`UsernameChangePendingDto` and `AdminUserListResponseDtoItems` did not, and
failed to compile.

## Impact

Any `unknown`-hint field (inline OpenAPI enum today; anything else that hits
the same IR fallback tomorrow) that isn't the last declared property of its
object silently produces invalid TypeScript. `tako generate` itself reports
success — the failure only surfaces downstream, at `tsc`/typecheck time, in
generated files marked "do not edit". Affects every variant (`full`, `deep`,
`create`, `update`, …) since they all go through the same object-literal
assembly.

## Root cause

`packages/gen-zod/src/render/field.ts`'s `fieldExpr()` correctly appends the
hint comment with no trailing comma (see its own test,
`packages/gen-zod/src/render/field.test.ts:88-97`: `'z.unknown() // unknown: Point'`,
comment last, on purpose — the caller owns the comma). But both call sites in
`packages/gen-zod/src/emit/entity.ts` build each object property line as
`` `  ${k}: ${v},` `` (`objectExpr`, line 54; `extendExpr`, line 59), appending
the comma *after* whatever `fieldExpr` returned — including after a trailing
`// ...` comment.

## Decisions made

- **Scope**: this is a `gen-zod` emission bug (`objectExpr`/`extendExpr` in
  `packages/gen-zod/src/emit/entity.ts`), not a `parser-openapi`/IR bug. The
  separate question of whether an inline OpenAPI enum should classify as
  something better than `{ kind: 'unknown', hint: 'enum' }` (it currently does
  for both `gen-typescript` and `gen-zod`) is out of scope here — see
  "Related, out of scope" below.
- Not yet decided: exact fix shape (see `technical.md`) or priority against
  the other two open bugs in this folder.

## Related, out of scope

- `parser-openapi` mapping every inline `enum` to `{ kind: 'unknown', hint:
  'enum' }` instead of a proper enum/literal-union IR type is a real gap
  (confirmed no named enum components exist in ekoz's `openapi.json` to fall
  back on either) but is a separate, bigger change — this bug only concerns
  the invalid syntax `gen-zod` emits for whatever `unknown`-hint fields already
  exist today, regardless of why they're `unknown`.
