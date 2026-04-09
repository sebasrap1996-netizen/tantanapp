import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserSessionService } from './user-session.service';
import { UserSignalSession } from '../entities/user-signal-session.entity';
import { StrategySignal } from '../entities/strategy-signal.entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([UserSignalSession, StrategySignal])],
  providers: [UserSessionService],
  exports: [UserSessionService],
})
export class UserSessionModule {}
