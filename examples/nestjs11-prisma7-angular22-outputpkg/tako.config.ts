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
      options: { schema: './apps/backend/prisma/schema.prisma', version: 7 },
    },
  },
  generators: [
    { use: typescriptGenerator },
    { use: zodGenerator, options: { zodVersion: 4 } },
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
