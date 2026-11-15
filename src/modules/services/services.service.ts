import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthUser } from '../auth/interfaces/jwt-payload.interface.js';
import { CreateServiceDto } from './dto/create-service.dto.js';
import { UpdateServiceDto } from './dto/update-service.dto.js';
import {
  providerSelect,
  ServiceResponse,
  toServiceResponse,
} from './service.mapper.js';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<ServiceResponse[]> {
    const services = await this.prisma.service.findMany({
      include: { provider: { select: providerSelect } },
      orderBy: { createdAt: 'desc' },
    });
    return services.map(toServiceResponse);
  }

  async findOne(id: string): Promise<ServiceResponse> {
    const service = await this.prisma.service.findUnique({
      where: { id },
      include: { provider: { select: providerSelect } },
    });
    if (!service) {
      throw new NotFoundException('Serviço não encontrado');
    }
    return toServiceResponse(service);
  }

  async create(user: AuthUser, dto: CreateServiceDto): Promise<ServiceResponse> {
    const service = await this.prisma.service.create({
      data: {
        name: dto.name,
        description: dto.description,
        price: dto.price,
        providerId: user.id,
      },
      include: { provider: { select: providerSelect } },
    });
    return toServiceResponse(service);
  }

  async update(
    user: AuthUser,
    id: string,
    dto: UpdateServiceDto,
  ): Promise<ServiceResponse> {
    await this.assertOwnership(user, id);

    const service = await this.prisma.service.update({
      where: { id },
      data: dto,
      include: { provider: { select: providerSelect } },
    });
    return toServiceResponse(service);
  }

  async remove(user: AuthUser, id: string): Promise<void> {
    await this.assertOwnership(user, id);

    // O histórico de reservas tem de se manter íntegro: não se apaga um
    // serviço que já foi reservado.
    const bookings = await this.prisma.booking.count({ where: { serviceId: id } });
    if (bookings > 0) {
      throw new ConflictException('Não é possível excluir um serviço com reservas');
    }

    await this.prisma.service.delete({ where: { id } });
  }

  /** 404 se o serviço não existe, 403 se pertence a outro prestador. */
  private async assertOwnership(user: AuthUser, id: string): Promise<void> {
    const service = await this.prisma.service.findUnique({
      where: { id },
      select: { providerId: true },
    });
    if (!service) {
      throw new NotFoundException('Serviço não encontrado');
    }
    if (service.providerId !== user.id) {
      throw new ForbiddenException('Só o prestador dono do serviço o pode alterar');
    }
  }
}
