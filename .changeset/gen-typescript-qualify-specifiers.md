---
'@kurotako/gen-typescript': patch
---

Every relative import/export specifier emitted by this generator (`./aliases`,
`./enums`, `./filters`, `./scalars`, `./<entity>.type`) now carries an explicit `.js`
extension, so the generated code compiles under `moduleResolution: node16`/`nodenext`
(previously `TS2307`/`TS2835`).
