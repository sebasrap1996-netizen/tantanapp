import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateStrategySignals1743442800000 implements MigrationInterface {
  name = 'CreateStrategySignals1743442800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Eliminar tablas existentes si existen (para evitar conflictos)
    await queryRunner.query(`DROP TABLE IF EXISTS user_signal_sessions CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS strategy_signals CASCADE`);

    // Create strategy_signals table
    await queryRunner.query(`
      CREATE TABLE strategy_signals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bookmaker_id INTEGER NOT NULL,
        strategy_name VARCHAR(100) NOT NULL,
        user_id UUID,
        user_email VARCHAR(255),
        trigger_time TIMESTAMP NOT NULL,
        trigger_multiplier DECIMAL(10, 2),
        round_id VARCHAR(100),
        target_multiplier DECIMAL(10, 2) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        result_multiplier DECIMAL(10, 2),
        type VARCHAR(50),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT chk_strategy_signals_status CHECK (status IN ('PENDING', 'WIN', 'LOSS', 'GALE'))
      )
    `);

    // Create indexes for strategy_signals
    await queryRunner.query(`CREATE INDEX idx_strategy_signals_bookmaker ON strategy_signals (bookmaker_id)`);
    await queryRunner.query(`CREATE INDEX idx_strategy_signals_strategy ON strategy_signals (strategy_name)`);
    await queryRunner.query(`CREATE INDEX idx_strategy_signals_user ON strategy_signals (user_id)`);
    await queryRunner.query(`CREATE INDEX idx_strategy_signals_round ON strategy_signals (round_id)`);
    await queryRunner.query(`CREATE INDEX idx_strategy_signals_status ON strategy_signals (status)`);

    // Create user_signal_sessions table
    await queryRunner.query(`
      CREATE TABLE user_signal_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        user_email VARCHAR(255) NOT NULL,
        bookmaker_id INTEGER NOT NULL,
        started_at TIMESTAMP NOT NULL,
        ended_at TIMESTAMP,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // Create indexes for user_signal_sessions
    await queryRunner.query(`CREATE INDEX idx_user_signal_sessions_user ON user_signal_sessions (user_id)`);
    await queryRunner.query(`CREATE INDEX idx_user_signal_sessions_bookmaker ON user_signal_sessions (bookmaker_id)`);
    await queryRunner.query(`CREATE INDEX idx_user_signal_sessions_active ON user_signal_sessions (is_active)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS user_signal_sessions CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS strategy_signals CASCADE`);
  }
}
