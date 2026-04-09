import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserSignalSession } from '../entities/user-signal-session.entity';
import { StrategySignal } from '../entities/strategy-signal.entity';

@Injectable()
export class UserSessionService {
  private readonly logger = new Logger(UserSessionService.name);

  constructor(
    @InjectRepository(UserSignalSession)
    private sessionRepo: Repository<UserSignalSession>,
    @InjectRepository(StrategySignal)
    private signalRepo: Repository<StrategySignal>,
  ) {}

  async startSession(userId: string, userEmail: string, bookmakerId: number): Promise<UserSignalSession> {
    // Finalizar sesiones anteriores activas del usuario en este bookmaker
    await this.sessionRepo.update(
      { userId, bookmakerId, isActive: true },
      { isActive: false, endedAt: new Date() }
    );

    // Crear nueva sesión
    const session = this.sessionRepo.create({
      userId,
      userEmail,
      bookmakerId,
      startedAt: new Date(),
      isActive: true,
    });

    const saved = await this.sessionRepo.save(session);
    this.logger.log(`✅ Sesión iniciada: Usuario ${userEmail} en bookmaker ${bookmakerId}`);
    return saved;
  }

  async stopSession(userId: string, bookmakerId: number): Promise<void> {
    await this.sessionRepo.update(
      { userId, bookmakerId, isActive: true },
      { isActive: false, endedAt: new Date() }
    );
    this.logger.log(`🛑 Sesión detenida: Usuario ${userId} en bookmaker ${bookmakerId}`);
  }

  async isUserInSession(userId: string, bookmakerId: number): Promise<boolean> {
    const session = await this.sessionRepo.findOne({
      where: { userId, bookmakerId, isActive: true },
    });
    return !!session;
  }

  async getActiveSession(userId: string, bookmakerId: number): Promise<UserSignalSession | null> {
    return this.sessionRepo.findOne({
      where: { userId, bookmakerId, isActive: true },
    });
  }

  async assignSignalToUser(signalId: string, userId: string, userEmail: string): Promise<void> {
    await this.signalRepo.update(signalId, {
      userId,
      userEmail,
    });
    this.logger.log(`📝 Señal ${signalId} asignada a usuario ${userEmail}`);
  }

  async getSignalsForUser(bookmakerId: number, userId: string, limit: number = 50): Promise<StrategySignal[]> {
    // Obtener señales del usuario + señales globales (userId = null)
    return this.signalRepo
      .createQueryBuilder('signal')
      .where('signal.bookmakerId = :bookmakerId', { bookmakerId })
      .andWhere('(signal.userId = :userId OR signal.userId IS NULL)', { userId })
      .orderBy('signal.createdAt', 'DESC')
      .take(limit)
      .getMany();
  }
}
