const WINDOW_MS = 60_000;

const toNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

/** Limite geral por IP: protege toda a API contra abuso e picos. */
export const GLOBAL_THROTTLE = {
  ttl: WINDOW_MS,
  limit: toNumber(process.env.THROTTLE_LIMIT, 120),
};

/**
 * Limite apertado para login e registo: trava força bruta de palavras-passe
 * e criação em massa de contas. Configurável por ambiente (ex.: elevado
 * quando se corre a suíte de QA a partir de um único IP).
 */
export const AUTH_THROTTLE = {
  default: {
    ttl: WINDOW_MS,
    limit: toNumber(process.env.AUTH_THROTTLE_LIMIT, 10),
  },
};
