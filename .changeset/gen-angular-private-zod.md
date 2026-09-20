---
'@kurotako/gen-angular': minor
---

`angularGenerator` now embeds its own private copy of `@kurotako/gen-zod` instead
of requiring a `zod` entry in the config. The Zod schemas it imports are emitted
under `<namespace>/angular/zod/`, so the generated imports become
`<namespace>/angular/zod/...`. `@kurotako/gen-zod` moves from `peerDependencies`
to `dependencies`, and the Zod peer range is merged into the package's
`peerDependencies` in output mode B.

New option `zodVersion` (`3 | 4`, default `4`) selects the Zod API flavor of that
private copy, replacing the `zodVersion` previously set on the `zod` entry.

Migration: remove `zodGenerator` from your config unless your own code imports
`<namespace>/zod`; keeping it produces two copies (accepted). If you set
`zodVersion: 3` on the `zod` entry, set it on the `angular` entry instead. Update
any `outputs[].generators` filter that listed `zod` only for angular's sake.
