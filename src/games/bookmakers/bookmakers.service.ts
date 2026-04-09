import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bookmaker } from '../../entities/bookmaker.entity';
import { AviatorWs } from '../../entities/aviator-ws.entity';
import { CreateBookmakerDto } from './dto/create-bookmaker.dto';
import { UpdateBookmakerDto } from './dto/update-bookmaker.dto';

@Injectable()
export class BookmakersService {
  constructor(
    @InjectRepository(Bookmaker)
    private bookmakersRepository: Repository<Bookmaker>,
    @InjectRepository(AviatorWs)
    private aviatorWsRepository: Repository<AviatorWs>,
  ) {}

  async findAll(): Promise<Bookmaker[]> {
    return this.bookmakersRepository.find({
      relations: ['game'],
    });
  }

  async findByGameId(gameId: number): Promise<Bookmaker[]> {
    return this.bookmakersRepository.find({
      where: { gameId },
      relations: ['game'],
    });
  }

  async findOne(id: number): Promise<Bookmaker | null> {
    return this.bookmakersRepository.findOne({
      where: { id },
      relations: ['game'],
    });
  }

  async create(createBookmakerDto: CreateBookmakerDto): Promise<Bookmaker> {
    const bookmaker = this.bookmakersRepository.create({
      ...createBookmakerDto,
      scaleImg: createBookmakerDto.scaleImg ?? 65,
      isActive: createBookmakerDto.isActive ?? true,
    });
    const savedBookmaker = await this.bookmakersRepository.save(bookmaker);

    // Si es un bookmaker para Aviator (gameId: 1), crear registro en aviator_ws
    if (savedBookmaker.gameId === 1 && createBookmakerDto.urlWebsocket) {
      const aviatorWs = this.aviatorWsRepository.create({
        bookmakerId: savedBookmaker.id,
        gameId: 1,
        url_websocket: createBookmakerDto.urlWebsocket.trim(),
        api_message: createBookmakerDto.apiMessage || '',
        auth_message: createBookmakerDto.authMessage || '',
        ping_message: createBookmakerDto.pingMessage || '',
        status_ws: 'DISCONNECTED',
        is_editable: true,
      });
      await this.aviatorWsRepository.save(aviatorWs);
    }

    return savedBookmaker;
  }

  async update(
    id: number,
    updateBookmakerDto: UpdateBookmakerDto,
  ): Promise<Bookmaker | null> {
    await this.bookmakersRepository.update(id, updateBookmakerDto);

    // Si es Aviator y hay campos de WebSocket, actualizar también aviator_ws
    const bookmaker = await this.findOne(id);
    if (bookmaker && bookmaker.gameId === 1) {
      const aviatorWs = await this.aviatorWsRepository.findOne({
        where: { bookmakerId: id },
      });

      if (aviatorWs) {
        // Actualizar registro existente
        if (updateBookmakerDto.urlWebsocket !== undefined) {
          aviatorWs.url_websocket = updateBookmakerDto.urlWebsocket.trim();
        }
        if (updateBookmakerDto.apiMessage !== undefined) {
          aviatorWs.api_message = updateBookmakerDto.apiMessage;
        }
        if (updateBookmakerDto.authMessage !== undefined) {
          aviatorWs.auth_message = updateBookmakerDto.authMessage;
        }
        if (updateBookmakerDto.pingMessage !== undefined) {
          aviatorWs.ping_message = updateBookmakerDto.pingMessage;
        }
        await this.aviatorWsRepository.save(aviatorWs);
      } else if (updateBookmakerDto.urlWebsocket) {
        // Crear nuevo registro si no existe y se proporciona URL
        const newAviatorWs = this.aviatorWsRepository.create({
          bookmakerId: id,
          gameId: 1,
          url_websocket: updateBookmakerDto.urlWebsocket,
          api_message: updateBookmakerDto.apiMessage || '',
          auth_message: updateBookmakerDto.authMessage || '',
          ping_message: updateBookmakerDto.pingMessage || '',
          status_ws: 'DISCONNECTED',
          is_editable: true,
        });
        await this.aviatorWsRepository.save(newAviatorWs);
      }
    }

    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    // El registro en aviator_ws se eliminará automáticamente por ON DELETE CASCADE
    await this.bookmakersRepository.delete(id);
  }
}
