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
- **`dependsOn`**: a generator's declaration of the other generators whose artifacts it consumes. The core derives a
  topological order from it.
- **artifact**: what a generator exposes to its dependents (generated files, exported symbols, manifest). Exact shape:
  not frozen.
- **mode A / mode B**: output strategies — a directory inside the project (A, default) vs an npm package per source (B).
- **additional generator**: a generator beyond the frontend/validation need (OpenAPI, SDK, factories). Out of v1, but
  the IR must not rule it out.
