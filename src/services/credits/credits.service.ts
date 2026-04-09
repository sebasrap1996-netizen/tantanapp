import { Injectable, Logger, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { User } from '../../entities/user.entity';
import { CreditTransaction, CreditTransactionType, CreditTransactionSource } from '../../entities/credit-transaction.entity';
import { AviatorGateway } from '../../gateways/aviator.gateway';

@Injectable()
export class CreditsService {
  private readonly logger = new Logger(CreditsService.name);

  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(CreditTransaction)
    private creditTransactionRepo: Repository<CreditTransaction>,
    private dataSource: DataSource,
    @Inject(forwardRef(() => AviatorGateway))
    private aviatorGateway: AviatorGateway
  ) {}

  async getUserCredits(userId: string): Promise<{ balance: number; totalEarned: number; totalSpent: number } | null> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) return null;
    return {
      balance: user.creditsBalance,
      totalEarned: user.creditsTotalEarned,
      totalSpent: user.creditsTotalSpent
    };
  }

  async addCredits(
    userId: string,
    amount: number,
    type: CreditTransactionType,
    source: CreditTransactionSource,
    referenceId?: string,
    description?: string
  ): Promise<User> {
    if (amount <= 0) {
      throw new BadRequestException('La cantidad debe ser mayor a 0');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const user = await queryRunner.manager.findOne(User, { where: { id: userId } });
      
      if (!user) {
        throw new BadRequestException('Usuario no encontrado');
      }

      const balanceBefore = user.creditsBalance;
      const balanceAfter = balanceBefore + amount;

      // Actualizar balance en User
      user.creditsBalance = balanceAfter;
      user.creditsTotalEarned = user.creditsTotalEarned + amount;
      
      await queryRunner.manager.save(user);

      // Crear transacción
      const transaction = queryRunner.manager.create(CreditTransaction, {
        userId,
        transactionType: type,
        source,
        amount,
        balanceBefore,
        balanceAfter,
        referenceId: referenceId || null,
        description: description || null
      });
      
      await queryRunner.manager.save(transaction);

      await queryRunner.commitTransaction();
      
      this.logger.log(`💰 Créditos añadidos: +${amount} a usuario ${userId} (Balance: ${balanceAfter})`);
      
      return user;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error añadiendo créditos: ${error.message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async deductCredits(
    userId: string,
    amount: number,
    type: CreditTransactionType,
    source: CreditTransactionSource,
    referenceId?: string,
    description?: string
  ): Promise<User> {
    if (amount <= 0) {
      throw new BadRequestException('La cantidad debe ser mayor a 0');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const user = await queryRunner.manager.findOne(User, { where: { id: userId } });
      
      if (!user) {
        throw new BadRequestException('Usuario no encontrado');
      }

      if (user.creditsBalance < amount) {
        throw new BadRequestException(`Saldo insuficiente. Balance: ${user.creditsBalance}, Requerido: ${amount}`);
      }

      const balanceBefore = user.creditsBalance;
      const balanceAfter = balanceBefore - amount;

      // Actualizar balance en User
      user.creditsBalance = balanceAfter;
      user.creditsTotalSpent = user.creditsTotalSpent + amount;
      
      await queryRunner.manager.save(user);

      // Crear transacción
      const transaction = queryRunner.manager.create(CreditTransaction, {
        userId,
        transactionType: type,
        source,
        amount: -amount,
        balanceBefore,
        balanceAfter,
        referenceId: referenceId || null,
        description: description || null
      });
      
      await queryRunner.manager.save(transaction);

      await queryRunner.commitTransaction();
      
      // Emitir actualización de créditos en tiempo real
      if (this.aviatorGateway) {
        this.aviatorGateway.emitCreditsUpdate(userId, {
          balance: balanceAfter,
          totalEarned: user.creditsTotalEarned,
          totalSpent: user.creditsTotalSpent
        });
      } else {
        this.logger.warn(`⚠️ AviatorGateway no disponible para emitir credits_update a usuario ${userId}`);
      }
      
      this.logger.log(`💸 Créditos deducidos: -${amount} de usuario ${userId} (Balance: ${balanceAfter})`);
      
      return user;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error deduciendo créditos: ${error.message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async deductCreditsOnSignalWin(
    userId: string,
    signalId: string,
    strategyName: string
  ): Promise<User> {
    const COST_PER_WIN_SIGNAL = 1; // 1 crédito por señal ganada
    
    try {
      const result = await this.deductCredits(
        userId,
        COST_PER_WIN_SIGNAL,
        CreditTransactionType.SPENT,
        CreditTransactionSource.SIGNAL_ACCESS,
        signalId,
        `Acceso a señal ganada: ${strategyName}`
      );
      return result;
    } catch (error) {
      this.logger.warn(`No se pudieron deducir créditos para señal ${signalId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Deduce créditos cuando una apuesta automática gana
   * Similar al sistema de señales manuales
   */
  async deductCreditsOnAutoBetWin(
    userId: string,
    sessionId: string,
    betId: number,
    multiplier: number,
    profit: number
  ): Promise<User> {
    const COST_PER_WIN_AUTO_BET = 1; // 1 crédito por apuesta automática ganada
    
    try {
      const result = await this.deductCredits(
        userId,
        COST_PER_WIN_AUTO_BET,
        CreditTransactionType.SPENT,
        CreditTransactionSource.AUTO_BET,
        sessionId,
        `Apuesta automática ganada: ${multiplier}x (+$${profit.toFixed(2)}) - Bet #${betId}`
      );
      return result;
    } catch (error) {
      this.logger.warn(`No se pudieron deducir créditos para apuesta automática ${sessionId}: ${error.message}`);
      throw error;
    }
  }

  async hasEnoughCredits(userId: string, amount: number): Promise<boolean> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) return false;
    return user.creditsBalance >= amount;
  }

  async getTransactionHistory(userId: string, limit: number = 50): Promise<CreditTransaction[]> {
    return this.creditTransactionRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit
    });
  }
}
