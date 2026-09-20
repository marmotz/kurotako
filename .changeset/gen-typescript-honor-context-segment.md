---
'@kurotako/gen-typescript': minor
---

`typescriptGenerator` now derives its output prefix and every module specifier it
publishes (`artifact.entities[*].module`, `extra.perNamespace[*]`, enum modules) from
`ctx.segment` instead of a hardcoded `typescript`, so it can run as a private
dependency of another generator. As a top-level generator the segment is still
`typescript` and the output is unchanged. The `names.ts` module helpers and
`buildArtifact` take the segment as an extra argument.
