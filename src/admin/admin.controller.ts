import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AuthService } from '../auth/auth.service';
import { UpdateRoleDto } from '../auth/dto/update-role.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bookmaker } from '../entities/bookmaker.entity';
import { AviatorWs } from '../entities/aviator-ws.entity';

@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly authService: AuthService,
    @InjectRepository(Bookmaker)
    private readonly bookmakerRepository: Repository<Bookmaker>,
    @InjectRepository(AviatorWs)
    private readonly aviatorWsRepository: Repository<AviatorWs>,
  ) {}

  
  // Middleware para verificar permisos de admin
  private checkAdminPermissions(userRole: string) {
    if (userRole !== 'admin' && userRole !== 'superadmin') {
      throw new ForbiddenException('No tienes permisos de administrador');
    }
  }

  // ==================== ENDPOINTS PROTEGIDOS ====================
  
  @UseGuards(JwtAuthGuard)
  @Get('users')
  async getAllUsers(
    @Request() req,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string
  ) {
    this.checkAdminPermissions(req.user.role);
    return this.adminService.getAllUsers(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10,
      search
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('users/:id')
  async getUserById(@Param('id') id: string, @Request() req) {
    this.checkAdminPermissions(req.user.role);
    return this.adminService.getUserById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Put('users/:id')
  async updateUser(
    @Param('id') id: string,
    @Body() updateData: any,
    @Request() req
  ) {
    this.checkAdminPermissions(req.user.role);
    return this.adminService.updateUser(id, updateData);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('users/:id')
  async deleteUser(@Param('id') id: string, @Request() req) {
    this.checkAdminPermissions(req.user.role);
    return this.adminService.deleteUser(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('dashboard')
  async getDashboardStats(@Request() req) {
    this.checkAdminPermissions(req.user.role);
    return this.adminService.getDashboardStats();
  }

  @UseGuards(JwtAuthGuard)
  @Get('stats')
  async getStats(@Request() req) {
    this.checkAdminPermissions(req.user.role);
    return this.adminService.getUserStats();
  }

  @UseGuards(JwtAuthGuard)
  @Post('users/:id/role')
  async updateUserRole(
    @Param('id') id: string,
    @Body() updateRoleDto: UpdateRoleDto,
    @Request() req
  ) {
    this.checkAdminPermissions(req.user.role);
    return this.authService.updateUserRole(updateRoleDto);
  }

  // ==================== SEÑALES ====================

  @UseGuards(JwtAuthGuard)
  @Get('signals')
  async getAllSignals(
    @Request() req,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('userId') userId?: string
  ) {
    this.checkAdminPermissions(req.user.role);
    return this.adminService.getAllSignals(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 50,
      status,
      userId
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('signals/stats')
  async getSignalStats(@Request() req) {
    this.checkAdminPermissions(req.user.role);
    return this.adminService.getSignalStats();
  }

  @UseGuards(JwtAuthGuard)
  @Get('signals/user/:userId')
  async getSignalsByUser(@Param('userId') userId: string, @Request() req) {
    this.checkAdminPermissions(req.user.role);
    return this.adminService.getSignalsByUser(userId);
  }

  // ==================== CASINOS / BOOKMAKERS ====================

  @UseGuards(JwtAuthGuard)
  @Get('casinos')
  async getAllCasinos(@Request() req) {
    this.checkAdminPermissions(req.user.role);
    const casinos = await this.bookmakerRepository.find({
      where: { isActive: true },
      order: { bookmaker: 'ASC' },
    });
    return { success: true, data: casinos };
  }

  @UseGuards(JwtAuthGuard)
  @Get('casinos/:id')
  async getCasinoById(@Param('id') id: string, @Request() req) {
    this.checkAdminPermissions(req.user.role);
    const casino = await this.bookmakerRepository.findOne({
      where: { id: parseInt(id) },
    });
    if (!casino) {
      throw new ForbiddenException('Casino no encontrado');
    }
    return { success: true, data: casino };
  }

  
  @Put('casinos/:id')
  async updateCasino(
    @Param('id') id: string,
    @Body() updateData: Partial<Bookmaker>,
    @Request() req,
  ) {
    this.checkAdminPermissions(req.user.role);
    
    const casino = await this.bookmakerRepository.findOne({
      where: { id: parseInt(id) },
    });
    
    if (!casino) {
      return { success: false, message: 'Casino no encontrado' };
    }

    // No permitir actualizar ciertos campos críticos
    delete updateData.id;
    delete (updateData as any).createdAt;
    delete (updateData as any).updatedAt;

    Object.assign(casino, updateData);
    await this.bookmakerRepository.save(casino);

    return { success: true, message: 'Casino actualizado correctamente' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('casinos')
  async createCasino(
    @Body() casinoData: Partial<Bookmaker>,
    @Request() req
  ) {
    this.checkAdminPermissions(req.user.role);
    // Asegurar que el gameId sea 1 por defecto (Aviator) si no se provee
    if (!casinoData.gameId) casinoData.gameId = 1;
    const newCasino = this.bookmakerRepository.create(casinoData);
    await this.bookmakerRepository.save(newCasino);
    return { success: true, message: 'Casino creado correctamente', data: newCasino };
  }

}
