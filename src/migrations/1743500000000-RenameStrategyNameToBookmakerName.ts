import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameStrategyNameToBookmakerName1743500000000 implements MigrationInterface {
  name = 'RenameStrategyNameToBookmakerName1743500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Verificar si la columna strategy_name existe
    const columnExists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'strategy_signals' 
        AND column_name = 'strategy_name'
      )
    `);

    if (columnExists[0]?.exists) {
      // Renombrar columna strategy_name a bookmaker_name
      await queryRunner.query(`
        ALTER TABLE strategy_signals 
        RENAME COLUMN strategy_name TO bookmaker_name
      `);
      
      // Renombrar índice
      await queryRunner.query(`
        DROP INDEX IF EXISTS idx_strategy_signals_strategy
      `);
      await queryRunner.query(`
        CREATE INDEX idx_strategy_signals_bookmaker_name ON strategy_signals (bookmaker_name)
      `);
    } else {
      console.log('Column strategy_name does not exist, skipping rename...');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Verificar si la columna bookmaker_name existe
    const columnExists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'strategy_signals' 
        AND column_name = 'bookmaker_name'
      )
    `);

    if (columnExists[0]?.exists) {
      // Revertir: renombrar bookmaker_name a strategy_name
      await queryRunner.query(`
        ALTER TABLE strategy_signals 
        RENAME COLUMN bookmaker_name TO strategy_name
      `);
      
      // Restaurar índice original
      await queryRunner.query(`
        DROP INDEX IF EXISTS idx_strategy_signals_bookmaker_name
      `);
      await queryRunner.query(`
        CREATE INDEX idx_strategy_signals_strategy ON strategy_signals (strategy_name)
      `);
    }
  }
}
