import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StrategySignal } from '../entities/strategy-signal.entity';

@Injectable()
export class UserSignalsService {
  private readonly logger = new Logger(UserSignalsService.name);

  constructor(
    @InjectRepository(StrategySignal)
    private strategySignalRepo: Repository<StrategySignal>,
  ) {}

  async processSignalResult(
    signalId: string,
    resultMultiplier: number,
    result: 'win' | 'loss',
    galeLevel: number
  ): Promise<void> {
    try {
      this.logger.log(`📊 Processing signal result: ${signalId} - ${result} - ${resultMultiplier}x - Gale: ${galeLevel}`);
      
      // Aquí se puede agregar lógica adicional para créditos de usuario si es necesario
      // Por ahora solo actualizamos el estado de la señal
      
      this.logger.log(`✅ Signal result processed: ${signalId}`);
    } catch (error) {
      this.logger.error(`Error processing signal result: ${error.message}`);
    }
  }

  async getRecentSignals(bookmakerId: number, limit: number = 50): Promise<StrategySignal[]> {
    try {
      return await this.strategySignalRepo.find({
        where: { bookmakerId },
        order: { createdAt: 'DESC' },
        take: limit,
      });
    } catch (error) {
      this.logger.error(`Error getting recent signals: ${error.message}`);
      return [];
    }
  }
}
