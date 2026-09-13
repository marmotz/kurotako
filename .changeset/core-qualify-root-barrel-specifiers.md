---
'@kurotako/core': patch
---

The synthesized root barrel (`<namespace>/index.ts`) now qualifies every re-export
specifier with `/index.js` (`export * from './zod/index.js';` instead of
`export * from './zod';`), so it compiles under `moduleResolution: node16`/`nodenext`. The
mode-B `tsconfig.base.json` guidance no longer claims that setting requires
`moduleResolution: bundler`.
