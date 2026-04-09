import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { User } from './user.entity';
import { Bookmaker } from './bookmaker.entity';
import { UserBookmakerAuth } from './user-bookmaker-auth.entity';

/**
 * Sesión de apuestas automáticas
 * Se crea cuando el usuario inicia el modo automático
 */
@Entity('user_betting_sessions')
export class UserBettingSession {
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

  @Column({ type: 'uuid', name: 'auth_id' })
  authId: string;

  @ManyToOne(() => UserBookmakerAuth)
  @JoinColumn({ name: 'auth_id' })
  auth: UserBookmakerAuth;

  /**
   * Configuración de la sesión
   */
  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'bet_amount' })
  betAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'target_multiplier' })
  targetMultiplier: number;

  @Column({ type: 'int', name: 'max_gales' })
  maxGales: number;

  /**
   * Estado de la sesión
   */
  @Column({ 
    type: 'enum', 
    enum: ['PENDING', 'ACTIVE', 'PAUSED', 'STOPPED', 'ERROR'],
    default: 'PENDING'
  })
  @Index()
  status: 'PENDING' | 'ACTIVE' | 'PAUSED' | 'STOPPED' | 'ERROR';

  /**
   * Estado de la conexión WebSocket
   */
  @Column({ 
    type: 'enum', 
    enum: ['DISCONNECTED', 'CONNECTING', 'CONNECTED', 'BETTING', 'WAITING'],
    default: 'DISCONNECTED',
    name: 'ws_status'
  })
  wsStatus: 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'BETTING' | 'WAITING';

  /**
   * Estadísticas de la sesión
   */
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, name: 'initial_balance' })
  initialBalance: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, name: 'current_balance' })
  currentBalance: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, name: 'total_profit' })
  totalProfit: number;

  @Column({ type: 'int', default: 0, name: 'total_bets' })
  totalBets: number;

  @Column({ type: 'int', default: 0 })
  wins: number;

  @Column({ type: 'int', default: 0 })
  losses: number;

  @Column({ type: 'int', default: 0 })
  gales: number;

  /**
   * Apuesta actual en curso
   */
  @Column({ type: 'varchar', length: 100, nullable: true, name: 'current_round_id' })
  currentRoundId: string | null;

  @Column({ type: 'int', nullable: true, name: 'current_bet_id' })
  currentBetId: 1 | 2 | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, name: 'current_bet_amount' })
  currentBetAmount: number | null;

  @Column({ type: 'int', default: 0, name: 'current_gale_level' })
  currentGaleLevel: number;

  /**
   * Timestamps
   */
  @Column({ type: 'timestamp', nullable: true, name: 'started_at' })
  startedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true, name: 'stopped_at' })
  stoppedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
