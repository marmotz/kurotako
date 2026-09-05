import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'apps/backend/prisma/schema.prisma',
  migrations: {
    path: 'apps/backend/prisma/migrations',
  },
  datasource: {
    url: 'file:./apps/backend/prisma/dev.db',
  },
});
