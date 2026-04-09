import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('strategy_signals')
export class StrategySignal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int', name: 'bookmaker_id' })
  @Index()
  bookmakerId: number;

  @Column({ type: 'varchar', length: 100, name: 'bookmaker_name' })
  @Index()
  bookmakerName: string;

  @Column({ type: 'uuid', nullable: true, name: 'user_id' })
  @Index()
  userId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'user_email' })
  userEmail: string | null;

  @Column({ type: 'timestamp', name: 'trigger_time' })
  triggerTime: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, name: 'trigger_multiplier' })
  triggerMultiplier: number | null;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'round_id' })
  @Index()
  roundId: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'target_multiplier' })
  targetMultiplier: number;

  @Column({
    type: 'enum',
    enum: ['PENDING', 'WIN', 'LOSS', 'GALE'],
    default: 'PENDING'
  })
  @Index()
  status: 'PENDING' | 'WIN' | 'LOSS' | 'GALE';

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, name: 'result_multiplier' })
  resultMultiplier: number | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  type: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
