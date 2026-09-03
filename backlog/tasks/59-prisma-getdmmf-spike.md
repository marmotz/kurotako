# spike — verify `getDMMF` from `@prisma/internals` before building the Prisma parser

**Status**: done **Type**: spike **Issue**: [#59](https://github.com/marmotz/kurotako/issues/59)

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

Done. Findings written into
[parser-prisma/technical.md §Spike #59 findings](../features/parser-prisma/technical.md#spike-59-findings-getdmmf)
and [#28 Verified](28-prisma-dmmf-reader.md#verified-spike-59); [#26](26-prisma-parser-scaffold.md)
peer entry updated. [#26](26-prisma-parser-scaffold.md) / [#28](28-prisma-dmmf-reader.md)
unblocked.

### Results

1. **`getDMMF` is present, WASM-based, usable.** Verified against `@prisma/internals`
   5.22 / 6.19 / 7.10 and `8.1.0-dev.6`. Parses via bundled `prisma-schema-wasm` — no
   engine binary, no network at the call. No fallback (PSL parse / early contract mode)
   needed.
2. **Call contract** (`GetDMMFOptions`, stable v5–v7):
   `getDMMF({ datamodel: string | Array<[filename, content]> })`. Multi-file = the tuple
   array, file order irrelevant. `datamodelPath` removed after v5, `previewFeatures` after
   v6, `datasourceOverrides` not accepted in v7 — pass none.
3. **CJS-only**: named ESM import fails under Node; resolve dynamically from `ctx.cwd`
   (`require.resolve` + `import` / `createRequire`).
4. **Error shape**: `GetDmmfError extends Error`, `name === 'GetDmmfError'`, P1012 text in
   `.message`, no structured fields → `PrismaSchemaError` wraps `message` + `cause`.
5. **Peer range: `>=5 <8`.** Prisma 8 is unreleased; `8.1.0-dev` still ships `getDMMF` but
   the contract mode stays the plan for 8.
6. **Prisma 7 CLI restructure**: `prisma` + `@prisma/client` v7 no longer pull
   `@prisma/internals` (new `@prisma/orm-framework` contract/PSL model; no
   `prisma-schema-wasm` in the tree). The peer resolves on v7 **only if the user adds
   `@prisma/internals` explicitly**. Decision (with maintainer): keep the peer
   (`peerDependenciesMeta.optional`), `PrismaPeerMissingError` + hint
   `add @prisma/internals@<major> as a devDependency` is the nominal v7 path. Prisma 5–6
   unaffected. `@prisma/client`-only projects hit the same hint on every major.
7. **DMMF gaps confirmed** (not conditional): no `DMMF.Model.indexes` → non-unique
   `@@index` lost; no field-level `@map`. `nativeType` is `[name, string[]] | null`.
   `Unsupported("…")` fields were **absent** from `doc.datamodel` in the v7 spike —
   [#29](29-prisma-scalar-mapping.md) must re-verify.
8. **Install caveat**: `@prisma/internals` pulls `@prisma/engines`, whose `postinstall`
   downloads a ~24 MB `schema-engine` binary (unused by `getDMMF`). Noted for the hint;
   not kurotako's to fix.

Scratch scripts were run outside the repo; nothing committed to any package.

## Dependencies

- None. **Blocked [#26](26-prisma-parser-scaffold.md)** — now resolved.
