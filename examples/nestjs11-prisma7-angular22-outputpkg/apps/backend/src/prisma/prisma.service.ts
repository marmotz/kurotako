import { Injectable, type OnModuleInit } from '@nestjs/common';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../../generated/prisma/client.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    super({
      adapter: new PrismaBetterSqlite3({ url: 'file:./prisma/dev.db' }),
    });
  }

  async onModuleInit() {
    await this.$connect();
  }
}
