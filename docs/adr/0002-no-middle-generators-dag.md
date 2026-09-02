# 0002 - No "middle" stage: generators in a DAG

**Status**: Accepted

**Date**: 2026-09-01

## Context

A 3-stage pipeline is a tempting model: input (schema → IR), **middle** (validation / DTO, e.g. Zod), output (frontend,
e.g. Angular). But the real dependencies do not support it:

- Zod generates its schemas from the IR alone.
- The Angular generator can generate its own Angular `Validators` directly from the IR, without going through Zod.

The "middle" is therefore not a stage: it is one output among others. The only real link is that a generator may want to
**reuse** another's code (Angular importing the Zod DTOs for runtime validation, a single client/server source of
truth).

## Decision

Only two driver roles: `parser` and `generator`. No "middle" stage.

Generators form a **directed acyclic graph**. Each generator declares
`dependsOn?: string[]`. The `core` computes a topological order and passes each generator the IR plus a handle to the
artifacts of its dependencies.

- **Hard** dependency: dependency absent from the config → the core rejects with an explicit message.
- **Optional** dependency: the generator adapts its output based on the presence of the dependency (Angular: reuses the
  Zod DTOs if present, generates its `Validators` from the IR otherwise).

## Consequences

### Positive

- Simpler mental model (2 concepts).
- Further generators (OpenAPI, SDK, factories) become first-class.
- Matches the "interchangeable drivers" pitch, no rigid pipeline.

### Negative / costs

- Loss of the "source / validation / output" teaching breakdown.
- The artifact exchange contract between generators remains to be defined (open question).
- The core must detect cycles and produce clear error messages.

### Neutral

- The config lists generators flat; the order is derived, not declared.

## Rejected alternatives

- **Keep 3 fixed stages**: needlessly constrains the design space, makes further generators second-class.
- **Optional middle stage**: a half-measure; an Angular generator without Zod then has no middle stage, the abstraction
  leaks.
