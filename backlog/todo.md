<!-- backlog-sync 2026-09-14T13:08Z — GENERATED, do not hand-edit. Regenerate: skill backlog-sync -->

# Backlog

## OpenAPI generator ·  [overview](features/gen-openapi/overview.md)

_**Status**: [technical design](technical.md)_ — 4/4 tasks done

| Done | Issue                                                  | Title                                                             | Blocked by |
|------|--------------------------------------------------------|-------------------------------------------------------------------|------------|
| [x]  | [#145](https://github.com/marmotz/kurotako/issues/145) | gen-openapi: scaffold the @kurotako/gen-openapi package           | —          |
| [x]  | [#146](https://github.com/marmotz/kurotako/issues/146) | gen-openapi: field-type, constraints and nullability mapping      | #145       |
| [x]  | [#147](https://github.com/marmotz/kurotako/issues/147) | gen-openapi: document assembly (entities, typeAliases, relations) | #146       |
| [x]  | [#148](https://github.com/marmotz/kurotako/issues/148) | gen-openapi: serialization, artifact and driver wiring            | #147       |

## Bug: generated relative imports are missing

`.js` extensions ·  [overview](bugs/generated-imports-missing-js-extensions/overview.md)

_**Status**: technical design ready — see [`technical.md`](technical.md)_ — 5/5 tasks done

| Done | Issue                                                  | Title                                                                                          | Blocked by |
|------|--------------------------------------------------------|------------------------------------------------------------------------------------------------|------------|
| [x]  | [#154](https://github.com/marmotz/kurotako/issues/154) | core: add jsFile/jsIndex helper for extension-qualified relative specifiers                    | —          |
| [x]  | [#155](https://github.com/marmotz/kurotako/issues/155) | core: qualify synthesized root barrel specifiers with jsIndex, update mode-B tsconfig guidance | #154       |
| [x]  | [#156](https://github.com/marmotz/kurotako/issues/156) | gen-typescript: qualify emitted relative specifiers with jsFile                                | #154       |
| [x]  | [#157](https://github.com/marmotz/kurotako/issues/157) | gen-zod: qualify emitted relative specifiers with jsFile                                       | #154       |
| [x]  | [#158](https://github.com/marmotz/kurotako/issues/158) | gen-angular: qualify emitted relative barrel specifiers with jsFile                            | #154       |

## OpenAPI parser (`@kurotako/parser-openapi`)  ·  [overview](features/parser-openapi/overview.md)

_**Status**: [technical design](technical.md)_ — 7/7 tasks done

| Done | Issue                                                  | Title                                                                                     | Blocked by             |
|------|--------------------------------------------------------|-------------------------------------------------------------------------------------------|------------------------|
| [x]  | [#134](https://github.com/marmotz/kurotako/issues/134) | feat(ir): add typed map support to IR v3                                                  | —                      |
| [x]  | [#135](https://github.com/marmotz/kurotako/issues/135) | feat(gen-zod): emit typed maps and catch-all objects                                      | #134                   |
| [x]  | [#136](https://github.com/marmotz/kurotako/issues/136) | feat(gen-typescript): render typed map declarations                                       | #134                   |
| [x]  | [#137](https://github.com/marmotz/kurotako/issues/137) | feat(gen-angular): support typed map controls                                             | #134, #135             |
| [x]  | [#138](https://github.com/marmotz/kurotako/issues/138) | feat(parser-openapi): scaffold driver and resolve documents                               | —                      |
| [x]  | [#139](https://github.com/marmotz/kurotako/issues/139) | feat(parser-openapi): map component schemas to IR v3                                      | #134, #138             |
| [x]  | [#140](https://github.com/marmotz/kurotako/issues/140) | feat(parser-openapi): synthesize operation payload schemas and prove pipeline integration | #135, #136, #137, #139 |

## Bug:

`@kurotako/parser-prisma` (version-8 mode) confuses storage column names with model field
names ·  [overview](bugs/parser-prisma-v8-index-field-names/overview.md)

_**Status**: technical design done, see [`technical.md`](technical.md) — fix not started_ — 1/1 tasks done

| Done | Issue                                                  | Title                                                                                                                                 | Blocked by |
|------|--------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------|------------|
| [x]  | [#159](https://github.com/marmotz/kurotako/issues/159) | parser-prisma: contract mode confuses storage column names with domain field names (indexes, uniques, primaryKey, isUnique, FK match) | —          |

## Bug: `@kurotako/gen-zod` emits invalid syntax for a non-trailing
`unknown`-hint field ·  [overview](bugs/gen-zod-unknown-hint-comment-swallows-comma/overview.md)

_**Status**: reported — root cause found, fix not started_ — 1/1 tasks done

| Done | Issue                                                  | Title                                                                            | Blocked by |
|------|--------------------------------------------------------|----------------------------------------------------------------------------------|------------|
| [x]  | [#163](https://github.com/marmotz/kurotako/issues/163) | gen-zod: fix comma swallowed by unknown-hint trailing comment in object emission | —          |
