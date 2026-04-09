import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AviatorWebSocketService } from './aviator-websocket.service';
import { GoBetWebSocketService } from './gobet-websocket.service';
import { AviatorController } from './aviator.controller';
import { AviatorService } from './aviator.service';
import { AviatorWs } from '../../entities/aviator-ws.entity';
import { AviatorRound } from '../../entities/aviator-round.entity';
import { Bookmaker } from '../../entities/bookmaker.entity';

import { AviatorHistoryService } from './aviator-history.service';
import { AuthModule } from '../../auth/auth.module';
import { GamesModule } from '../../games/games.module';
import { AviatorGateway } from '../../gateways/aviator.gateway';
import { StrategiesModule } from '../../services/strategies/strategies.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AviatorWs, AviatorRound, Bookmaker
    ]),
    AuthModule,
    GamesModule,
    forwardRef(() => StrategiesModule),
  ],
  controllers: [AviatorController],
  providers: [
    AviatorWebSocketService, 
    GoBetWebSocketService,
    AviatorHistoryService, 
    AviatorService,
    AviatorGateway,
  ],
  exports: [
    AviatorWebSocketService, 
    GoBetWebSocketService,
    AviatorHistoryService, 
    AviatorService,
    AviatorGateway,
  ],
})
export class AviatorModule {}
