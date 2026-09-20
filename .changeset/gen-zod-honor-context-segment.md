---
'@kurotako/gen-zod': minor
---

`zodGenerator` now derives its output prefix and every module specifier it publishes
(`artifact.entities[*].module`, `extra.perNamespace[*]`, enum modules) from
`ctx.segment` instead of a hardcoded `zod`. As a top-level generator the segment is
still `zod`, so the output is unchanged; when another generator runs it as a private
dependency the whole sub-tree and its specifiers move under that generator's segment
(for example `<ns>/angular/zod/...`). The `names.ts` module helpers and `buildArtifact`
take the segment as an extra argument.
