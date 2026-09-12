import { defineConfig } from '@kurotako/config';
import { angularGenerator } from '@kurotako/gen-angular';
import { openapiGenerator } from '@kurotako/gen-openapi';
import { zodGenerator } from '@kurotako/gen-zod';
import { prismaParser } from '@kurotako/parser-prisma';

export default defineConfig({
  sources: {
    tasks: {
      use: prismaParser,
      options: { schema: './apps/backend/prisma/generated/contract.json', version: 8 },
    },
  },
  generators: [
    { use: zodGenerator, options: { zodVersion: 4 } },
    {
      use: angularGenerator,
      options: { forms: ['reactive', 'signal'], relations: 'flat' },
    },
    { use: openapiGenerator },
  ],
  outputs: [
    // The backend also gets the generated openapi.json: it is the contract
    // producer, so the spec documenting it is a backend-side artifact.
    { dir: './apps/backend/generated/kurotako', generators: ['zod', 'openapi'] },
    { dir: './apps/frontend/generated/kurotako', generators: ['zod', 'angular'] },
  ],
});
