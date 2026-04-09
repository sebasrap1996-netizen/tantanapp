import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUniqueConstraintToAviatorRounds1744900100000 implements MigrationInterface {
  name = 'AddUniqueConstraintToAviatorRounds1744900100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Eliminar duplicados existentes primero
    await queryRunner.query(`
      DELETE FROM aviator_rounds a
      USING aviator_rounds b
      WHERE a.id > b.id
      AND a.bookmaker_id = b.bookmaker_id
      AND a.round_id = b.round_id
    `);

    // Agregar restricción única
    await queryRunner.query(`
      ALTER TABLE aviator_rounds
      ADD CONSTRAINT "UQ_aviator_rounds_bookmaker_round" UNIQUE ("bookmaker_id", "round_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE aviator_rounds
      DROP CONSTRAINT IF EXISTS "UQ_aviator_rounds_bookmaker_round"
    `);
  }
}
