import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from './user.entity';

export enum CreditTransactionType {
  EARNED = 'earned',
  SPENT = 'spent',
  BONUS = 'bonus',
  REFUND = 'refund',
  ADMIN_ADJUSTMENT = 'admin_adjustment'
}

export enum CreditTransactionSource {
  SIGNAL_WIN = 'signal_win',
  SIGNAL_ACCESS = 'signal_access',
  AUTO_BET = 'auto_bet',        // Apuesta automática realizada por el bot
  ADMIN_GRANT = 'admin_grant',
  PURCHASE = 'purchase',
  REFERRAL = 'referral'
}

@Entity('credit_transactions')
export class CreditTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  @Index()
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({
    type: 'enum',
    enum: CreditTransactionType,
    name: 'transaction_type'
  })
  transactionType: CreditTransactionType;

  @Column({
    type: 'enum',
    enum: CreditTransactionSource,
    name: 'source'
  })
  source: CreditTransactionSource;

  @Column({ type: 'int' })
  amount: number;

  @Column({ type: 'int', name: 'balance_before' })
  balanceBefore: number;

  @Column({ type: 'int', name: 'balance_after' })
  balanceAfter: number;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'reference_id' })
  referenceId: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
