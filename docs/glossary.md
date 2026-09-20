# Glossary

- **kurotako**: the project (black octopus, JP). A central body, semi-autonomous arms.
- **`tako`**: the CLI binary (package `@kurotako/cli`).
- **parser**: an input driver. Reads a schema source → partial IR under a namespace.
- **generator**: an output driver. Consumes the IR (+ dependencies) → code written to disk.
- **source**: a configured parser instance. Identified by its **config key**, which is also its **namespace**.
- **namespace**: a logical prefix isolating a source's entities in the IR, and the name of the output directory /
  package. Never changes the generated identifiers.
- **IR** (Intermediate Representation): a neutral representation of the schema (s), agnostic of the source and the
  target. See [ir.md](ir.md).
- **partial IR**: the portion of IR produced by a single parser (one `SourceIR`).
- **global IR**: the merge of all the partial IRs, keyed by namespace.
- **`dependsOn`**: a generator's declaration of the private generator instances it needs (descriptors `{ use, options? }`).
  The core runs each one for that generator alone, before it, into a nested sub-tree; there is no ordering between
  config entries.
- **segment**: the sub-tree under `<namespace>/` a generator emits into and builds its module specifiers from
  (`ctx.segment`): its name at the top level, `<parent>/<dependency>` for a private instance.
- **private instance**: a generator dependency run by core for its dependent only; its files live in the dependent's
  sub-tree and its artifact is not exposed at the top level.
- **artifact**: what a generator exposes to its dependents (generated files, exported symbols, manifest). Exact shape:
  not frozen.
- **mode A / mode B**: output strategies — a directory inside the project (A, default) vs an npm package per source (B).
- **additional generator**: a generator beyond the frontend/validation need (OpenAPI, SDK, factories). Out of v1, but
  the IR must not rule it out.
