import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StrategySignal } from '../entities/strategy-signal.entity';

@Injectable()
export class SignalsService {
  private readonly logger = new Logger(SignalsService.name);

  constructor(
    @InjectRepository(StrategySignal)
    private signalRepo: Repository<StrategySignal>,
  ) {}

  // Obtener señales globales (userId = null) + señales resueltas (WIN/LOSS) - visibles para todos
  async getGlobalSignals(bookmakerId?: number, limit: number = 50) {
    const query = this.signalRepo
      .createQueryBuilder('signal')
      .where('(signal.userId IS NULL OR signal.status IN (:...resolvedStatuses))', { 
        resolvedStatuses: ['WIN', 'LOSS', 'GALE'] 
      })
      .orderBy('signal.createdAt', 'DESC')
      .take(limit);

    if (bookmakerId) {
      query.andWhere('signal.bookmakerId = :bookmakerId', { bookmakerId });
    }

    const signals = await query.getMany();
    
    return {
      signals,
      total: signals.length,
      mode: 'global',
    };
  }

  // Obtener señales del usuario (solo las asignadas a él)
  async getUserSignals(userId: string, bookmakerId?: number, limit: number = 50) {
    const query = this.signalRepo
      .createQueryBuilder('signal')
      .where('signal.userId = :userId', { userId })
      .orderBy('signal.createdAt', 'DESC')
      .take(limit);

    if (bookmakerId) {
      query.andWhere('signal.bookmakerId = :bookmakerId', { bookmakerId });
    }

    const signals = await query.getMany();
    
    return {
      signals,
      total: signals.length,
      mode: 'my',
    };
  }

  // Obtener señales combinadas: globales + del usuario
  async getCombinedSignals(userId: string, bookmakerId?: number, limit: number = 50) {
    const query = this.signalRepo
      .createQueryBuilder('signal')
      .where('(signal.userId = :userId OR signal.userId IS NULL)', { userId })
      .orderBy('signal.createdAt', 'DESC')
      .take(limit);

    if (bookmakerId) {
      query.andWhere('signal.bookmakerId = :bookmakerId', { bookmakerId });
    }

    const signals = await query.getMany();
    
    return {
      signals,
      total: signals.length,
      mode: 'combined',
    };
  }
}
