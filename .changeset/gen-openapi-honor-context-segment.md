---
'@kurotako/gen-openapi': minor
---

`openapiGenerator` now emits `<namespace>/<segment>/openapi.<ext>` and publishes the
same module in its artifact from `ctx.segment` instead of a hardcoded `openapi`, so it
can run as a private dependency of another generator. As a top-level generator the
segment is still `openapi` and the output is unchanged.
