import { Booking, Prisma, User } from '@prisma/client';
import {
  providerSelect,
  PublicUser,
  ServiceResponse,
  ServiceWithProvider,
  toServiceResponse,
} from '../services/service.mapper.js';

export type BookingWithRelations = Booking & {
  client: Pick<User, 'id' | 'name'>;
  service: ServiceWithProvider;
};

export interface BookingResponse {
  id: string;
  clientId: string;
  client: PublicUser;
  serviceId: string;
  service: ServiceResponse;
  amount: number;
  status: Booking['status'];
  createdAt: Date;
  updatedAt: Date;
}

/** Relações necessárias para mostrar serviço, prestador e cliente no histórico. */
export const bookingInclude = {
  client: { select: providerSelect },
  service: { include: { provider: { select: providerSelect } } },
} satisfies Prisma.BookingInclude;

export function toBookingResponse(booking: BookingWithRelations): BookingResponse {
  return {
    id: booking.id,
    clientId: booking.clientId,
    client: { id: booking.client.id, name: booking.client.name },
    serviceId: booking.serviceId,
    service: toServiceResponse(booking.service),
    amount: booking.amount.toNumber(),
    status: booking.status,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
  };
}
