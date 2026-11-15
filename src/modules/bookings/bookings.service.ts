import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthUser } from '../auth/interfaces/jwt-payload.interface.js';
import {
  BookingResponse,
  bookingInclude,
  toBookingResponse,
} from './booking.mapper.js';

@Injectable()
export class BookingsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cria a reserva e move o dinheiro numa única transação.
   *
   * O débito do cliente é um UPDATE condicional (`balance >= preço`) feito
   * pela própria BD: verificar o saldo e debitar acontece num só passo, por
   * isso dois pedidos em paralelo nunca gastam o mesmo saldo duas vezes e o
   * saldo nunca fica negativo. Se qualquer passo falhar, tudo é revertido.
   */
  async create(user: AuthUser, serviceId: string): Promise<BookingResponse> {
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
      select: { price: true, providerId: true },
    });
    if (!service) {
      throw new NotFoundException('Serviço não encontrado');
    }

    const booking = await this.prisma.$transaction(async (tx) => {
      const debited = await tx.user.updateMany({
        where: { id: user.id, balance: { gte: service.price } },
        data: { balance: { decrement: service.price } },
      });
      if (debited.count === 0) {
        throw new BadRequestException('Saldo insuficiente para esta reserva');
      }

      await tx.user.update({
        where: { id: service.providerId },
        data: { balance: { increment: service.price } },
      });

      return tx.booking.create({
        data: { clientId: user.id, serviceId, amount: service.price },
        include: bookingInclude,
      });
    });

    return toBookingResponse(booking);
  }

  /** Histórico: cada utilizador vê apenas as reservas em que participou. */
  async findAll(user: AuthUser): Promise<BookingResponse[]> {
    const where: Prisma.BookingWhereInput =
      user.role === Role.CLIENT
        ? { clientId: user.id }
        : { service: { providerId: user.id } };

    const bookings = await this.prisma.booking.findMany({
      where,
      include: bookingInclude,
      orderBy: { createdAt: 'desc' },
    });
    return bookings.map(toBookingResponse);
  }

  /**
   * Cancela uma reserva (pelo cliente ou pelo prestador do serviço) e devolve
   * o valor por inteiro ao cliente, debitando-o ao prestador.
   */
  async cancel(user: AuthUser, id: string): Promise<BookingResponse> {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      select: {
        clientId: true,
        amount: true,
        status: true,
        service: { select: { providerId: true } },
      },
    });
    if (!booking) {
      throw new NotFoundException('Reserva não encontrada');
    }

    const providerId = booking.service.providerId;
    if (user.id !== booking.clientId && user.id !== providerId) {
      throw new ForbiddenException('Não tens permissão para cancelar esta reserva');
    }
    if (booking.status === BookingStatus.CANCELLED) {
      throw new ConflictException('Esta reserva já foi cancelada');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // Só uma das chamadas concorrentes consegue passar de CONFIRMED a
      // CANCELLED; as restantes recebem 409 em vez de reembolsar duas vezes.
      const marked = await tx.booking.updateMany({
        where: { id, status: BookingStatus.CONFIRMED },
        data: { status: BookingStatus.CANCELLED },
      });
      if (marked.count === 0) {
        throw new ConflictException('Esta reserva já foi cancelada');
      }

      const debited = await tx.user.updateMany({
        where: { id: providerId, balance: { gte: booking.amount } },
        data: { balance: { decrement: booking.amount } },
      });
      if (debited.count === 0) {
        throw new ConflictException(
          'O prestador não tem saldo suficiente para o estorno',
        );
      }

      await tx.user.update({
        where: { id: booking.clientId },
        data: { balance: { increment: booking.amount } },
      });

      return tx.booking.findUniqueOrThrow({ where: { id }, include: bookingInclude });
    });

    return toBookingResponse(updated);
  }
}
