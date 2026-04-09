import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { Bookmaker } from './bookmaker.entity';

/**
 * Almacena las credenciales de autenticación del usuario para cada bookmaker
 * El usuario configura esto en su perfil
 */
@Entity('user_bookmaker_auths')
export class UserBookmakerAuth {
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
   * Configuración de apuesta por defecto
   */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 100, name: 'default_bet_amount' })
  defaultBetAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 1.5, name: 'default_target_multiplier' })
  defaultTargetMultiplier: number;

  @Column({ type: 'int', default: 1, name: 'default_max_gales' })
  defaultMaxGales: number;

  /**
   * Si el usuario tiene activado el modo automático por defecto
   */
  @Column({ type: 'boolean', default: false, name: 'auto_mode_enabled' })
  autoModeEnabled: boolean;

  /**
   * Estado de la conexión
   */
  @Column({ 
    type: 'enum', 
    enum: ['DISCONNECTED', 'CONNECTING', 'CONNECTED', 'ERROR'],
    default: 'DISCONNECTED',
    name: 'connection_status'
  })
  connectionStatus: 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';

  @Column({ type: 'timestamp', nullable: true, name: 'last_connection_at' })
  lastConnectionAt: Date | null;

  @Column({ type: 'text', nullable: true, name: 'last_error' })
  lastError: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0, name: 'current_balance' })
  currentBalance: number;

  @Column({ type: 'varchar', length: 10, default: 'USD', name: 'currency' })
  currency: string;

  /**
   * Indica si el usuario está alojado (usando cuenta compartida)
   * Usuarios alojados deben ser monitoreados con más atención
   */
  @Column({ type: 'boolean', default: false, name: 'is_hosted' })
  isHosted: boolean;

  /**
   * Notas sobre el estado de alojado
   */
  @Column({ type: 'text', nullable: true, name: 'hosted_notes' })
  hostedNotes: string | null;

  /**
   * Fecha en que se marcó como alojado
   */
  @Column({ type: 'timestamp', nullable: true, name: 'hosted_marked_at' })
  hostedMarkedAt: Date | null;

  /**
   * ID del admin que marcó al usuario como alojado
   */
  @Column({ type: 'uuid', nullable: true, name: 'hosted_marked_by' })
  hostedMarkedBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
