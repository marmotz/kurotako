# Architecture Decision Records (ADR)

Log of the project's structural choices. One ADR = one decision, its context, its consequences. Format inspired
by [MADR](https://adr.github.io/madr/).

| #                                           | Title                                                   | Status   |
|---------------------------------------------|---------------------------------------------------------|----------|
| [0001](0001-name-kurotako.md)               | Project name, npm scope, CLI binary                     | Accepted |
| [0002](0002-no-middle-generators-dag.md)    | No "middle" stage: generators in a DAG                  | Accepted |
| [0003](0003-multiple-parsers-namespaces.md) | Several parsers active, isolated by namespace           | Accepted |
| [0004](0004-ir-namespace-first.md)          | Namespace-first IR, deterministic generated identifiers | Accepted |
| [0005](0005-output-modes.md)                | Two output modes: directory or npm package              | Accepted |
| [0006](0006-parser-generator-vocabulary.md) | "parser" / "generator" vocabulary                       | Accepted |
| [0007](0007-english-only.md)                | English throughout the project                          | Accepted |

## Template

```markdown
# NNNN - Title

**Status**: Proposed | Accepted | Superseded by [ADR-XXXX] | Deprecated **Date**: YYYY-MM-DD

## Context

## Decision

## Consequences

### Positive

### Negative / costs

### Neutral

## Rejected alternatives
```
