import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { OpenAPIObject } from '@nestjs/swagger';
import { NewTask, Project, Task, User } from './tasks/dto';

/**
 * Builds the OpenAPI document for this app. Used both to serve Swagger UI in
 * `main.ts` and to write `openapi.json` in `scripts/emit-openapi.ts`.
 */
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Tasks API')
    .setDescription('OpenAPI contract consumed by kurotako in this example.')
    .setVersion('1.0.0')
    .build();

  return SwaggerModule.createDocument(app, config, {
    extraModels: [Project, User, Task, NewTask],
  });
}
