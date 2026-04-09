import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Agrega índice único compuesto (user_id, bookmaker_id) a user_bookmaker_auths
 * Esto garantiza que un usuario solo pueda tener una configuración por bookmaker
 */
export class AddUniqueUserBookmakerConstraint1744700000000 implements MigrationInterface {
  name = 'AddUniqueUserBookmakerConstraint1744700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Agregar índice único compuesto
    // Esto previene duplicados a nivel de base de datos
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_user_bookmaker_auth_unique" 
      ON "user_bookmaker_auths" ("user_id", "bookmaker_id")
    `);

    // Agregar índice único compuesto para sesiones activas
    // Un usuario solo puede tener una sesión activa por bookmaker
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_user_betting_session_active_unique" 
      ON "user_betting_sessions" ("user_id", "bookmaker_id") 
      WHERE "status" = 'ACTIVE'
    `);

    // Índice para búsquedas eficientes de señales por bookmaker
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_strategy_signals_bookmaker_round" 
      ON "strategy_signals" ("bookmaker_id", "round_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_user_bookmaker_auth_unique"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_user_betting_session_active_unique"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_strategy_signals_bookmaker_round"
    `);
  }
}
