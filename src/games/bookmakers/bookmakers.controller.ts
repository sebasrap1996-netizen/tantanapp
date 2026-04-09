import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { BookmakersService } from './bookmakers.service';
import { Bookmaker } from '../../entities/bookmaker.entity';
import { CreateBookmakerDto } from './dto/create-bookmaker.dto';
import { UpdateBookmakerDto } from './dto/update-bookmaker.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../auth/guards/admin.guard';

@Controller('bookmakers')
export class BookmakersController {
  constructor(private readonly bookmakersService: BookmakersService) {}

  @Get()
  findAll(): Promise<Bookmaker[]> {
    return this.bookmakersService.findAll();
  }

  @Get('game/:gameId')
  findByGameId(@Param('gameId') gameId: string): Promise<Bookmaker[]> {
    return this.bookmakersService.findByGameId(+gameId);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Bookmaker | null> {
    return this.bookmakersService.findOne(+id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  create(@Body() createBookmakerDto: CreateBookmakerDto): Promise<Bookmaker> {
    return this.bookmakersService.create(createBookmakerDto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  update(
    @Param('id') id: string,
    @Body() updateBookmakerDto: UpdateBookmakerDto,
  ): Promise<Bookmaker | null> {
    return this.bookmakersService.update(+id, updateBookmakerDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  remove(@Param('id') id: string): Promise<void> {
    return this.bookmakersService.remove(+id);
  }
}
