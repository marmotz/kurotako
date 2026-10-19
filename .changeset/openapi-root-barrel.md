---
'@kurotako/gen-openapi': patch
---

Remove `openapi` from the synthesized namespace root barrel. The `openapi` generator emits a single `openapi.json`/`openapi.yaml` document per namespace and no TypeScript module, so the generated `<namespace>/index.ts` referenced a `./openapi/index.js` that does not exist. The artifact now sets `exportFromRoot: false` (like `gen-angular` and `gen-react-tanstack`): the barrel no longer re-exports the `openapi` sub-tree.

Verified against prisma 8.0.0-rc.23 / `@prisma/orm-postgres` 8.0.0-rc.18: rc.23 emits contracts byte-identical to rc.22, so `@kurotako/parser-prisma` mode 8 keeps working unchanged with the latest Prisma 8 RCs (the prisma8 examples now pin those versions).
