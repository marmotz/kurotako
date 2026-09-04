---
"@kurotako/core": minor
"@kurotako/config": minor
"@kurotako/cli": patch
---

Support multiple output destinations in one `tako generate` run. `ResolvedConfig.output` /
`TakoConfig.output` (singular, optional) are replaced by `ResolvedConfig.outputs` /
`TakoConfig.outputs` (array, required — no implicit single-output default). Each entry may
restrict itself to a subset of the configured generators via `generators?: string[]`
(default: all). `RunResult` gains `written: { output; files }[]`, one entry per
`config.outputs[]`. `@kurotako/config` adds `UnknownGeneratorError` when an
`outputs[i].generators` entry names a generator absent from `generators`.

This is a breaking change: existing `tako.config.ts` files must rename `output: {...}` to
`outputs: [{...}]`.
