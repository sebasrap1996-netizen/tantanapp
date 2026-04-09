import { Controller, Post, Body, UseGuards, Get, Request } from '@nestjs/common';
import { LicenseService } from './services/license.service';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';

@Controller('api/licenses')
export class LicenseController {
  constructor(private readonly licenseService: LicenseService) {}

  @Post('redeem')
  @UseGuards(JwtAuthGuard)
  async redeemLicense(@Body('licenseKey') licenseKey: string, @Request() req: any) {
    return this.licenseService.redeemLicense(licenseKey, req.user.userId);
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  async getStats() {
    return this.licenseService.getLicenseStats();
  }
}
