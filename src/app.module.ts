import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { GamesModule } from './games/games.module';
import { BookmakersModule } from './games/bookmakers/bookmakers.module';
import { AviatorModule } from './logic-apps/Aviator/aviator.module';
import { StrategiesModule } from './services/strategies/strategies.module';
import { UserSessionModule } from './services/user-session.module';
import { CreditsModule } from './services/credits/credits.module';
import { UserBettingModule } from './services/user-betting/user-betting.module';
import { SignalsModule } from './signals/signals.module';
import { User } from './entities/user.entity';
import { Game } from './entities/game.entity';
import { Bookmaker } from './entities/bookmaker.entity';
import { AviatorWs } from './entities/aviator-ws.entity';
import { AviatorRound } from './entities/aviator-round.entity';
import { StrategySignal } from './entities/strategy-signal.entity';
import { UserSignalSession } from './entities/user-signal-session.entity';
import { CreditTransaction } from './entities/credit-transaction.entity';
import { License } from './entities/license.entity';
import { UserBookmakerAuth } from './entities/user-bookmaker-auth.entity';
import { UserBettingSession } from './entities/user-betting-session.entity';
import { UserBettingHistory } from './entities/user-betting-history.entity';
import { UserBetHistory } from './entities/user-bet-history.entity';
import { SystemPredictionHistory } from './entities/system-prediction-history.entity';
import { LicenseController } from './license.controller';
import { LicenseService } from './services/license.service';
import { UserBookmakerAuthController } from './controllers/user-bookmaker-auth.controller';
import { UserBookmakerAuthService } from './services/user-bookmaker-auth.service';
import { HostedUserController } from './controllers/hosted-user.controller';
import { HostedUserAlertService } from './services/hosted-user-alert.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV === 'production' ? '.env.production' : '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const port = configService.get<number>('DB_PORT') || 5432;
        return {
          type: 'postgres',
          host: configService.get<string>('DB_HOST'),
          port: Number(port),
          username: configService.get<string>('DB_USERNAME'),
          password: configService.get<string>('DB_PASSWORD'),
          database: configService.get<string>('DB_DATABASE'),
          ssl: {
            rejectUnauthorized: false,
          },
          entities: [User, Game, Bookmaker, AviatorWs, AviatorRound, StrategySignal, UserSignalSession, CreditTransaction, License, UserBookmakerAuth, UserBettingSession, UserBettingHistory, UserBetHistory, SystemPredictionHistory],
          synchronize: false,
          extra: {
            max: 10,
            min: 2,
            idleTimeoutMillis: 10000,
            connectionTimeoutMillis: 10000,
          },
          keepConnectionAlive: true,
          poolSize: 10,
        };
      },
      inject: [ConfigService],
    }),
    AuthModule,
    AdminModule,
    GamesModule,
    BookmakersModule,
    AviatorModule,
    StrategiesModule,
    UserSessionModule,
    CreditsModule,
    UserBettingModule,
    SignalsModule,
    TypeOrmModule.forFeature([License, User, CreditTransaction, UserBookmakerAuth, Bookmaker, StrategySignal, AviatorWs]),
  ],
  controllers: [AppController, LicenseController, UserBookmakerAuthController, HostedUserController],
  providers: [AppService, LicenseService, UserBookmakerAuthService, HostedUserAlertService],
})
export class AppModule {}
