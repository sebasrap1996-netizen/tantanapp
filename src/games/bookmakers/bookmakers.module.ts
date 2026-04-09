import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookmakersService } from './bookmakers.service';
import { BookmakersController } from './bookmakers.controller';
import { Bookmaker } from '../../entities/bookmaker.entity';
import { AviatorWs } from '../../entities/aviator-ws.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Bookmaker, AviatorWs])],
  controllers: [BookmakersController],
  providers: [BookmakersService],
  exports: [BookmakersService],
})
export class BookmakersModule {}
