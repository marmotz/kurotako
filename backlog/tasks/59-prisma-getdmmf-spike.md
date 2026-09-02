# spike — verify `getDMMF` from `@prisma/internals` before building the Prisma parser

**Status**: to do **Type**: spike **Issue**: [#59](https://github.com/marmotz/kurotako/issues/59)

Reference: [../features/parser-prisma/technical.md §Prisma ≤ 7 mode — DMMF acquisition](../features/parser-prisma/technical.md#prisma--7-mode--dmmf-acquisition-dmmfloadts)
and [§Dependencies](../features/parser-prisma/technical.md#dependencies).

## Why

The entire v1 parser rests on `getDMMF` being available in `@prisma/internals`, WASM-based
(no engine binary, no post-install download, no network at parse time), and callable with
an in-memory multi-file datamodel. [parser-prisma/technical.md](../features/parser-prisma/technical.md)
marks the exact call shape and the supported version range as "pinned in the implementation
task". The peer range it states (`>=5 <9`) also contradicts "Prisma ≤ 7 mode" — Prisma 8
drops the DSL/DMMF model for `contract.json`. Resolve this with a throwaway spike **before
#26**, not mid-implementation.

## To do

1. In a scratch script (not committed to any package), install a recent `@prisma/internals`
   and confirm:
   - `getDMMF` is exported and is the documented programmatic entry;
   - it parses a schema **string** with no engine binary, no post-install step, no network
     at call time (`prisma-schema-wasm` only);
   - the multi-file call shape for `prismaSchemaFolder`: array of `[path, content]` tuples
     vs `datamodelPath` vs a `{ [path]: content }` map — record the exact accepted shape;
   - `datasourceOverrides` / `previewFeatures` are genuinely optional;
   - a schema syntax error throws — capture the error shape for `PrismaSchemaError` wrapping.
2. Confirm which Prisma majors still ship a DMMF-capable `@prisma/internals` (expected
   `>=5 <8`; Prisma 8 = the deferred `contract.json` mode). Pin the real
   `peerDependencies` range for `@kurotako/parser-prisma`.
3. Check what a project depending only on `@prisma/client` (no `prisma` devDependency)
   resolves for `@prisma/internals` — i.e. how often `PrismaPeerMissingError` is the
   nominal path, and whether the install hint should point at `prisma` or
   `@prisma/internals`.
4. Write the findings into [parser-prisma/technical.md](../features/parser-prisma/technical.md)
   (peer range, call shape, error shape) and adjust
   [#28](28-prisma-dmmf-reader.md)'s "To do" if the call shape differs from the sketch.

## Outcome

A pinned `@prisma/internals` version range and call contract in
`parser-prisma/technical.md`; [#26](26-prisma-parser-scaffold.md) / [#28](28-prisma-dmmf-reader.md)
unblocked. If `getDMMF` turns out to be removed or unusable, this spike surfaces it before
any parser code is written (fallbacks: a light PSL parse, or bringing the Prisma 8
`contract.json` mode forward).

## Dependencies

- None. **Blocks [#26](26-prisma-parser-scaffold.md).**
