# docs — reconcile `docs/architecture.md` and `docs/vision.md` with the locked feature designs

**Status**: to do **Type**: docs **Issue**: [#60](https://github.com/marmotz/kurotako/issues/60)

Reference: every feature `technical.md` "Consequences" section — each ends with a
"reconcile the prose when this lands (doc-only, not this phase)" note. This task collects
that debt.

## Why

The design phase locked many decisions in the feature `technical.md` files that now
contradict the root design docs. No single feature owns the cleanup. Do it **once the MVP
(`parser-prisma` + `gen-zod` + `gen-angular` + `cli`) is implemented** and the contracts
have stopped moving — not before, or the prose chases a moving target. Not on the critical
path.

## To do

### `docs/architecture.md`

1. §"Parsers" / §"Generators and DAG" — replace the draft `Parser` / `Generator` contracts
   with the final ones: `optionalDependsOn` added; no `ParseContext<Options>` /
   `GenerateContext<Options>` type parameters (config-system curries options away);
   `GenerateContext = { ir, dependencies, logger }`.
2. §"Generators and DAG" — `gen-angular`'s `zod` dependency is **hard**
   (`dependsOn: ['zod']`); there is no "generates its own `Validators` from the IR"
   fallback.
3. §"Namespaces and output" — the mode-A tree is
   `generated/kurotako/<ns>/{index.ts, zod/…, angular/…}` (one sub-tree per generator, core
   synthesizes `<ns>/index.ts`); fix the example tree.
4. §"Mode A" / §"Mode B" — config snippets are `.ts` (`defineConfig({ output: { … } })`),
   not YAML. Mode B: explicit tsup build step, frozen `version: "0.0.0"`.
5. §"CLI" — final command set: `init` / `generate` (`--watch`, `--dry-run`) / `validate` /
   `check` (drift-guard, post-v1), global `--config`. Note the `afterEmit`-formatter
   incompatibility with `tako check`.
6. Reconcile the artifact-handle prose with the settled `GeneratorArtifact`
   (`{ entities, peerDependencies?, extra? }`) — [vision.md](../../docs/vision.md) open
   question §3 is closed.

### `docs/vision.md`

7. §"Open questions" — remove or mark settled: §1 (config = `.ts`), §2 (`ScalarType`
   closed list), §3 (`dependsOn` contract = `GeneratorArtifact`), §4 (relations modelled in
   full), §5 (enums — both scopes), §6 (standalone CLI, watch yes, incremental no), §7
   (exclusive output owner, unconditional wipe), §8 (Bun / tsup / vitest / Biome /
   changesets), §9 (Angular ≥17 reactive / ≥20 signal, Zod-delegated validation), §10
   (fixture + structural assertions), §11 (GitHub repo created, issues exist).
8. §"Out of scope for v1" — Drift Guard stays out of v1 but is the first post-v1
   fast-follow (the feature is in the backlog).

### `docs/ir.md`

9. §"Open points" — close 1 (`@db.*` mapping — [parser-prisma](../features/parser-prisma/technical.md)),
   2 (`format` vocabulary — closed `StringFormat` union in
   [ir-model](../features/ir-model/technical.md)), 3 (cross-ref checks — the `validate.ts`
   table).

## Dependencies

- MVP features implemented. Not on the critical path.
