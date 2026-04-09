import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserBettingTables1743500000000 implements MigrationInterface {
  name = 'CreateUserBettingTables1743500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Tabla: user_bookmaker_auths
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_bookmaker_auths (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        bookmaker_id INTEGER NOT NULL,
        auth_message TEXT NOT NULL,
        is_verified BOOLEAN DEFAULT false,
        verified_at TIMESTAMP NULL,
        current_balance DECIMAL(15,2) NULL,
        currency VARCHAR(10) NULL,
        bookmaker_username VARCHAR(255) NULL,
        bookmaker_player_id VARCHAR(100) NULL,
        default_bet_amount DECIMAL(10,2) DEFAULT 100,
        default_target_multiplier DECIMAL(10,2) DEFAULT 1.5,
        default_max_gales INTEGER DEFAULT 1,
        auto_mode_enabled BOOLEAN DEFAULT false,
        connection_status VARCHAR(20) DEFAULT 'DISCONNECTED',
        last_connection_at TIMESTAMP NULL,
        last_error TEXT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        
        CONSTRAINT fk_user_bookmaker_auth_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_user_bookmaker_auth_bookmaker FOREIGN KEY (bookmaker_id) REFERENCES bookmakers(id) ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`CREATE INDEX idx_user_bookmaker_auths_user ON user_bookmaker_auths(user_id)`);
    await queryRunner.query(`CREATE INDEX idx_user_bookmaker_auths_bookmaker ON user_bookmaker_auths(bookmaker_id)`);

    // Tabla: user_betting_sessions
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_betting_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        bookmaker_id INTEGER NOT NULL,
        auth_id UUID NOT NULL,
        bet_amount DECIMAL(10,2) NOT NULL,
        target_multiplier DECIMAL(10,2) NOT NULL,
        max_gales INTEGER NOT NULL,
        status VARCHAR(20) DEFAULT 'PENDING',
        ws_status VARCHAR(20) DEFAULT 'DISCONNECTED',
        initial_balance DECIMAL(15,2) DEFAULT 0,
        current_balance DECIMAL(15,2) DEFAULT 0,
        total_profit DECIMAL(15,2) DEFAULT 0,
        total_bets INTEGER DEFAULT 0,
        wins INTEGER DEFAULT 0,
        losses INTEGER DEFAULT 0,
        gales INTEGER DEFAULT 0,
        current_round_id VARCHAR(100) NULL,
        current_bet_id INTEGER NULL,
        current_bet_amount DECIMAL(10,2) NULL,
        current_gale_level INTEGER DEFAULT 0,
        started_at TIMESTAMP NULL,
        stopped_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        
        CONSTRAINT fk_user_betting_session_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_user_betting_session_bookmaker FOREIGN KEY (bookmaker_id) REFERENCES bookmakers(id) ON DELETE CASCADE,
        CONSTRAINT fk_user_betting_session_auth FOREIGN KEY (auth_id) REFERENCES user_bookmaker_auths(id) ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`CREATE INDEX idx_user_betting_sessions_user ON user_betting_sessions(user_id)`);
    await queryRunner.query(`CREATE INDEX idx_user_betting_sessions_bookmaker ON user_betting_sessions(bookmaker_id)`);
    await queryRunner.query(`CREATE INDEX idx_user_betting_sessions_status ON user_betting_sessions(status)`);

    // Tabla: user_betting_history
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_betting_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL,
        user_id UUID NOT NULL,
        signal_id UUID NULL,
        signal_strategy VARCHAR(100) NULL,
        round_id VARCHAR(100) NOT NULL,
        bet_id INTEGER NOT NULL,
        bet_amount DECIMAL(10,2) NOT NULL,
        target_multiplier DECIMAL(10,2) NOT NULL,
        client_seed VARCHAR(50) NOT NULL,
        status VARCHAR(20) DEFAULT 'PENDING',
        result_multiplier DECIMAL(10,2) NULL,
        profit DECIMAL(15,2) NULL,
        gale_level INTEGER DEFAULT 0,
        bet_placed_at TIMESTAMP NOT NULL,
        result_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        
        CONSTRAINT fk_user_betting_history_session FOREIGN KEY (session_id) REFERENCES user_betting_sessions(id) ON DELETE CASCADE,
        CONSTRAINT fk_user_betting_history_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_user_betting_history_signal FOREIGN KEY (signal_id) REFERENCES strategy_signals(id) ON DELETE SET NULL
      );
    `);

    await queryRunner.query(`CREATE INDEX idx_user_betting_history_session ON user_betting_history(session_id)`);
    await queryRunner.query(`CREATE INDEX idx_user_betting_history_user ON user_betting_history(user_id)`);
    await queryRunner.query(`CREATE INDEX idx_user_betting_history_round ON user_betting_history(round_id)`);
    await queryRunner.query(`CREATE INDEX idx_user_betting_history_status ON user_betting_history(status)`);

    // Tabla: user_bet_history (historial de apuestas del usuario obtenido del bookmaker)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_bet_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        bookmaker_id INTEGER NOT NULL,
        round_id VARCHAR(100) NOT NULL,
        bet_id INTEGER NOT NULL,
        bet_amount DECIMAL(15,2) NOT NULL,
        target_multiplier DECIMAL(10,2) NULL,
        result_multiplier DECIMAL(10,2) NULL,
        cashout_multiplier DECIMAL(10,2) NULL,
        status VARCHAR(20) DEFAULT 'PENDING',
        profit DECIMAL(15,2) NULL,
        balance_after DECIMAL(15,2) NULL,
        bet_at TIMESTAMP NOT NULL,
        player_username VARCHAR(100) NULL,
        player_id VARCHAR(100) NULL,
        currency VARCHAR(10) NULL,
        is_auto_bet BOOLEAN DEFAULT false,
        session_id UUID NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        
        CONSTRAINT fk_user_bet_history_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_user_bet_history_bookmaker FOREIGN KEY (bookmaker_id) REFERENCES bookmakers(id) ON DELETE CASCADE,
        CONSTRAINT fk_user_bet_history_session FOREIGN KEY (session_id) REFERENCES user_betting_sessions(id) ON DELETE SET NULL
      );
    `);

    await queryRunner.query(`CREATE INDEX idx_user_bet_history_user ON user_bet_history(user_id)`);
    await queryRunner.query(`CREATE INDEX idx_user_bet_history_bookmaker ON user_bet_history(bookmaker_id)`);
    await queryRunner.query(`CREATE INDEX idx_user_bet_history_round ON user_bet_history(round_id)`);
    await queryRunner.query(`CREATE INDEX idx_user_bet_history_status ON user_bet_history(status)`);

    // Tabla: system_prediction_history (predicciones generadas por el sistema automático)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS system_prediction_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        bookmaker_id INTEGER NOT NULL,
        session_id UUID NOT NULL,
        signal_id UUID NULL,
        strategy_name VARCHAR(100) NOT NULL,
        round_id VARCHAR(100) NOT NULL,
        target_multiplier DECIMAL(10,2) NOT NULL,
        entry_multiplier DECIMAL(10,2) NULL,
        bet_amount DECIMAL(10,2) NOT NULL,
        result_multiplier DECIMAL(10,2) NULL,
        status VARCHAR(20) DEFAULT 'PENDING',
        profit DECIMAL(15,2) NULL,
        gale_level INTEGER DEFAULT 0,
        predicted_at TIMESTAMP NOT NULL,
        result_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        
        CONSTRAINT fk_system_prediction_history_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_system_prediction_history_bookmaker FOREIGN KEY (bookmaker_id) REFERENCES bookmakers(id) ON DELETE CASCADE,
        CONSTRAINT fk_system_prediction_history_session FOREIGN KEY (session_id) REFERENCES user_betting_sessions(id) ON DELETE CASCADE,
        CONSTRAINT fk_system_prediction_history_signal FOREIGN KEY (signal_id) REFERENCES strategy_signals(id) ON DELETE SET NULL
      );
    `);

    await queryRunner.query(`CREATE INDEX idx_system_prediction_history_user ON system_prediction_history(user_id)`);
    await queryRunner.query(`CREATE INDEX idx_system_prediction_history_bookmaker ON system_prediction_history(bookmaker_id)`);
    await queryRunner.query(`CREATE INDEX idx_system_prediction_history_session ON system_prediction_history(session_id)`);
    await queryRunner.query(`CREATE INDEX idx_system_prediction_history_round ON system_prediction_history(round_id)`);
    await queryRunner.query(`CREATE INDEX idx_system_prediction_history_status ON system_prediction_history(status)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS system_prediction_history`);
    await queryRunner.query(`DROP TABLE IF EXISTS user_bet_history`);
    await queryRunner.query(`DROP TABLE IF EXISTS user_betting_history`);
    await queryRunner.query(`DROP TABLE IF EXISTS user_betting_sessions`);
    await queryRunner.query(`DROP TABLE IF EXISTS user_bookmaker_auths`);
  }
}
