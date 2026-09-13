---
'@kurotako/gen-angular': patch
---

The two relative specifiers emitted by this generator's barrel (`./zod-forms.runtime`,
`./<entity>.form`) now carry an explicit `.js` extension, so the generated code compiles
under `moduleResolution: node16`/`nodenext` (previously `TS2307`/`TS2835`).
