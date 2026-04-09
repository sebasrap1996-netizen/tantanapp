import { Controller, Get, Post, Delete, Body, Param, UseGuards, Request, Query } from '@nestjs/common';
import type { CreateAuthDto, CreateSessionDto, UpdateAuthConfigDto } from './user-betting.service';
import { UserBettingService } from './user-betting.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { UserBettingGateway } from '../../gateways/user-betting.gateway';

@Controller('user-betting')
@UseGuards(JwtAuthGuard)
export class UserBettingController {
  constructor(
    private readonly bettingService: UserBettingService,
    private readonly bettingGateway: UserBettingGateway,
  ) {}

  // ========== AUTH MANAGEMENT ==========

  @Post('auth')
  async saveAuth(@Request() req: any, @Body() dto: CreateAuthDto) {
    return this.bettingService.saveAuth(req.user.id, dto);
  }

  @Get('auth')
  async getUserAuths(@Request() req: any) {
    return this.bettingService.getUserAuths(req.user.id);
  }

  @Get('auth/:bookmakerId')
  async getAuth(@Request() req: any, @Param('bookmakerId') bookmakerId: string) {
    return this.bettingService.getAuth(req.user.id, parseInt(bookmakerId));
  }

  @Get('auth/:bookmakerId/balance')
  async getBookmakerBalance(@Request() req: any, @Param('bookmakerId') bookmakerId: string) {
    return this.bettingService.getBookmakerBalance(req.user.id, parseInt(bookmakerId));
  }

  @Post('auth/:bookmakerId/verify')
  async verifyAuth(@Request() req: any, @Param('bookmakerId') bookmakerId: string) {
    return this.bettingService.verifyAuth(req.user.id, parseInt(bookmakerId));
  }

  @Post('auth/:bookmakerId/config')
  async updateAuthConfig(
    @Request() req: any,
    @Param('bookmakerId') bookmakerId: string,
    @Body() dto: UpdateAuthConfigDto
  ) {
    return this.bettingService.updateAuthConfig(req.user.id, parseInt(bookmakerId), dto);
  }

  @Delete('auth/:bookmakerId')
  async deleteAuth(@Request() req: any, @Param('bookmakerId') bookmakerId: string) {
    await this.bettingService.deleteAuth(req.user.id, parseInt(bookmakerId));
    return { success: true };
  }

  // ========== SESSION MANAGEMENT ==========

  @Post('sessions')
  async createSession(@Request() req: any, @Body() dto: CreateSessionDto) {
    return this.bettingService.createSession(req.user.id, dto);
  }

  @Post('sessions/:sessionId/start')
  async startSession(@Request() req: any, @Param('sessionId') sessionId: string) {
    return this.bettingService.startSession(req.user.id, sessionId);
  }

  @Post('sessions/:sessionId/pause')
  async pauseSession(@Request() req: any, @Param('sessionId') sessionId: string) {
    return this.bettingService.pauseSession(req.user.id, sessionId);
  }

  @Post('sessions/:sessionId/stop')
  async stopSession(@Request() req: any, @Param('sessionId') sessionId: string) {
    const session = await this.bettingService.stopSession(req.user.id, sessionId);
    
    // Emitir evento WebSocket para que el frontend se actualice
    this.bettingGateway.emitSessionStopped(req.user.id, session);
    
    return session;
  }

  @Get('sessions/active')
  async getActiveSessions(@Request() req: any) {
    return this.bettingService.getActiveSessions(req.user.id);
  }

  @Get('sessions/history')
  async getSessionHistory(@Request() req: any, @Query('limit') limit?: string) {
    return this.bettingService.getSessionHistory(req.user.id, parseInt(limit || '20'));
  }

  @Get('sessions/:sessionId')
  async getSessionStatus(@Request() req: any, @Param('sessionId') sessionId: string) {
    return this.bettingService.getSessionStatus(req.user.id, sessionId);
  }

  // ========== BETTING HISTORY ==========

  @Get('bets')
  async getUserBets(@Request() req: any, @Query('limit') limit?: string) {
    return this.bettingService.getUserBets(req.user.id, parseInt(limit || '50'));
  }

  @Get('sessions/:sessionId/bets')
  async getSessionBets(@Param('sessionId') sessionId: string, @Query('limit') limit?: string) {
    return this.bettingService.getSessionBets(sessionId, parseInt(limit || '50'));
  }
}
