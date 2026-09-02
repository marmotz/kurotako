# 0001 - Project name, npm scope, CLI binary

**Status**: Accepted

**Date**: 2026-09-01

## Context

The project needs a name with character, free on npm, and declinable as a package scope. A purely descriptive name (e.g.
built around "schema" or "bridge") would be generic and carry the "yet another Prisma → Zod bridge" connotation. Chosen
metaphor: an octopus (a central body, semi-autonomous arms that each act on their own) reflects the target architecture
(a `core` + independent `generators`).

## Decision

- Project name: **kurotako** (黒蛸, "black octopus" in Japanese).
- npm scope: **`@kurotako/*`** (`@kurotako/core`, `@kurotako/ir`, `@kurotako/cli`,
  `@kurotako/parser-prisma`, `@kurotako/gen-zod`, `@kurotako/gen-angular`, ...).
- CLI binary: **`tako`** (short, typed often).

npm availability checked on 2026-09-01: `kurotako` is free unscoped and the `@kurotako`
scope is free.

## Consequences

### Positive

- Distinctive, free name, with a story consistent with the architecture.
- `tako` as the binary stays short without polluting the brand name.

### Negative / costs

- Pronunciation not obvious for a non-Japanese audience ("koo-ro-ta-ko").
- "tako" can be read as a typo of "taco".

### Neutral

- Requires reserving the `@kurotako` scope and the `tako` binary early.

## Rejected alternatives

- **facet / graft / conflux**: too generic or connoted (facet evokes faceted search).
- **okto, oktopus, octarine, tako (plain), kraken, nautilus, argonaut**: taken on npm or heavily squatted.
- **sumitako** ("ink octopus"): a stronger metaphor (ink = the emitted code) but the sound was judged worse.
