---
"@kurotako/parser-openapi": patch
"@kurotako/gen-typescript": patch
---

Fix a stale `@kurotako/ir` dependency range. The npm-published `@kurotako/parser-openapi@0.2.0` and `@kurotako/gen-typescript@0.3.0` declare `"@kurotako/ir": "^0.2.0"`, which excludes the `@kurotako/ir@0.3.0` release that shipped alongside them (the one adding the `array`/`map` field-type kinds and bumping the IR format to `'4'`). Both packages already require those kinds — an OpenAPI document with a top-level array response or an `additionalProperties` (map) schema fails IR validation when installed from npm today. Re-packing from the current source already resolves the workspace dependency to `^0.3.0`; this changeset only forces the patch release needed to publish that corrected tarball.
