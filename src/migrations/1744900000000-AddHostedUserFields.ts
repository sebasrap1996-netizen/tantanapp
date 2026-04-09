import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHostedUserFields1744900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Verificar si las columnas ya existen
    const table = await queryRunner.getTable('user_bookmaker_auths');
    
    const isHostedExists = table?.findColumnByName('is_hosted');
    const hostedNotesExists = table?.findColumnByName('hosted_notes');
    const hostedMarkedAtExists = table?.findColumnByName('hosted_marked_at');
    const hostedMarkedByExists = table?.findColumnByName('hosted_marked_by');

    // Agregar columna is_hosted
    if (!isHostedExists) {
      await queryRunner.query(`
        ALTER TABLE user_bookmaker_auths 
        ADD COLUMN is_hosted BOOLEAN DEFAULT FALSE
      `);
      console.log('Column is_hosted added to user_bookmaker_auths');
    }

    // Agregar columna hosted_notes
    if (!hostedNotesExists) {
      await queryRunner.query(`
        ALTER TABLE user_bookmaker_auths 
        ADD COLUMN hosted_notes TEXT
      `);
      console.log('Column hosted_notes added to user_bookmaker_auths');
    }

    // Agregar columna hosted_marked_at
    if (!hostedMarkedAtExists) {
      await queryRunner.query(`
        ALTER TABLE user_bookmaker_auths 
        ADD COLUMN hosted_marked_at TIMESTAMP
      `);
      console.log('Column hosted_marked_at added to user_bookmaker_auths');
    }

    // Agregar columna hosted_marked_by
    if (!hostedMarkedByExists) {
      await queryRunner.query(`
        ALTER TABLE user_bookmaker_auths 
        ADD COLUMN hosted_marked_by UUID
      `);
      console.log('Column hosted_marked_by added to user_bookmaker_auths');
    }

    // Agregar comentarios descriptivos
    await queryRunner.query(`
      COMMENT ON COLUMN user_bookmaker_auths.is_hosted IS 'Indica si el usuario está alojado (usando cuenta compartida)'
    `);
    
    await queryRunner.query(`
      COMMENT ON COLUMN user_bookmaker_auths.hosted_notes IS 'Notas sobre el estado de alojado'
    `);
    
    await queryRunner.query(`
      COMMENT ON COLUMN user_bookmaker_auths.hosted_marked_at IS 'Fecha en que se marcó como alojado'
    `);
    
    await queryRunner.query(`
      COMMENT ON COLUMN user_bookmaker_auths.hosted_marked_by IS 'ID del admin que marcó al usuario como alojado'
    `);

    // Crear índice para búsquedas rápidas de usuarios alojados
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_user_bookmaker_auths_hosted 
      ON user_bookmaker_auths(is_hosted) 
      WHERE is_hosted = TRUE
    `);
    console.log('Index idx_user_bookmaker_auths_hosted created');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Eliminar índice
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_user_bookmaker_auths_hosted
    `);

    // Eliminar columnas
    await queryRunner.query(`
      ALTER TABLE user_bookmaker_auths 
      DROP COLUMN IF EXISTS hosted_marked_by
    `);
    
    await queryRunner.query(`
      ALTER TABLE user_bookmaker_auths 
      DROP COLUMN IF EXISTS hosted_marked_at
    `);
    
    await queryRunner.query(`
      ALTER TABLE user_bookmaker_auths 
      DROP COLUMN IF EXISTS hosted_notes
    `);
    
    await queryRunner.query(`
      ALTER TABLE user_bookmaker_auths 
      DROP COLUMN IF EXISTS is_hosted
    `);
    
    console.log('Hosted user fields removed from user_bookmaker_auths');
  }
}
