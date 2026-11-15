import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import request from 'supertest';
import { AuthModule } from '../../src/modules/auth/auth.module.js';
import { ServicesModule } from '../../src/modules/services/services.module.js';
import {
  buildService,
  createPrismaMock,
  createTestApp,
  PrismaMock,
  SERVICE_ID,
  TEST_JWT_SECRET,
} from '../utils/test-app.js';

describe('/services', () => {
  let app: INestApplication;
  let prisma: PrismaMock;
  const jwt = new JwtService({ secret: TEST_JWT_SECRET });
  const client = `Bearer ${jwt.sign({ sub: 'user-1', role: 'CLIENT' })}`;
  const provider = `Bearer ${jwt.sign({ sub: 'prov-1', role: 'PROVIDER' })}`;
  const otherProvider = `Bearer ${jwt.sign({ sub: 'prov-2', role: 'PROVIDER' })}`;
  const valid = { name: 'Limpeza doméstica', description: 'Limpeza profunda', price: 20000 };

  beforeAll(async () => {
    prisma = createPrismaMock();
    app = await createTestApp([AuthModule, ServicesModule], prisma);
  });

  beforeEach(() => vi.clearAllMocks());
  afterAll(async () => {
    await app.close();
  });

  describe('autenticação', () => {
    it.each([
      ['GET', '/services'],
      ['GET', `/services/${SERVICE_ID}`],
      ['POST', '/services'],
      ['PATCH', `/services/${SERVICE_ID}`],
      ['DELETE', `/services/${SERVICE_ID}`],
    ])('%s %s devolve 401 sem token', async (method, url) => {
      await request(app.getHttpServer())[method.toLowerCase() as 'get'](url).expect(401);
    });
  });

  describe('GET /services', () => {
    it('lista os serviços com o prestador e o preço como número', async () => {
      prisma.service.findMany.mockResolvedValue([buildService()]);

      const res = await request(app.getHttpServer())
        .get('/services')
        .set('Authorization', client)
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]).toMatchObject({
        id: SERVICE_ID,
        price: 45000,
        provider: { name: 'Carlos Mendes' },
      });
      // Só id e nome: e-mail e NIF do prestador não são expostos a outros utilizadores.
      expect(res.body.data[0].provider).toEqual({ id: 'prov-1', name: 'Carlos Mendes' });
    });

    it('devolve 404 para um serviço inexistente', async () => {
      prisma.service.findUnique.mockResolvedValue(null);
      await request(app.getHttpServer())
        .get(`/services/${SERVICE_ID}`)
        .set('Authorization', client)
        .expect(404);
    });

    it('devolve 400 para um id que não é UUID', async () => {
      await request(app.getHttpServer())
        .get('/services/abc')
        .set('Authorization', client)
        .expect(400);
    });
  });

  describe('POST /services', () => {
    it('prestador cria um serviço associado a si próprio', async () => {
      prisma.service.create.mockResolvedValue(buildService({ ...valid, price: new Prisma.Decimal(valid.price) }));

      await request(app.getHttpServer())
        .post('/services')
        .set('Authorization', provider)
        .send(valid)
        .expect(201);

      expect(prisma.service.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: { ...valid, providerId: 'prov-1' } }),
      );
    });

    it('cliente recebe 403 e nada é criado', async () => {
      const res = await request(app.getHttpServer())
        .post('/services')
        .set('Authorization', client)
        .send(valid)
        .expect(403);

      expect(res.body.message).toBe('Apenas prestadores podem executar esta ação');
      expect(prisma.service.create).not.toHaveBeenCalled();
    });

    it.each([
      ['preço zero', { price: 0 }],
      ['preço negativo', { price: -10 }],
      ['preço com 3 casas decimais', { price: 10.123 }],
      ['preço acima do máximo', { price: 10_000_001 }],
      ['preço como texto', { price: '100' }],
      ['nome curto', { name: 'ab' }],
      ['descrição vazia', { description: '' }],
    ])('devolve 400 com %s', async (_label, patch) => {
      await request(app.getHttpServer())
        .post('/services')
        .set('Authorization', provider)
        .send({ ...valid, ...patch })
        .expect(400);

      expect(prisma.service.create).not.toHaveBeenCalled();
    });

    it('aceita o preço mínimo de 0.01', async () => {
      prisma.service.create.mockResolvedValue(buildService());
      await request(app.getHttpServer())
        .post('/services')
        .set('Authorization', provider)
        .send({ ...valid, price: 0.01 })
        .expect(201);
    });
  });

  describe('PATCH /services/:id', () => {
    it('o dono atualiza só os campos enviados', async () => {
      prisma.service.findUnique.mockResolvedValue({ providerId: 'prov-1' });
      prisma.service.update.mockResolvedValue(buildService({ price: new Prisma.Decimal(50000) }));

      await request(app.getHttpServer())
        .patch(`/services/${SERVICE_ID}`)
        .set('Authorization', provider)
        .send({ price: 50000 })
        .expect(200);

      expect(prisma.service.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: SERVICE_ID }, data: { price: 50000 } }),
      );
    });

    it('outro prestador recebe 403', async () => {
      prisma.service.findUnique.mockResolvedValue({ providerId: 'prov-1' });

      await request(app.getHttpServer())
        .patch(`/services/${SERVICE_ID}`)
        .set('Authorization', otherProvider)
        .send({ price: 1 })
        .expect(403);

      expect(prisma.service.update).not.toHaveBeenCalled();
    });

    it('cliente recebe 403', async () => {
      await request(app.getHttpServer())
        .patch(`/services/${SERVICE_ID}`)
        .set('Authorization', client)
        .send({ price: 1 })
        .expect(403);
    });

    it('devolve 404 quando o serviço não existe', async () => {
      prisma.service.findUnique.mockResolvedValue(null);
      await request(app.getHttpServer())
        .patch(`/services/${SERVICE_ID}`)
        .set('Authorization', provider)
        .send({ price: 1 })
        .expect(404);
    });

    it('rejeita preço inválido com 400', async () => {
      await request(app.getHttpServer())
        .patch(`/services/${SERVICE_ID}`)
        .set('Authorization', provider)
        .send({ price: 0 })
        .expect(400);
    });
  });

  describe('DELETE /services/:id', () => {
    it('o dono exclui um serviço sem reservas', async () => {
      prisma.service.findUnique.mockResolvedValue({ providerId: 'prov-1' });
      prisma.booking.count.mockResolvedValue(0);

      await request(app.getHttpServer())
        .delete(`/services/${SERVICE_ID}`)
        .set('Authorization', provider)
        .expect(200);

      expect(prisma.service.delete).toHaveBeenCalledWith({ where: { id: SERVICE_ID } });
    });

    it('devolve 409 se o serviço já tem reservas', async () => {
      prisma.service.findUnique.mockResolvedValue({ providerId: 'prov-1' });
      prisma.booking.count.mockResolvedValue(2);

      await request(app.getHttpServer())
        .delete(`/services/${SERVICE_ID}`)
        .set('Authorization', provider)
        .expect(409);

      expect(prisma.service.delete).not.toHaveBeenCalled();
    });

    it('outro prestador recebe 403', async () => {
      prisma.service.findUnique.mockResolvedValue({ providerId: 'prov-1' });
      await request(app.getHttpServer())
        .delete(`/services/${SERVICE_ID}`)
        .set('Authorization', otherProvider)
        .expect(403);
      expect(prisma.service.delete).not.toHaveBeenCalled();
    });
  });
});
