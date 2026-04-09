import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StrategiesService } from './strategies.service';
import { StrategySignal } from '../../entities/strategy-signal.entity';
import { UserSignalsModule } from '../user-signals.module';
import { AviatorModule } from '../../logic-apps/Aviator/aviator.module';
import { CreditsModule } from '../credits/credits.module';
import { HostedUserAlertService } from '../hosted-user-alert.service';
import { UserBookmakerAuth } from '../../entities/user-bookmaker-auth.entity';
import { User } from '../../entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([StrategySignal, UserBookmakerAuth, User]),
    forwardRef(() => UserSignalsModule),
    forwardRef(() => AviatorModule),
    forwardRef(() => CreditsModule)
  ],
  providers: [StrategiesService, HostedUserAlertService],
  exports: [StrategiesService],
})
export class StrategiesModule {}
