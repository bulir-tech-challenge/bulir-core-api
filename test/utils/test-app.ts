import { INestApplication, ModuleMetadata } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Prisma, Role, User } from '@prisma/client';
import type { Mock } from 'vitest';
import { configureApp } from '../../src/app.setup.js';
import { PrismaModule } from '../../src/prisma/prisma.module.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';

export const TEST_JWT_SECRET = 'test-secret';

export interface PrismaMock {
  user: {
    findUnique: Mock;
    findFirst: Mock;
    create: Mock;
    update: Mock;
    updateMany: Mock;
  };
  service: {
    findMany: Mock;
    findUnique: Mock;
    create: Mock;
    update: Mock;
    delete: Mock;
  };
  booking: {
    findMany: Mock;
    findUnique: Mock;
    findUniqueOrThrow: Mock;
    create: Mock;
    updateMany: Mock;
    count: Mock;
  };
  $transaction: Mock;
}

export function createPrismaMock(): PrismaMock {
  const mock: PrismaMock = {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    service: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    booking: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  // A transação executa o callback com o próprio mock como cliente transacional.
  mock.$transaction.mockImplementation((callback: (tx: PrismaMock) => unknown) =>
    callback(mock),
  );
  return mock;
}

/**
 * Sobe a aplicação Nest real (controllers, services, guards, pipes, filtros)
 * substituindo apenas o acesso à base de dados por um mock.
 */
export async function createTestApp(
  imports: ModuleMetadata['imports'],
  prisma: PrismaMock,
): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        ignoreEnvFile: true,
        load: [() => ({ jwt: { secret: TEST_JWT_SECRET, expiresIn: '1h' } })],
      }),
      PrismaModule,
      ...(imports ?? []),
    ],
  })
    .overrideProvider(PrismaService)
    .useValue(prisma)
    .compile();

  const app = configureApp(moduleRef.createNestApplication({ logger: false }));
  await app.init();
  return app;
}

export function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    name: 'Ana Silva',
    nif: '004567890LA042',
    email: 'ana@bulir.ao',
    password: 'hashed-password',
    role: Role.CLIENT,
    balance: new Prisma.Decimal(0),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

export function buildProvider(overrides: Partial<User> = {}): User {
  return buildUser({
    id: 'prov-1',
    name: 'Carlos Mendes',
    nif: '009876543LA011',
    email: 'carlos@bulir.ao',
    role: Role.PROVIDER,
    ...overrides,
  });
}

export const SERVICE_ID = '11111111-1111-4111-8111-111111111111';
export const BOOKING_ID = '22222222-2222-4222-8222-222222222222';

/** Serviço tal como o Prisma o devolve, com o prestador incluído. */
export function buildService(overrides: Record<string, unknown> = {}) {
  const provider = buildProvider();
  return {
    id: SERVICE_ID,
    name: 'Reparação de ar condicionado',
    description: 'Diagnóstico e reparação completa',
    price: new Prisma.Decimal(45000),
    providerId: provider.id,
    provider: { id: provider.id, name: provider.name },
    createdAt: new Date('2026-02-01T00:00:00.000Z'),
    updatedAt: new Date('2026-02-01T00:00:00.000Z'),
    ...overrides,
  };
}

export function buildBooking(overrides: Record<string, unknown> = {}) {
  const client = buildUser();
  return {
    id: BOOKING_ID,
    clientId: client.id,
    client: { id: client.id, name: client.name },
    serviceId: SERVICE_ID,
    service: buildService(),
    amount: new Prisma.Decimal(45000),
    status: 'CONFIRMED',
    createdAt: new Date('2026-02-02T00:00:00.000Z'),
    updatedAt: new Date('2026-02-02T00:00:00.000Z'),
    ...overrides,
  };
}
