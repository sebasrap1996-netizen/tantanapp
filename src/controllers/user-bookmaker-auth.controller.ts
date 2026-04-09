import { Controller, Post, Get, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { UserBookmakerAuthService } from '../services/user-bookmaker-auth.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('user-bookmaker-auth')
@UseGuards(JwtAuthGuard)
export class UserBookmakerAuthController {
  constructor(private readonly authService: UserBookmakerAuthService) {}


  /**
   * Obtiene la configuración de autenticación del usuario para un bookmaker
   */
  @Get('config/:bookmakerId')
  async getAuthConfig(@Request() req: any, @Param('bookmakerId') bookmakerId: string) {
    const config = await this.authService.getAuthConfig(
      req.user.id || req.user.sub,
      parseInt(bookmakerId),
    );
    return { success: true, data: config };
  }

  /**
   * Obtiene todas las configuraciones de autenticación del usuario
   */
  @Get('configs')
  async getAllAuthConfigs(@Request() req: any) {
    const configs = await this.authService.getAllAuthConfigs(req.user.id || req.user.sub);
    return { success: true, data: configs };
  }

  /**
   * Elimina la configuración de autenticación
   */
  @Delete('config/:bookmakerId')
  async deleteAuthConfig(@Request() req: any, @Param('bookmakerId') bookmakerId: string) {
    const result = await this.authService.deleteAuthConfig(
      req.user.id || req.user.sub,
      parseInt(bookmakerId),
    );
    return { success: result };
  }
}
