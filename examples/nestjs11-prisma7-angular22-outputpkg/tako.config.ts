import { defineConfig } from '@kurotako/config';
import { angularGenerator } from '@kurotako/gen-angular';
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
  ],
  outputs: [
    {
      mode: 'package',
      packagesDir: './packages',
      scope: '@example',
      packageManager: 'bun',
    },
  ],
});
