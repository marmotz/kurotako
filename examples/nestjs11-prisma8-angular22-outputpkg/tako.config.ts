import { defineConfig } from '@kurotako/config';
import { angularGenerator } from '@kurotako/gen-angular';
import { openapiGenerator } from '@kurotako/gen-openapi';
import { typescriptGenerator } from '@kurotako/gen-typescript';
import { zodGenerator } from '@kurotako/gen-zod';
import { prismaParser } from '@kurotako/parser-prisma';

export default defineConfig({
  sources: {
    tasks: {
      use: prismaParser,
      options: {
        schema: './apps/backend/prisma/generated/contract.json',
        version: 8,
        // A contract carries no doc comments, so the field is listed here instead of
        // being marked `/// @kurotako.hidden` in contract.prisma.
        hidden: { User: ['passwordHash'] },
      },
    },
  },
  generators: [
    // Prisma 8 reads and writes `DateTime` columns as `Temporal.Instant`, so the
    // generated types and schemas use it too (see `dateType`). `Temporal` must exist at
    // runtime (Node 26+, or a polyfill) and its types in the compiler: tsconfig.base.json
    // pulls them from `temporal-spec`.
    { use: typescriptGenerator, options: { dateType: 'temporal' } },
    // Kept on purpose: the apps import `@example/tasks/zod` themselves. `angularGenerator`
    // no longer needs this entry: it embeds its own private Zod copy under
    // `<namespace>/angular/zod/`.
    { use: zodGenerator, options: { zodVersion: 4, dateType: 'temporal' } },
    {
      use: angularGenerator,
      options: { forms: ['reactive', 'signal'], relations: 'deep' },
    },
    { use: openapiGenerator },
  ],
  outputs: [
    {
      mode: 'package',
      packagesDir: './packages',
      scope: '@example',
      packageManager: 'bun',
      generators: ['typescript', 'zod', 'angular'],
    },
    // The generated openapi.json is a backend-side artifact (the backend is
    // the contract producer), kept out of the shared @example/tasks package.
    { dir: './apps/backend/generated/kurotako', generators: ['openapi'] },
  ],
});
