import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Game } from './game.entity';

@Entity('bookmakers')
export class Bookmaker {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'game_id' })
  gameId: number;

  @Column({ type: 'varchar', length: 100 })
  bookmaker: string;

  @Column({ name: 'bookmaker_img', type: 'varchar', length: 255 })
  bookmakerImg: string;

  @Column({ name: 'url_websocket', type: 'varchar', length: 500, nullable: true })
  urlWebsocket: string;

  @Column({ name: 'api_message', type: 'text', nullable: true })
  apiMessage: string;

  @Column({ name: 'auth_message', type: 'text', nullable: true })
  authMessage: string;

  @Column({ name: 'ping_message', type: 'text', nullable: true })
  pingMessage: string;

  @Column({ name: 'bookmaker_url', type: 'varchar', length: 500, nullable: true })
  bookmakerUrl: string;

  @Column({ name: 'casino_game_id', type: 'int', nullable: true, default: 52358 })
  casinoGameId: number;

  @Column({ name: 'game_url_template', type: 'varchar', length: 500, nullable: true })
  gameUrlTemplate: string;


  @Column({ name: 'scale_img', type: 'int', default: 65 })
  scaleImg: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Game, game => game.id)
  @JoinColumn({ name: 'game_id' })
  game: Game;
}
