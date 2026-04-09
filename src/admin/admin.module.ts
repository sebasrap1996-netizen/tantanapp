import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuthService } from '../auth/auth.service';
import { EmailService } from '../services/email.service';
import { User } from '../entities/user.entity';
import { StrategySignal } from '../entities/strategy-signal.entity';
import { UserSignalSession } from '../entities/user-signal-session.entity';
import { Bookmaker } from '../entities/bookmaker.entity';
import { AviatorWs } from '../entities/aviator-ws.entity';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, StrategySignal, UserSignalSession, Bookmaker, AviatorWs]),
    HttpModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '24h' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AdminController],
  providers: [AdminService, AuthService, EmailService],
})
export class AdminModule {}
