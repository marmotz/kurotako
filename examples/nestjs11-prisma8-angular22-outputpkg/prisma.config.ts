import { definePrismaConfig } from 'prisma/config';
import { defineConfig as defineOrmConfig } from '@prisma/orm-postgres/config';

export default definePrismaConfig({
  orm: defineOrmConfig({
    contract: './apps/backend/prisma/contract.prisma',
    output: './apps/backend/prisma/generated',
    db: { connection: process.env.DATABASE_URL },
  }),
});
