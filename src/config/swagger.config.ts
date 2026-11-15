import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

// Em ambiente serverless (Vercel) os ficheiros estáticos do swagger-ui não
// são servidos pelo Express, por isso carregamos os assets de uma CDN.
const SWAGGER_UI_CDN = 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Bulir Core API')
    .setDescription(
      'API de marketplace de serviços: autenticação, serviços, reservas com ' +
        'saldo atómico e carteira. Todas as respostas seguem o envelope ' +
        '`{ success, data }` (ou `{ success: false, statusCode, message, errors }`).',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'docs-json',
    customCssUrl: `${SWAGGER_UI_CDN}/swagger-ui.css`,
    customJs: [
      `${SWAGGER_UI_CDN}/swagger-ui-bundle.js`,
      `${SWAGGER_UI_CDN}/swagger-ui-standalone-preset.js`,
    ],
    swaggerOptions: { persistAuthorization: true },
  });
}
