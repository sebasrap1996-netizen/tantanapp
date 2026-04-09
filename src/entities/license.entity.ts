import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from './user.entity';

export enum LicenseStatus {
  ACTIVE = 'active',
  USED = 'used',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled'
}

export enum LicenseType {
  CREDITS = 'credits',
  SUBSCRIPTION = 'subscription',
  BONUS = 'bonus'
}

@Entity('licenses')
export class License {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  @Index()
  licenseKey: string;

  @Column({
    type: 'enum',
    enum: LicenseType,
    default: LicenseType.CREDITS
  })
  type: LicenseType;

  @Column({
    type: 'enum',
    enum: LicenseStatus,
    default: LicenseStatus.ACTIVE
  })
  status: LicenseStatus;

  @Column({ type: 'int' })
  creditsAmount: number;

  @Column({ type: 'uuid', nullable: true, name: 'redeemed_by' })
  redeemedBy: string | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'redeemed_by' })
  redeemedByUser: User | null;

  @Column({ type: 'timestamp', nullable: true, name: 'redeemed_at' })
  redeemedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true, name: 'expires_at' })
  expiresAt: Date | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'created_by' })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
