export interface EnvironmentVariables {
  PORT: number;
  NODE_ENV: string;
  DATABASE_URL: string;
  DATABASE_URL_POOLER?: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
}

const DEFAULT_JWT_SECRET = 'default_jwt_secret';

/**
 * Sem JWT_SECRET o segredo cai num valor público (está no repositório) e
 * qualquer pessoa consegue forjar tokens. Em produção isso tem de ser
 * configurado; avisamos de forma ruidosa em vez de impedir o arranque.
 */
function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;

  console.warn(
    '[SEGURANÇA] JWT_SECRET não está definido: a usar um segredo por defeito público. ' +
      'Defina JWT_SECRET antes de expor esta API.',
  );
  return DEFAULT_JWT_SECRET;
}

export const envConfig = () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  database: {
    url: process.env.DATABASE_URL ?? '',
    poolerUrl: process.env.DATABASE_URL_POOLER,
  },
  jwt: {
    secret: resolveJwtSecret(),
    expiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
  },
});
