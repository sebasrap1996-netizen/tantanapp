import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { Bookmaker } from './bookmaker.entity';

/**
 * Historial de apuestas del usuario obtenido del bookmaker
 * Se sincroniza automáticamente cada ronda en modo automático
 */
@Entity('user_bet_history')
export class UserBetHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  @Index()
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'int', name: 'bookmaker_id' })
  @Index()
  bookmakerId: number;

  @ManyToOne(() => Bookmaker)
  @JoinColumn({ name: 'bookmaker_id' })
  bookmaker: Bookmaker;

  /**
   * ID de la ronda en el bookmaker
   */
  @Column({ type: 'varchar', length: 100, name: 'round_id' })
  @Index()
  roundId: string;

  /**
   * ID de la apuesta (1 o 2)
   */
  @Column({ type: 'int', name: 'bet_id' })
  betId: 1 | 2;

  /**
   * Cantidad apostada
   */
  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'bet_amount' })
  betAmount: number;

  /**
   * Multiplicador objetivo (auto cashout)
   */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, name: 'target_multiplier' })
  targetMultiplier: number | null;

  /**
   * Multiplicador resultado (donde cayó el avión)
   */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, name: 'result_multiplier' })
  resultMultiplier: number | null;

  /**
   * Multiplicador donde se retiró (cashout)
   */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, name: 'cashout_multiplier' })
  cashoutMultiplier: number | null;

  /**
   * Estado de la apuesta
   */
  @Column({ 
    type: 'enum', 
    enum: ['PENDING', 'WON', 'LOST', 'CASHOUT'],
    default: 'PENDING'
  })
  @Index()
  status: 'PENDING' | 'WON' | 'LOST' | 'CASHOUT';

  /**
   * Ganancia/pérdida
   */
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  profit: number | null;

  /**
   * Balance después de la apuesta
   */
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true, name: 'balance_after' })
  balanceAfter: number | null;

  /**
   * Fecha de la apuesta (del bookmaker)
   */
  @Column({ type: 'timestamp', name: 'bet_at' })
  betAt: Date;

  /**
   * Username del jugador en el bookmaker
   */
  @Column({ type: 'varchar', length: 100, nullable: true, name: 'player_username' })
  playerUsername: string | null;

  /**
   * ID del jugador en el bookmaker
   */
  @Column({ type: 'varchar', length: 100, nullable: true, name: 'player_id' })
  playerId: string | null;

  /**
   * Moneda de la apuesta
   */
  @Column({ type: 'varchar', length: 10, nullable: true })
  currency: string | null;

  /**
   * Si fue apuesta del sistema automático
   */
  @Column({ type: 'boolean', default: false, name: 'is_auto_bet' })
  isAutoBet: boolean;

  /**
   * ID de la sesión de apuestas automáticas (si aplica)
   */
  @Column({ type: 'uuid', nullable: true, name: 'session_id' })
  sessionId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
