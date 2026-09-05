# kurotako examples

End-to-end example projects consuming the published (or locally linked) kurotako
packages from a real NestJS + Angular + Prisma stack. Each project is a fully
standalone Bun workspace — not part of the root repo's `workspaces` array — with its
own `README.md` covering setup and run steps.

| Project                                                                          | Prisma parser version | Output mode                              |
|----------------------------------------------------------------------------------|-----------------------|------------------------------------------|
| [`nestjs11-prisma7-angular22-outputdir/`](nestjs11-prisma7-angular22-outputdir/) | 7 (DMMF)              | `dir` (one destination per app)          |
| [`nestjs11-prisma7-angular22-outputpkg/`](nestjs11-prisma7-angular22-outputpkg/) | 7 (DMMF)              | `package` (one shared workspace package) |

See each project's own `README.md` for the `bun link` setup sequence, Prisma
migrations, and `tako generate` / run commands.
