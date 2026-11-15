import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import request from 'supertest';
import { AuthModule } from '../../src/modules/auth/auth.module.js';
import { BookingsModule } from '../../src/modules/bookings/bookings.module.js';
import {
  BOOKING_ID,
  buildBooking,
  createPrismaMock,
  createTestApp,
  PrismaMock,
  SERVICE_ID,
  TEST_JWT_SECRET,
} from '../utils/test-app.js';

const price = new Prisma.Decimal(45000);

describe('/bookings', () => {
  let app: INestApplication;
  let prisma: PrismaMock;
  const jwt = new JwtService({ secret: TEST_JWT_SECRET });
  const client = `Bearer ${jwt.sign({ sub: 'user-1', role: 'CLIENT' })}`;
  const provider = `Bearer ${jwt.sign({ sub: 'prov-1', role: 'PROVIDER' })}`;
  const stranger = `Bearer ${jwt.sign({ sub: 'user-9', role: 'CLIENT' })}`;
  const otherProvider = `Bearer ${jwt.sign({ sub: 'prov-2', role: 'PROVIDER' })}`;

  beforeAll(async () => {
    prisma = createPrismaMock();
    app = await createTestApp([AuthModule, BookingsModule], prisma);
  });

  beforeEach(() => vi.resetAllMocks());
  afterAll(async () => {
    await app.close();
  });

  /** O vi.resetAllMocks limpa a implementação de $transaction: repomo-la. */
  beforeEach(() => {
    prisma.$transaction.mockImplementation((cb: (tx: PrismaMock) => unknown) => cb(prisma));
  });

  describe('autenticação', () => {
    it.each([
      ['GET', '/bookings'],
      ['POST', '/bookings'],
      ['PATCH', `/bookings/${BOOKING_ID}/cancel`],
    ])('%s %s devolve 401 sem token', async (method, url) => {
      await request(app.getHttpServer())[method.toLowerCase() as 'get'](url).expect(401);
    });
  });

  describe('POST /bookings', () => {
    beforeEach(() => {
      prisma.service.findUnique.mockResolvedValue({ price, providerId: 'prov-1' });
    });

    it('debita o cliente, credita o prestador e regista a reserva', async () => {
      prisma.user.updateMany.mockResolvedValue({ count: 1 });
      prisma.booking.create.mockResolvedValue(buildBooking());

      const res = await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', client)
        .send({ serviceId: SERVICE_ID })
        .expect(201);

      // Verificação e débito num único UPDATE condicional (saldo >= preço).
      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: 'user-1', balance: { gte: price } },
        data: { balance: { decrement: price } },
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'prov-1' },
        data: { balance: { increment: price } },
      });
      expect(prisma.booking.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { clientId: 'user-1', serviceId: SERVICE_ID, amount: price },
        }),
      );
      expect(res.body.data).toMatchObject({
        amount: 45000,
        status: 'CONFIRMED',
        client: { name: 'Ana Silva' },
        service: { name: 'Reparação de ar condicionado', provider: { name: 'Carlos Mendes' } },
      });
    });

    it('devolve 400 com saldo insuficiente e não credita nem regista nada', async () => {
      prisma.user.updateMany.mockResolvedValue({ count: 0 });

      const res = await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', client)
        .send({ serviceId: SERVICE_ID })
        .expect(400);

      expect(res.body.message).toBe('Saldo insuficiente para esta reserva');
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(prisma.booking.create).not.toHaveBeenCalled();
    });

    it('propaga a falha da transação (rollback) quando o crédito do prestador falha', async () => {
      prisma.user.updateMany.mockResolvedValue({ count: 1 });
      prisma.user.update.mockRejectedValue(new Error('db down'));

      await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', client)
        .send({ serviceId: SERVICE_ID })
        .expect(500);

      expect(prisma.booking.create).not.toHaveBeenCalled();
    });

    it('prestador não pode reservar (403)', async () => {
      await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', provider)
        .send({ serviceId: SERVICE_ID })
        .expect(403);

      expect(prisma.user.updateMany).not.toHaveBeenCalled();
    });

    it('devolve 404 se o serviço não existe', async () => {
      prisma.service.findUnique.mockResolvedValue(null);
      await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', client)
        .send({ serviceId: SERVICE_ID })
        .expect(404);
    });

    it.each([
      ['sem serviceId', {}],
      ['serviceId que não é UUID', { serviceId: 'abc' }],
      ['campos extra', { serviceId: SERVICE_ID, amount: 1 }],
    ])('devolve 400 %s', async (_label, body) => {
      await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', client)
        .send(body)
        .expect(400);
    });
  });

  describe('GET /bookings', () => {
    it('o cliente vê apenas as suas reservas', async () => {
      prisma.booking.findMany.mockResolvedValue([buildBooking()]);

      const res = await request(app.getHttpServer())
        .get('/bookings')
        .set('Authorization', client)
        .expect(200);

      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { clientId: 'user-1' } }),
      );
      expect(res.body.data[0]).toMatchObject({ amount: 45000, status: 'CONFIRMED' });
    });

    it('o prestador vê as reservas dos seus serviços', async () => {
      prisma.booking.findMany.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/bookings')
        .set('Authorization', provider)
        .expect(200);

      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { service: { providerId: 'prov-1' } } }),
      );
    });
  });

  describe('PATCH /bookings/:id/cancel', () => {
    const confirmed = {
      clientId: 'user-1',
      amount: price,
      status: 'CONFIRMED',
      service: { providerId: 'prov-1' },
    };

    beforeEach(() => {
      prisma.booking.findUnique.mockResolvedValue(confirmed);
      prisma.booking.updateMany.mockResolvedValue({ count: 1 });
      prisma.user.updateMany.mockResolvedValue({ count: 1 });
      prisma.booking.findUniqueOrThrow.mockResolvedValue(buildBooking({ status: 'CANCELLED' }));
    });

    it.each([
      ['o cliente', client],
      ['o prestador do serviço', provider],
    ])('%s cancela: devolve o valor ao cliente e debita o prestador', async (_who, token) => {
      const res = await request(app.getHttpServer())
        .patch(`/bookings/${BOOKING_ID}/cancel`)
        .set('Authorization', token)
        .expect(200);

      expect(prisma.booking.updateMany).toHaveBeenCalledWith({
        where: { id: BOOKING_ID, status: 'CONFIRMED' },
        data: { status: 'CANCELLED' },
      });
      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: 'prov-1', balance: { gte: price } },
        data: { balance: { decrement: price } },
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { balance: { increment: price } },
      });
      expect(res.body.data.status).toBe('CANCELLED');
    });

    it.each([
      ['outro cliente', stranger],
      ['outro prestador', otherProvider],
    ])('%s recebe 403 e o saldo não é tocado', async (_who, token) => {
      await request(app.getHttpServer())
        .patch(`/bookings/${BOOKING_ID}/cancel`)
        .set('Authorization', token)
        .expect(403);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('devolve 409 ao cancelar uma reserva já cancelada', async () => {
      prisma.booking.findUnique.mockResolvedValue({ ...confirmed, status: 'CANCELLED' });

      const res = await request(app.getHttpServer())
        .patch(`/bookings/${BOOKING_ID}/cancel`)
        .set('Authorization', client)
        .expect(409);

      expect(res.body.message).toBe('Esta reserva já foi cancelada');
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('devolve 409 e não reembolsa quando outro pedido cancelou entretanto (corrida)', async () => {
      prisma.booking.updateMany.mockResolvedValue({ count: 0 });

      await request(app.getHttpServer())
        .patch(`/bookings/${BOOKING_ID}/cancel`)
        .set('Authorization', client)
        .expect(409);

      expect(prisma.user.updateMany).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('devolve 409 se o prestador não tem saldo para o estorno', async () => {
      prisma.user.updateMany.mockResolvedValue({ count: 0 });

      await request(app.getHttpServer())
        .patch(`/bookings/${BOOKING_ID}/cancel`)
        .set('Authorization', client)
        .expect(409);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('devolve 404 se a reserva não existe', async () => {
      prisma.booking.findUnique.mockResolvedValue(null);
      await request(app.getHttpServer())
        .patch(`/bookings/${BOOKING_ID}/cancel`)
        .set('Authorization', client)
        .expect(404);
    });

    it('devolve 400 para um id inválido', async () => {
      await request(app.getHttpServer())
        .patch('/bookings/abc/cancel')
        .set('Authorization', client)
        .expect(400);
    });
  });
});
