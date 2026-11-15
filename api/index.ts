import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express, { type Express, type Request, type Response } from 'express';
import { AppModule, ObserveInstrument } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { setupSwagger } from '../src/config/swagger.config.js';

let cachedServer: Express;

async function bootstrap(): Promise<Express> {
  if (!cachedServer) {
    const expressApp = express();
    const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp), {
      instrument: process.env.OBSERVE_APP_KEY ? ObserveInstrument : undefined,
    });
    configureApp(app);
    setupSwagger(app);
    expressApp.set('trust proxy', 1); // IP real atrás do proxy (rate limiting)
    app.enableCors();
    await app.init();
    cachedServer = expressApp;
  }
  return cachedServer;
}

export default async function handler(req: Request, res: Response) {
  const server = await bootstrap();
  return server(req, res);
}
