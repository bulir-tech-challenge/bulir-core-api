import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthUser } from '../auth/interfaces/jwt-payload.interface.js';
import { DepositDto } from './dto/deposit.dto.js';
import { UsersService } from './users.service.js';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({ summary: 'Perfil e saldo do utilizador autenticado' })
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.usersService.getProfile(user.id);
  }

  @ApiOperation({ summary: 'Deposita saldo (apenas clientes)' })
  @Post('deposit')
  @HttpCode(HttpStatus.OK)
  deposit(@CurrentUser() user: AuthUser, @Body() dto: DepositDto) {
    return this.usersService.deposit(user, dto.amount);
  }
}
