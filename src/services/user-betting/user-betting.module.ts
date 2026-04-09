import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { UserBookmakerAuth } from '../../entities/user-bookmaker-auth.entity';
import { UserBettingSession } from '../../entities/user-betting-session.entity';
import { UserBettingHistory } from '../../entities/user-betting-history.entity';
import { UserBetHistory } from '../../entities/user-bet-history.entity';
import { SystemPredictionHistory } from '../../entities/system-prediction-history.entity';
import { StrategySignal } from '../../entities/strategy-signal.entity';
import { AviatorWs } from '../../entities/aviator-ws.entity';
import { UserBettingService } from './user-betting.service';
import { UserBettingWebSocketService } from './user-betting-websocket.service';
import { UserBettingController } from './user-betting.controller';
import { UserBettingGateway } from '../../gateways/user-betting.gateway';
import { SignalBettingIntegrationService } from './signal-betting-integration.service';
import { StrategiesModule } from '../strategies/strategies.module';
import { CreditsModule } from '../credits/credits.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserBookmakerAuth,
      UserBettingSession,
      UserBettingHistory,
      UserBetHistory,
      SystemPredictionHistory,
      StrategySignal,
      AviatorWs,
    ]),
    StrategiesModule,
    forwardRef(() => CreditsModule),
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET || 'default-secret',
        signOptions: { expiresIn: '7d' },
      }),
    }),
  ],
  controllers: [UserBettingController],
  providers: [
    UserBettingService,
    UserBettingWebSocketService,
    UserBettingGateway,
    SignalBettingIntegrationService,
  ],
  exports: [
    UserBettingService,
    UserBettingWebSocketService,
    SignalBettingIntegrationService,
  ],
})
export class UserBettingModule {}
