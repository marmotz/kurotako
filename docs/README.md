# kurotako documentation

A modular open source framework for synchronizing TypeScript schemas, from the data model down to the frontend forms, by
way of a validation layer.

## Contents

- [Vision and positioning](vision.md) — the problem, the differentiator, the MVP scope.
- [Architecture](architecture.md) — parsers, generators, IR, dependency DAG, output modes.
- [Intermediate representation (IR)](ir.md) — the IR format.
- [Glossary](glossary.md) — the project's vocabulary.

## Project status

MVP implemented (`parser-prisma` + `gen-zod` + `gen-angular` + `cli`, plus the `kurotako`
meta-package). Decisions are recorded in [vision.md](vision.md#decisions-already-made) and
[vision.md](vision.md#resolved-questions); the design history lives in
`backlog/_archives/features/`.
