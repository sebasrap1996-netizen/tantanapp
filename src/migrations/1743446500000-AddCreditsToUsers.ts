import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCreditsToUsers1743446500000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Agregar columnas de créditos a la tabla users existente
    await queryRunner.query(`
      ALTER TABLE "users" 
      ADD COLUMN IF NOT EXISTS "creditsBalance" INTEGER DEFAULT 0
    `);

    await queryRunner.query(`
      ALTER TABLE "users" 
      ADD COLUMN IF NOT EXISTS "creditsTotalEarned" INTEGER DEFAULT 0
    `);

    await queryRunner.query(`
      ALTER TABLE "users" 
      ADD COLUMN IF NOT EXISTS "creditsTotalSpent" INTEGER DEFAULT 0
    `);

    // Eliminar tabla user_credits si existe (ya no se necesita)
    await queryRunner.query(`DROP TABLE IF EXISTS "user_credits"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "creditsTotalSpent"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "creditsTotalEarned"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "creditsBalance"`);
  }
}
