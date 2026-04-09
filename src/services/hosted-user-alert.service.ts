import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserBookmakerAuth } from '../entities/user-bookmaker-auth.entity';
import { StrategySignal } from '../entities/strategy-signal.entity';
import { User } from '../entities/user.entity';
import { AviatorGateway } from '../gateways/aviator.gateway';

export interface HostedUserAlert {
  userId: string;
  userEmail: string;
  bookmakerId: number;
  bookmakerName: string;
  signalId: string;
  signalTarget: number;
  timestamp: Date;
  message: string;
}

@Injectable()
export class HostedUserAlertService {
  private readonly logger = new Logger(HostedUserAlertService.name);

  constructor(
    @InjectRepository(UserBookmakerAuth)
    private userBookmakerAuthRepo: Repository<UserBookmakerAuth>,
    @InjectRepository(StrategySignal)
    private signalRepo: Repository<StrategySignal>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @Inject(forwardRef(() => AviatorGateway))
    private aviatorGateway: AviatorGateway,
  ) {}

  /**
   * Verifica si un usuario está marcado como alojado para un bookmaker
   */
  async isUserHosted(userId: string, bookmakerId: number): Promise<boolean> {
    const auth = await this.userBookmakerAuthRepo.findOne({
      where: { userId, bookmakerId },
    });
    return auth?.isHosted ?? false;
  }

  /**
   * Obtiene información del usuario alojado
   */
  async getHostedUserInfo(userId: string, bookmakerId: number): Promise<{
    isHosted: boolean;
    notes: string | null;
    markedAt: Date | null;
    markedBy: string | null;
  } | null> {
    const auth = await this.userBookmakerAuthRepo.findOne({
      where: { userId, bookmakerId },
    });

    if (!auth) return null;

    return {
      isHosted: auth.isHosted,
      notes: auth.hostedNotes,
      markedAt: auth.hostedMarkedAt,
      markedBy: auth.hostedMarkedBy,
    };
  }

  /**
   * Marca un usuario como alojado
   */
  async markUserAsHosted(
    userId: string,
    bookmakerId: number,
    notes: string,
    markedByAdminId: string,
  ): Promise<UserBookmakerAuth> {
    let auth = await this.userBookmakerAuthRepo.findOne({
      where: { userId, bookmakerId },
    });

    if (!auth) {
      // Crear registro si no existe
      auth = this.userBookmakerAuthRepo.create({
        userId,
        bookmakerId,
        isHosted: true,
        hostedNotes: notes,
        hostedMarkedAt: new Date(),
        hostedMarkedBy: markedByAdminId,
      });
    } else {
      auth.isHosted = true;
      auth.hostedNotes = notes;
      auth.hostedMarkedAt = new Date();
      auth.hostedMarkedBy = markedByAdminId;
    }

    const saved = await this.userBookmakerAuthRepo.save(auth);
    this.logger.log(`⚠️ Usuario ${userId} marcado como ALOJADO para bookmaker ${bookmakerId}`);
    
    return saved;
  }

  /**
   * Desmarca un usuario como alojado
   */
  async unmarkUserAsHosted(userId: string, bookmakerId: number): Promise<UserBookmakerAuth | null> {
    const auth = await this.userBookmakerAuthRepo.findOne({
      where: { userId, bookmakerId },
    });

    if (!auth) return null;

    auth.isHosted = false;
    auth.hostedNotes = null;
    auth.hostedMarkedAt = null;
    auth.hostedMarkedBy = null;

    const saved = await this.userBookmakerAuthRepo.save(auth);
    this.logger.log(`✅ Usuario ${userId} desmarcado como alojado para bookmaker ${bookmakerId}`);
    
    return saved;
  }

  /**
   * Emite alerta cuando un usuario alojado toma una señal
   */
  async emitHostedUserAlert(
    userId: string,
    userEmail: string,
    bookmakerId: number,
    bookmakerName: string,
    signalId: string,
    signalTarget: number,
  ): Promise<void> {
    const isHosted = await this.isUserHosted(userId, bookmakerId);

    if (!isHosted) return;

    // Obtener información adicional del usuario alojado
    const hostedInfo = await this.getHostedUserInfo(userId, bookmakerId);
    const user = await this.userRepo.findOne({ where: { id: userId } });

    const alert: HostedUserAlert = {
      userId,
      userEmail,
      bookmakerId,
      bookmakerName,
      signalId,
      signalTarget,
      timestamp: new Date(),
      message: `⚠️ USUARIO ALOJADO tomando señal: ${userEmail} está tomando señal ${signalTarget}x en ${bookmakerName}`,
    };

    // Log importante
    this.logger.warn(`🚨 ALERTA USUARIO ALOJADO:`);
    this.logger.warn(`   Usuario: ${userEmail} (${userId})`);
    this.logger.warn(`   Bookmaker: ${bookmakerName} (${bookmakerId})`);
    this.logger.warn(`   Señal: ${signalTarget}x (ID: ${signalId})`);
    this.logger.warn(`   Notas: ${hostedInfo?.notes || 'Sin notas'}`);
    this.logger.warn(`   Marcado el: ${hostedInfo?.markedAt || 'N/A'}`);

    // Emitir alerta a todos los admins conectados
    this.aviatorGateway.server.emit('hosted_user_alert', alert);

    // También emitir a la sala del bookmaker específico
    this.aviatorGateway.server.to(`bookmaker:${bookmakerId}`).emit('hosted_user_signal', {
      ...alert,
      hostedInfo,
      userFullName: user?.fullName,
    });

    // Guardar registro en la señal
    await this.signalRepo.update(signalId, {
      type: 'ALOJADO - ' + (hostedInfo?.notes || 'Usuario bajo monitoreo'),
    });
  }

  /**
   * Obtiene todos los usuarios marcados como alojados
   */
  async getAllHostedUsers(): Promise<Array<{
    userId: string;
    userEmail: string;
    userFullName: string;
    bookmakerId: number;
    bookmakerName: string;
    notes: string | null;
    markedAt: Date | null;
    markedBy: string | null;
  }>> {
    const auths = await this.userBookmakerAuthRepo.find({
      where: { isHosted: true },
      relations: ['bookmaker', 'user'],
    });

    return auths.map(auth => ({
      userId: auth.userId,
      userEmail: auth.user?.email || 'N/A',
      userFullName: auth.user?.fullName || 'N/A',
      bookmakerId: auth.bookmakerId,
      bookmakerName: auth.bookmaker?.bookmaker || 'N/A',
      notes: auth.hostedNotes,
      markedAt: auth.hostedMarkedAt,
      markedBy: auth.hostedMarkedBy,
    }));
  }

  /**
   * Obtiene usuarios alojados activos en un bookmaker
   */
  async getActiveHostedUsersInBookmaker(bookmakerId: number): Promise<Array<{
    userId: string;
    email: string;
    signalSessionActive: boolean;
  }>> {
    const activeUsers = this.aviatorGateway.getActiveUsersForBookmaker(bookmakerId);
    
    const hostedActiveUsers: Array<{
      userId: string;
      email: string;
      signalSessionActive: boolean;
    }> = [];

    for (const activeUser of activeUsers) {
      const isHosted = await this.isUserHosted(activeUser.userId, bookmakerId);
      if (isHosted) {
        hostedActiveUsers.push({
          userId: activeUser.userId,
          email: activeUser.email,
          signalSessionActive: activeUser.signalSessionActive ?? false,
        });
      }
    }

    return hostedActiveUsers;
  }
}
