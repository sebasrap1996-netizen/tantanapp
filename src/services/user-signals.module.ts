import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserSignalsService } from './user-signals.service';
import { StrategySignal } from '../entities/strategy-signal.entity';

@Module({
  imports: [TypeOrmModule.forFeature([StrategySignal])],
  providers: [UserSignalsService],
  exports: [UserSignalsService],
})
export class UserSignalsModule {}
