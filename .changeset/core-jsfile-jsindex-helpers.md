---
'@kurotako/core': minor
---

New exports `jsFile` and `jsIndex`: pure helpers that append `.js` (sibling file) or
`/index.js` (sibling directory barrel) to a relative specifier. Generators use them to
build relative import/export specifiers that satisfy `moduleResolution: node16`/`nodenext`,
which requires an explicit extension on every relative specifier.
