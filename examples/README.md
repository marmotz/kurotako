# kurotako examples

End-to-end example projects consuming the published (or locally linked) kurotako
packages from a real NestJS + Angular stack. Each project is a fully standalone Bun
workspace — not part of the root repo's `workspaces` array — with its own `README.md`
covering setup and run steps.

| Project                                                                          | Parser / source of truth        | Output mode                              |
|----------------------------------------------------------------------------------|---------------------------------|------------------------------------------|
| [`nestjs11-prisma7-angular22-outputdir/`](nestjs11-prisma7-angular22-outputdir/) | Prisma 7 (DMMF)                 | `dir` (one destination per app)          |
| [`nestjs11-prisma7-angular22-outputpkg/`](nestjs11-prisma7-angular22-outputpkg/) | Prisma 7 (DMMF)                 | `package` (one shared workspace package) |
| [`nestjs11-prisma8-angular22-outputdir/`](nestjs11-prisma8-angular22-outputdir/) | Prisma 8 (contract.json)        | `dir` (one destination per app)          |
| [`nestjs11-prisma8-angular22-outputpkg/`](nestjs11-prisma8-angular22-outputpkg/) | Prisma 8 (contract.json)        | `package` (one shared workspace package) |
| [`nestjs11-openapi-angular22-outputdir/`](nestjs11-openapi-angular22-outputdir/) | OpenAPI 3.0 (`@nestjs/swagger`) | `dir` (one destination per app)          |
| [`nestjs11-openapi-angular22-outputpkg/`](nestjs11-openapi-angular22-outputpkg/) | OpenAPI 3.0 (`@nestjs/swagger`) | `package` (one shared workspace package) |

See each project's own `README.md` for the `bun link` setup sequence, the source
workflow, and `tako generate` / run commands.

- **Prisma 8** examples require PostgreSQL and a `DATABASE_URL`.
- **OpenAPI** examples need no database: the NestJS app is the contract producer (its
  `@nestjs/swagger` DTOs emit `openapi.json`) and only the frontend consumes generated
  code.
