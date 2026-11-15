import { INestApplication, ValidationPipe } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { ResponseInterceptor } from './common/interceptors/response.interceptor.js';

/**
 * Configuração global partilhada entre o bootstrap (main.ts) e os testes,
 * garantindo que os testes correm com o mesmo comportamento da produção.
 */
export function configureApp(app: INestApplication): INestApplication {
  // Cabeçalhos de segurança (HSTS, nosniff, frameguard...). O swagger-ui
  // precisa de scripts inline, por isso a CSP fica desligada só em /docs.
  const strict = helmet();
  const relaxed = helmet({ contentSecurityPolicy: false });
  app.use((req: Request, res: Response, next: NextFunction) =>
    (req.path.startsWith('/docs') ? relaxed : strict)(req, res, next),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // remove campos não declarados no DTO
      forbidNonWhitelisted: true, // e rejeita o pedido se vierem campos extra
      transform: true, // converte o payload para a instância do DTO
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  return app;
}
