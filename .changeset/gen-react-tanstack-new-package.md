---
'@kurotako/gen-react-tanstack': minor
---

New package: a generator that emits one typed React + TanStack Form hook per entity
(`use<Entity>Form`), validated by the Zod schemas of a private `@kurotako/gen-zod` copy
emitted under `<namespace>/react-tanstack/zod/`. Options: `zodVersion`, `include`,
`variants` (`full` / `create` / `update`) and `relations` (`flat` / `deep`).
