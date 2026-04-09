import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, MoreThanOrEqual, IsNull, Not } from 'typeorm';
import { User } from '../entities/user.entity';
import { StrategySignal } from '../entities/strategy-signal.entity';
import { UserSignalSession } from '../entities/user-signal-session.entity';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(StrategySignal)
    private signalRepository: Repository<StrategySignal>,
    @InjectRepository(UserSignalSession)
    private sessionRepository: Repository<UserSignalSession>,
  ) {}

  async getAllUsers(page: number = 1, limit: number = 10, search?: string) {
    try {
      const skip = (page - 1) * limit;
      
      let whereCondition = {};
      if (search) {
        whereCondition = [
          { email: Like(`%${search}%`) },
          { fullName: Like(`%${search}%`) }
        ];
      }

      const [users, total] = await this.userRepository.findAndCount({
        where: whereCondition,
        skip,
        take: limit,
        order: { createdAt: 'DESC' }
      });

      return {
        users,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      throw new BadRequestException('Error al obtener usuarios');
    }
  }

  async getUserStats() {
    try {
      const total = await this.userRepository.count();
      
      // Contar usuarios por rol
      const adminCount = await this.userRepository.count({ where: { role: 'admin' } });
      const superadminCount = await this.userRepository.count({ where: { role: 'superadmin' } });
      const userCount = await this.userRepository.count({ where: { role: 'user' } });
      
      // Contar usuarios verificados
      const verifiedCount = await this.userRepository.count({ where: { isEmailVerified: true } });
      
      // Contar usuarios recientes (últimos 30 días)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const recentUsers = await this.userRepository.count({
        where: {
          createdAt: MoreThanOrEqual(thirtyDaysAgo)
        }
      });

      return {
        totalUsers: total,
        usersByRole: {
          admin: adminCount,
          superadmin: superadminCount,
          user: userCount,
        },
        usersByStatus: {
          active: 0,
          expired: 0,
          free: userCount,
        },
        verification: {
          verified: verifiedCount,
          unverified: total - verifiedCount,
        },
        recentUsers: recentUsers,
      };
    } catch (error) {
      throw new BadRequestException('Error al obtener estadísticas de usuarios');
    }
  }

  async getUserById(id: string) {
    try {
      const user = await this.userRepository.findOne({
        where: { id }
      });

      if (!user) {
        throw new BadRequestException('Usuario no encontrado');
      }

      return user;
    } catch (error) {
      throw new BadRequestException('Error al obtener usuario');
    }
  }

  async updateUser(id: string, updateData: Partial<User>) {
    try {
      const user = await this.userRepository.findOne({ where: { id } });
      
      if (!user) {
        throw new BadRequestException('Usuario no encontrado');
      }

      // No permitir actualizar ciertos campos críticos
      delete updateData.id;
      delete updateData.password;
      delete updateData.createdAt;

      await this.userRepository.update(id, updateData);
      
      return { message: 'Usuario actualizado correctamente' };
    } catch (error) {
      throw new BadRequestException('Error al actualizar usuario');
    }
  }

  async deleteUser(id: string) {
    try {
      const user = await this.userRepository.findOne({ where: { id } });
      
      if (!user) {
        throw new BadRequestException('Usuario no encontrado');
      }

      await this.userRepository.delete(id);
      
      return { message: 'Usuario eliminado correctamente' };
    } catch (error) {
      throw new BadRequestException('Error al eliminar usuario');
    }
  }

  async getDashboardStats() {
    try {
      const totalUsers = await this.userRepository.count();

      return {
        totalUsers,
      };
    } catch (error) {
      throw new BadRequestException('Error al obtener estadísticas del dashboard');
    }
  }

  // ==================== SEÑALES ====================

  async getAllSignals(page: number = 1, limit: number = 50, status?: string, userId?: string) {
    try {
      const skip = (page - 1) * limit;
      
      let whereCondition: any = {};
      if (status && status !== 'ALL') {
        whereCondition.status = status;
      }
      if (userId) {
        whereCondition.userId = userId;
      }

      const [signals, total] = await this.signalRepository.findAndCount({
        where: whereCondition,
        skip,
        take: limit,
        order: { createdAt: 'DESC' }
      });

      return {
        signals,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      throw new BadRequestException('Error al obtener señales');
    }
  }

  async getSignalStats() {
    try {
      const total = await this.signalRepository.count();
      const wins = await this.signalRepository.count({ where: { status: 'WIN' } });
      const losses = await this.signalRepository.count({ where: { status: 'LOSS' } });
      const pending = await this.signalRepository.count({ where: { status: 'PENDING' } });
      
      // Señales asignadas a usuarios (userId no es null)
      const assignedSignals = await this.signalRepository.count({ 
        where: { userId: Not(IsNull()) } 
      });
      
      // Señales sin asignar (userId es null)
      const unassignedSignals = await this.signalRepository.count({ 
        where: { userId: IsNull() } 
      });

      // Sesiones activas
      const activeSessions = await this.sessionRepository.count({ where: { isActive: true } });

      return {
        total,
        wins,
        losses,
        pending,
        winRate: total > 0 ? ((wins / (wins + losses)) * 100).toFixed(1) : '0.0',
        assignedSignals,
        unassignedSignals,
        activeSessions
      };
    } catch (error) {
      console.error('Error en getSignalStats:', error);
      throw new BadRequestException('Error al obtener estadísticas de señales');
    }
  }

  async getSignalsByUser(userId: string) {
    try {
      const signals = await this.signalRepository.find({
        where: { userId },
        order: { createdAt: 'DESC' },
        take: 100
      });

      const wins = signals.filter(s => s.status === 'WIN').length;
      const losses = signals.filter(s => s.status === 'LOSS').length;

      return {
        signals,
        stats: {
          total: signals.length,
          wins,
          losses,
          winRate: (wins + losses) > 0 ? ((wins / (wins + losses)) * 100).toFixed(1) : '0.0'
        }
      };
    } catch (error) {
      throw new BadRequestException('Error al obtener señales del usuario');
    }
  }
}
