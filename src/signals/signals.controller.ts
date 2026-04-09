import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { SignalsService } from './signals.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';

@Controller('signals')
export class SignalsController {
  constructor(private readonly signalsService: SignalsService) {}

  // Endpoint público para señales globales (sin autenticación requerida)
  @Get('global')
  async getGlobalSignals(
    @Query('bookmakerId') bookmakerId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.signalsService.getGlobalSignals(
      bookmakerId ? parseInt(bookmakerId) : undefined,
      limit ? parseInt(limit) : 50,
    );
  }

  // Endpoint para señales del usuario autenticado
  @Get('my')
  @UseGuards(JwtAuthGuard)
  async getMySignals(
    @Request() req,
    @Query('bookmakerId') bookmakerId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.signalsService.getUserSignals(
      req.user.id,
      bookmakerId ? parseInt(bookmakerId) : undefined,
      limit ? parseInt(limit) : 50,
    );
  }

  // Endpoint combinado: global + usuario (si está autenticado)
  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  async getSignals(
    @Request() req,
    @Query('bookmakerId') bookmakerId?: string,
    @Query('limit') limit?: string,
    @Query('mode') mode?: 'global' | 'my',
  ) {
    const userId = req.user?.id;
    const bookmakerIdNum = bookmakerId ? parseInt(bookmakerId) : undefined;
    const limitNum = limit ? parseInt(limit) : 50;

    if (mode === 'my' && userId) {
      return this.signalsService.getUserSignals(userId, bookmakerIdNum, limitNum);
    }
    
    // Por defecto: global (incluye señales del usuario si está autenticado)
    return this.signalsService.getGlobalSignals(bookmakerIdNum, limitNum);
  }
}
