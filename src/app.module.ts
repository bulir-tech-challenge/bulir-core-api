import { Module, DynamicModule, Type, ForwardReference } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { createObserveModule } from '@nestjs/observe';
import { envConfig } from './config/env.config.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { BookingsModule } from './modules/bookings/bookings.module.js';
import { ServicesModule } from './modules/services/services.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AppController } from './app.controller.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

const imports: Array<Type<unknown> | DynamicModule | Promise<DynamicModule> | ForwardReference> = [
  ConfigModule.forRoot({
    isGlobal: true,
    load: [envConfig],
  }),
  PrismaModule,
  UsersModule,
  AuthModule,
  ServicesModule,
  BookingsModule,
];

if (process.env.OBSERVE_APP_KEY) {
  imports.push(
    ObserveModule.forRoot({
      appKey: process.env.OBSERVE_APP_KEY,
      appSecret: process.env.OBSERVE_APP_SECRET ?? '',
      serviceId: 'bulir-core-api',
    }),
  );
}

@Module({
  imports,
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
