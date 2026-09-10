import { NestFactory } from '@nestjs/core';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AppModule } from '../src/app.module';
import { buildOpenApiDocument } from '../src/openapi';

/**
 * Boots the Nest application without listening, serialises its OpenAPI document
 * to `apps/backend/openapi.json`, and exits. `openapi.json` is committed and is
 * the input of `tako generate` (see the root `tako.config.ts`). Re-run this
 * after every change to a controller or a DTO, before regenerating.
 */
async function emit() {
  const app = await NestFactory.create(AppModule, { logger: false });
  const document = buildOpenApiDocument(app);
  const target = join(__dirname, '..', 'openapi.json');
  writeFileSync(target, `${JSON.stringify(document, null, 2)}\n`);
  await app.close();
  console.log(`wrote ${target}`);
}

emit();
