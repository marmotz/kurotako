---
'@kurotako/gen-zod': patch
---

Every relative import/export specifier emitted by this generator (`./enums`,
`./aliases`, `./filters`, `./<entity>.schema`) now carries an explicit `.js` extension,
so the generated code compiles under `moduleResolution: node16`/`nodenext` (previously
`TS2307`/`TS2835`).
