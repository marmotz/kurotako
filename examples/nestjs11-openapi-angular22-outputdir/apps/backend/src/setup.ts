import { type INestApplication, ValidationPipe } from '@nestjs/common';

/**
 * Shared application wiring so `main.ts` (runtime) and the e2e tests configure
 * the app identically.
 */
export function configureApp(app: INestApplication): void {
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
}
