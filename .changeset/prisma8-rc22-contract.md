---
'@kurotako/parser-prisma': patch
---

Support the Prisma 8 `8.0.0-rc.22` contract format (`execution.mutations.defaults[].ref` is now `{ namespace, entry, field }` instead of `{ namespace, table, column }`); both formats are read. Also fix generator defaults (`@default(uuid())`, `@updatedAt`) being ignored when reading a contract.
