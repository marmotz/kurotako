<!-- backlog-sync 2026-09-17T20:03Z — GENERATED, do not hand-edit. Regenerate: skill backlog-sync -->

# Backlog

## CLI self-update check  ·  [overview](features/cli-self-update/overview.md)

_**Status**: see [technical.md](technical.md)_ — 2/2 tasks done

| Done | Issue | Title | Blocked by |
|------|-------|-------|------------|
| [x]  | [#171](https://github.com/marmotz/kurotako/issues/171) | Background version check for the tako binary | — |
| [x]  | [#172](https://github.com/marmotz/kurotako/issues/172) | tako outdated: on-demand check of installed @kurotako/* packages | #171 |

## Bugs

### parser-openapi maps an inline string-enum property to `unknown`, not a union type  ·  [overview](bugs/openapi-inline-enum-unknown/overview.md)

_**Status**: [technical design](technical.md)_ — 1/1 tasks done

| Done | Issue | Title | Blocked by |
|------|-------|-------|------------|
| [x]  | [#183](https://github.com/marmotz/kurotako/issues/183) | parser-openapi: synthesize a name for inline string enums instead of falling back to unknown | — |

### gen-typescript rejects every named enum as colliding with its own self-alias  ·  [overview](bugs/typescript-enum-self-alias-collision/overview.md)

_**Status**: [technical.md](technical.md)_ — 4/4 tasks done

| Done | Issue | Title | Blocked by |
|------|-------|-------|------------|
| [x]  | [#186](https://github.com/marmotz/kurotako/issues/186) | ir: add nonRedundantTypeAliases helper for enum self-alias exclusion | — |
| [x]  | [#187](https://github.com/marmotz/kurotako/issues/187) | gen-openapi: migrate self-alias exclusion to the shared IR helper | #186 |
| [x]  | [#188](https://github.com/marmotz/kurotako/issues/188) | gen-typescript: stop rejecting a named enum's own self-alias as a collision | #186 |
| [x]  | [#189](https://github.com/marmotz/kurotako/issues/189) | gen-zod: stop emitting a colliding export and a phantom artifact entry for an enum self-alias | #186 |

### gen-zod emits a string literal instead of a bigint literal for a BigInt field default  ·  [overview](bugs/zod-bigint-default-string/overview.md)

_**Status**: [technical design](technical.md)_ — 4/4 tasks done

| Done | Issue | Title | Blocked by |
|------|-------|-------|------------|
| [x]  | [#175](https://github.com/marmotz/kurotako/issues/175) | ir: add defaultValueExpr shared helper for bigint literal defaults | — |
| [x]  | [#176](https://github.com/marmotz/kurotako/issues/176) | gen-zod: render bigint literal default as an unquoted bigint literal | #175 |
| [x]  | [#177](https://github.com/marmotz/kurotako/issues/177) | gen-angular: seed a bigint FormControl's literal default as a bigint, not a string | #175 |
| [x]  | [#178](https://github.com/marmotz/kurotako/issues/178) | gen-typescript: render @default JSDoc tag for a bigint field as a bigint literal | #175 |
