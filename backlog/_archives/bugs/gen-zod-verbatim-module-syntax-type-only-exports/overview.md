# Bug: generated `api`-namespace output isn't `verbatimModuleSyntax`-clean

**Status**: fixed — both parts published (`@kurotako/gen-zod@0.3.4`, `@kurotako/core@0.2.1`, commit `38b3da8`), confirmed against `ekoz`'s `@ekozhq/sdk` typecheck. Confirming this in `ekoz` required a separate, unrelated fix on the `ekoz` side: its `bun.lock` had `@kurotako/cli`'s nested `@kurotako/core` dependency pinned to `0.2.0` (one version behind the fix) even though the workspace root's direct `@kurotako/core` dependency was already `^0.2.1` — a `bun update` (not just `bun add @kurotako/core@^0.2.1`) was needed to re-resolve that transitive copy. Not a kurotako packaging bug this time — `@kurotako/cli@0.1.3`'s own declared range (`^0.2.0`) is correct and satisfies `0.2.1`; the lockfile just hadn't been told to re-resolve.

## Context

Found immediately after
[gen-zod-unknown-hint-comment-swallows-comma](../gen-zod-unknown-hint-comment-swallows-comma/overview.md)
was fixed and published (`@kurotako/gen-zod@0.3.3`), while finishing the same
downstream task: wiring `zodGenerator` onto the `api` source in
[`ekoz`](https://github.com/marmotz/ekoz)
([issue #53](https://github.com/marmotz/ekoz/issues/53)).
`packages/sdk`'s `tsconfig` (via the repo's `tsconfig.base.json`) sets
`"verbatimModuleSyntax": true`; `apps/server`'s `tsconfig.json` does not (it's
a standalone config, no `extends`). The existing `db` → `apps/server`
`zodGenerator` wiring therefore never exercised this flag — this is the first
time generated `zod` output is typechecked under it. Two independent spots
break.

## Part 1 — cross-entity sibling imports in `gen-zod`'s own output

`packages/gen-zod/src/emit/entity.ts`'s `buildImports` (lines 446-454) emits
one import per sibling entity a `Deep`/`Where`-family schema references, e.g.:

```ts
import { LoginResponseDtoSessionDto, LoginResponseDtoSessionSchema } from './LoginResponseDtoSession.schema.js';
```

`LoginResponseDtoSessionDto` is a `type` (from `export type ... = z.infer<...>`
in the target file) used only in type position in the importing file. Under
`verbatimModuleSyntax`, that's `TS1484: '...' is a type and must be imported
using a type-only import`.

The same function already gets this right for the `aliases` import branch two
cases above (lines 427-437): it wraps the type half of each pair with a
literal `type ` prefix —
`.flatMap((n) => [aliasSchemaName(n), `type ${aliasTypeName(n)}`])`. The
sibling-entity branch is the one place that pattern wasn't applied — looks
like a copy/paste gap between the two import-building branches, not a
different design.

Not exercised by `db` because `apps/server` doesn't set
`verbatimModuleSyntax`; would reproduce there too under that flag, same code
path.

## Part 2 — the synthesized root barrel, on a same-name collision

Separately, `packages/sdk/src/generated/api/index.ts` — the root barrel
`@kurotako/core`'s `synthesizeRootBarrels` writes when two generators emit the
same declaration name in the same namespace (here: `typescriptGenerator` and
the aliased `zodGenerator` instance both cover `api`, and every `Dto`/`Deep
Dto`/etc. **type** name gen-zod's `z.infer` produces collides with
`gen-typescript`'s type of the same name — see the "Name clash in namespace"
warning `tako generate` already prints for this). `synthesizeRootBarrels`
(`packages/core/src/writer/barrel.ts:44`) resolves each collision by pinning
the winning generator's declaration:

```ts
`export { ${identifier} } from '${jsIndex(`./${owners[0]}`)}';`
```

unconditionally as a value-style `export { }` — for every one of the 648
collisions in this case, `identifier` is a `type`, so this is `TS1205:
Re-exporting a type when 'verbatimModuleSyntax' is enabled requires using
'export type'`.

## Impact

Both are the same class of problem as
[gen-zod-unknown-hint-comment-swallows-comma](../gen-zod-unknown-hint-comment-swallows-comma/overview.md):
`tako generate` reports success, but the emitted code fails `tsc` for any
consumer with `verbatimModuleSyntax` on — invisible until a downstream project
actually enables that flag and typechecks the generated tree, which `ekoz`'s
`apps/server` never did (it doesn't set the flag) and `packages/sdk` is doing
for the first time now that `zodGenerator` covers `api`.

## Decisions made

- **Part 1 scope**: `gen-zod` only — `buildImports`'s sibling-entity branch.
  Straightforward, same shape as the already-working `aliases` branch fix.
- **Part 2 scope**: `core`'s `synthesizeRootBarrels` — bigger question, since
  `core` currently has no per-declaration "is this a type or a value" metadata
  at all (`VirtualFile`/`GenOutput` carry file content, not a symbol table);
  it would need each generator to report that alongside its files, or the
  barrel synthesizer would need to sniff generated source text. Not designed
  yet — see `technical.md`.
- Not yet decided: priority against
  [gen-zod-where-schema-empty-base-type-mismatch](../gen-zod-where-schema-empty-base-type-mismatch/overview.md),
  the third bug found in the same session.
