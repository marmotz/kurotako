# Monorepo bootstrap

**Status**: in discussion — technical design: [technical.md](technical.md)

## Context

The project has no code. Before writing anything, we need the monorepo structure, the
shared tooling (build, tests, lint, typecheck), the versioning convention and a basic CI.
Every `@kurotako/*` package depends on it.

## Goal

A monorepo ready to host the `@kurotako/core`, `ir`, `cli`, `parser-*`, `gen-*` packages,
with build, tests, lint and typecheck each running in a single command at the root, and a
CI ready to activate as soon as the GitHub repo is created.

## Decisions made

- npm scope `@kurotako/*`, `tako` binary ([docs/vision.md](../../../../docs/vision.md)).
- Initial packages: `core`, `ir`, `config`, `cli`, `parser-prisma`, `gen-zod`,
  `gen-angular` ([docs/architecture.md](../../../../docs/architecture.md);
  `config` added by [config-system](../config-system/technical.md)).
- **Package manager**: Bun workspaces (install + workspace resolution + scripts). Bun is
  not a mandated runtime: the code and the `tako` binary target Node **and** Bun; tests
  run under vitest, the build under tsup.
- **Build**: tsup per package.
- **Package output**: dual ESM + CJS, with types (`.d.ts`).
- **Test runner**: vitest (snapshot testing used later for the generated code).
- **Lint + format**: Biome (single tool).
- **TypeScript**: shared `tsconfig.base.json` + project references; incremental typecheck
  via `tsc -b`. Conservative emit target (`target` ES2022, `module`/`moduleResolution`
  NodeNext) to stay broadly consumable; no bleeding-edge TS syntax imposed on consumers.
- **Supported Node versions**: the latest LTS and the following ones. As of 2026-09-01:
  Node 24 (`engines.node` = `">=24"`). To be reassessed at each new LTS.
- **Versioning / publishing**: changesets.
- **License**: MIT.
- **CI**: GitHub Actions workflow (`install → typecheck → lint → test → build`) on
  `marmotz/kurotako`; the release workflow stays disabled until packages leave `0.0.0`.
- **Layout**: `packages/<short-name>` (`packages/ir`, `packages/parser-prisma`...);
  `package.json` `name` = `@kurotako/<short-name>`.

## Open questions

Resolved in [technical.md](technical.md): `lib` ES2023 / TS >= 5.5 floor; independent
changesets versioning; `dist/` not committed; Biome recommended + lefthook pre-commit;
meta files (MIT `LICENSE`, `README`, `CONTRIBUTING`, Contributor Covenant, `.editorconfig`).

Left for implementation time: exact tool version pins; `pre-commit` vs `pre-push` for
typecheck; `LICENSE` copyright holder string.

## Depends on

Nothing. Prerequisite of every other feature.
