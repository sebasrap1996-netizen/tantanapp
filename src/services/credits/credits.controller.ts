import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { CreditsService } from './credits.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../auth/guards/admin.guard';

@Controller('credits')
@UseGuards(JwtAuthGuard)
export class CreditsController {
  constructor(private readonly creditsService: CreditsService) {}

  @Get('balance')
  async getMyBalance(@Request() req: any) {
    const credits = await this.creditsService.getUserCredits(req.user.id);
    if (!credits) {
      return { balance: 0, totalEarned: 0, totalSpent: 0 };
    }
    return credits;
  }

  @Get('history')
  async getMyHistory(@Request() req: any) {
    const transactions = await this.creditsService.getTransactionHistory(req.user.id);
    return transactions;
  }

  @Post('add')
  @UseGuards(AdminGuard)
  async addCredits(
    @Body() body: { userId: string; amount: number; description?: string }
  ) {
    const result = await this.creditsService.addCredits(
      body.userId,
      body.amount,
      'admin_adjustment' as any,
      'admin_grant' as any,
      undefined,
      body.description || 'Créditos otorgados por administrador'
    );
    return {
      success: true,
      balance: result.creditsBalance,
      message: `Se añadieron ${body.amount} créditos al usuario`
    };
  }

  @Get('user/:userId')
  @UseGuards(AdminGuard)
  async getUserCredits(@Param('userId') userId: string) {
    const credits = await this.creditsService.getUserCredits(userId);
    if (!credits) {
      return { balance: 0, totalEarned: 0, totalSpent: 0 };
    }
    return credits;
  }

  @Get('user/:userId/history')
  @UseGuards(AdminGuard)
  async getUserHistory(@Param('userId') userId: string) {
    const transactions = await this.creditsService.getTransactionHistory(userId);
    return transactions;
  }
}
