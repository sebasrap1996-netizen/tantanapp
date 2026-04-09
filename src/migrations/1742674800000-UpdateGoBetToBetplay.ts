import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateGoBetToBetplay1742674800000 implements MigrationInterface {
  name = 'UpdateGoBetToBetplay1742674800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Update GoBet bookmaker to Betplay with new logo
    await queryRunner.query(`
      UPDATE "bookmakers"
      SET "bookmaker" = 'Betplay',
          "bookmaker_img" = '/logos/betplay.webp',
          "updated_at" = now()
      WHERE LOWER("bookmaker") LIKE '%gobet%'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert Betplay back to GoBet (if needed)
    await queryRunner.query(`
      UPDATE "bookmakers"
      SET "bookmaker" = 'GoBet',
          "bookmaker_img" = '/logos/gobet-logo.svg',
          "updated_at" = now()
      WHERE LOWER("bookmaker") LIKE '%betplay%'
    `);
  }
}
