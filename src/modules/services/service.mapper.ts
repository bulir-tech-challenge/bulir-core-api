import { Prisma, Service, User } from '@prisma/client';

export type ServiceWithProvider = Service & {
  provider: Pick<User, 'id' | 'name'>;
};

/** Dados públicos de um participante: o suficiente para identificar quem é, sem PII de contacto. */
export interface PublicUser {
  id: string;
  name: string;
}

export interface ServiceResponse {
  id: string;
  name: string;
  description: string;
  price: number;
  providerId: string;
  provider: PublicUser;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Seleção mínima de um utilizador noutro recurso: só id e nome.
 * E-mail e NIF são dados pessoais e não devem ser vistos pela contraparte.
 */
export const providerSelect = {
  id: true,
  name: true,
} satisfies Prisma.UserSelect;

export function toServiceResponse(service: ServiceWithProvider): ServiceResponse {
  return {
    id: service.id,
    name: service.name,
    description: service.description,
    price: service.price.toNumber(),
    providerId: service.providerId,
    provider: { id: service.provider.id, name: service.provider.name },
    createdAt: service.createdAt,
    updatedAt: service.updatedAt,
  };
}
