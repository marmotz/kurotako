import { Injectable } from '@nestjs/common';
import postgres from '@prisma/orm-postgres/runtime';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Contract } from '../../prisma/generated/contract.d.js';

const contractJson = JSON.parse(
  readFileSync(join(__dirname, '../../prisma/generated/contract.json'), 'utf8'),
);

@Injectable()
export class PrismaService {
  readonly db = postgres<Contract>({
    contractJson,
    url: process.env.DATABASE_URL,
  });
}
