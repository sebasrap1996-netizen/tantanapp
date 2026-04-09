import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserBookmakerAuth } from '../entities/user-bookmaker-auth.entity';
import { Bookmaker } from '../entities/bookmaker.entity';


export interface AuthResult {
  success: boolean;
  message: string;
  data?: {
    userId?: string;
    balance?: number;
    currency?: string;
  };
  error?: string;
}

@Injectable()
export class UserBookmakerAuthService {
  private readonly logger = new Logger(UserBookmakerAuthService.name);

  constructor(
    @InjectRepository(UserBookmakerAuth)
    private readonly authRepository: Repository<UserBookmakerAuth>,
    @InjectRepository(Bookmaker)
    private readonly bookmakerRepository: Repository<Bookmaker>,
  ) {}






  /**
   * Obtiene la configuración de autenticación del usuario
   */
  async getAuthConfig(userId: string, bookmakerId: number): Promise<UserBookmakerAuth | null> {
    return this.authRepository.findOne({
      where: { userId, bookmakerId },
      relations: ['bookmaker'],
    });
  }

  /**
   * Obtiene todas las configuraciones de autenticación del usuario
   */
  async getAllAuthConfigs(userId: string): Promise<UserBookmakerAuth[]> {
    return this.authRepository.find({
      where: { userId },
      relations: ['bookmaker'],
    });
  }

  /**
   * Elimina la configuración de autenticación
   */
  async deleteAuthConfig(userId: string, bookmakerId: number): Promise<boolean> {
    const result = await this.authRepository.delete({
      userId,
      bookmakerId,
    });
    return (result.affected || 0) > 0;
  }
}
