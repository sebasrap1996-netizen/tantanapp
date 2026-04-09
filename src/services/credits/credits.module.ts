import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../entities/user.entity';
import { CreditTransaction } from '../../entities/credit-transaction.entity';
import { CreditsService } from './credits.service';
import { CreditsController } from './credits.controller';
import { AviatorModule } from '../../logic-apps/Aviator/aviator.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, CreditTransaction]),
    forwardRef(() => AviatorModule),
  ],
  controllers: [CreditsController],
  providers: [CreditsService],
  exports: [CreditsService]
})
export class CreditsModule {}
