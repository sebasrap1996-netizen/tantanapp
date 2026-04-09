import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { License, LicenseStatus } from '../entities/license.entity';
import { User } from '../entities/user.entity';
import { CreditTransaction, CreditTransactionType, CreditTransactionSource } from '../entities/credit-transaction.entity';

@Injectable()
export class LicenseService {
  constructor(
    @InjectRepository(License)
    private licenseRepository: Repository<License>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(CreditTransaction)
    private transactionRepository: Repository<CreditTransaction>,
    private dataSource: DataSource
  ) {}

  async redeemLicense(licenseKey: string, userId: string) {
    const license = await this.licenseRepository.findOne({
      where: { licenseKey: licenseKey.toUpperCase().trim() }
    });

    if (!license) {
      throw new BadRequestException('Licencia no encontrada');
    }

    if (license.status !== LicenseStatus.ACTIVE) {
      throw new BadRequestException('Esta licencia ya fue utilizada o no está disponible');
    }

    if (license.expiresAt && new Date() > license.expiresAt) {
      license.status = LicenseStatus.EXPIRED;
      await this.licenseRepository.save(license);
      throw new BadRequestException('Esta licencia ha expirado');
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    // Usar transacción para asegurar consistencia
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Actualizar licencia
      license.status = LicenseStatus.USED;
      license.redeemedBy = userId;
      license.redeemedAt = new Date();
      await queryRunner.manager.save(license);

      // Actualizar balance del usuario
      const balanceBefore = user.creditsBalance;
      const balanceAfter = balanceBefore + license.creditsAmount;
      
      user.creditsBalance = balanceAfter;
      user.creditsTotalEarned += license.creditsAmount;
      await queryRunner.manager.save(user);

      // Crear transacción de crédito
      const transaction = queryRunner.manager.create(CreditTransaction, {
        userId: userId,
        transactionType: CreditTransactionType.BONUS,
        source: CreditTransactionSource.PURCHASE,
        amount: license.creditsAmount,
        balanceBefore,
        balanceAfter,
        referenceId: license.id,
        description: `Canje de licencia: ${license.licenseKey}`
      });
      await queryRunner.manager.save(transaction);

      await queryRunner.commitTransaction();

      return {
        success: true,
        creditsAdded: license.creditsAmount,
        newBalance: balanceAfter,
        message: `¡Licencia canjeada! Se agregaron ${license.creditsAmount} créditos a tu cuenta`
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException('Error al procesar la licencia');
    } finally {
      await queryRunner.release();
    }
  }

  async generateLicense(creditsAmount: number, createdBy?: string, description?: string, expiresAt?: Date): Promise<License> {
    const licenseKey = this.generateLicenseKey();
    
    const license = this.licenseRepository.create({
      licenseKey,
      type: 'credits' as any,
      status: LicenseStatus.ACTIVE,
      creditsAmount,
      createdBy,
      description,
      expiresAt
    });

    return this.licenseRepository.save(license);
  }

  private generateLicenseKey(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const segments = 4;
    const segmentLength = 4;
    
    const key = Array.from({ length: segments }, () =>
      Array.from({ length: segmentLength }, () => 
        chars.charAt(Math.floor(Math.random() * chars.length))
      ).join('')
    ).join('-');

    return key;
  }

  async getLicenseStats() {
    const total = await this.licenseRepository.count();
    const active = await this.licenseRepository.count({ where: { status: LicenseStatus.ACTIVE } });
    const used = await this.licenseRepository.count({ where: { status: LicenseStatus.USED } });

    return { total, active, used };
  }
}
