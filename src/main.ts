import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule, ObserveInstrument } from './app.module.js';
import { configureApp } from './app.setup.js';
import { setupSwagger } from './config/swagger.config.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: process.env.OBSERVE_APP_KEY ? ObserveInstrument : undefined,
  });

  configureApp(app);
  setupSwagger(app);
  app.enableCors();

  const port = app.get(ConfigService).get<number>('port') ?? 3000;
  await app.listen(port);
  console.log(`Bulir Core API listening on http://localhost:${port}`);
}

await bootstrap();
