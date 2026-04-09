import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { HostedUserAlertService } from '../services/hosted-user-alert.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('hosted-users')
@UseGuards(JwtAuthGuard, AdminGuard)
export class HostedUserController {
  constructor(private readonly hostedUserAlertService: HostedUserAlertService) {}

  /**
   * Marca un usuario como alojado
   * Solo admins pueden hacer esto
   */
  @Post('mark')
  async markUserAsHosted(
    @Body() body: { userId: string; bookmakerId: number; notes: string },
    @Request() req: any,
  ) {
    const adminId = req.user.id;
    
    const result = await this.hostedUserAlertService.markUserAsHosted(
      body.userId,
      body.bookmakerId,
      body.notes,
      adminId,
    );

    return {
      success: true,
      message: 'Usuario marcado como alojado',
      data: {
        userId: result.userId,
        bookmakerId: result.bookmakerId,
        isHosted: result.isHosted,
        notes: result.hostedNotes,
        markedAt: result.hostedMarkedAt,
      },
    };
  }

  /**
   * Desmarca un usuario como alojado
   * Solo admins pueden hacer esto
   */
  @Post('unmark')
  async unmarkUserAsHosted(
    @Body() body: { userId: string; bookmakerId: number },
  ) {
    const result = await this.hostedUserAlertService.unmarkUserAsHosted(
      body.userId,
      body.bookmakerId,
    );

    if (!result) {
      return {
        success: false,
        message: 'No se encontró el registro del usuario para este bookmaker',
      };
    }

    return {
      success: true,
      message: 'Usuario desmarcado como alojado',
      data: {
        userId: result.userId,
        bookmakerId: result.bookmakerId,
        isHosted: result.isHosted,
      },
    };
  }

  /**
   * Obtiene todos los usuarios marcados como alojados
   * Solo admins pueden ver esto
   */
  @Get('all')
  async getAllHostedUsers() {
    const users = await this.hostedUserAlertService.getAllHostedUsers();
    return {
      success: true,
      count: users.length,
      data: users,
    };
  }

  /**
   * Verifica si un usuario está marcado como alojado
   */
  @Get('check/:userId/:bookmakerId')
  async checkIfUserIsHosted(
    @Param('userId') userId: string,
    @Param('bookmakerId') bookmakerId: string,
  ) {
    const isHosted = await this.hostedUserAlertService.isUserHosted(
      userId,
      parseInt(bookmakerId),
    );

    const hostedInfo = isHosted 
      ? await this.hostedUserAlertService.getHostedUserInfo(userId, parseInt(bookmakerId))
      : null;

    return {
      success: true,
      data: {
        userId,
        bookmakerId: parseInt(bookmakerId),
        isHosted,
        info: hostedInfo,
      },
    };
  }

  /**
   * Obtiene usuarios alojados activos en un bookmaker específico
   */
  @Get('active/:bookmakerId')
  async getActiveHostedUsersInBookmaker(
    @Param('bookmakerId') bookmakerId: string,
  ) {
    const users = await this.hostedUserAlertService.getActiveHostedUsersInBookmaker(
      parseInt(bookmakerId),
    );

    return {
      success: true,
      bookmakerId: parseInt(bookmakerId),
      count: users.length,
      data: users,
    };
  }
}
