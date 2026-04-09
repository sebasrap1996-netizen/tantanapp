import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveSocialLoginColumns1733906000000 implements MigrationInterface {
  name = 'RemoveSocialLoginColumns1733906000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "googleId"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "facebookId"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" 
      ADD COLUMN "googleId" VARCHAR(255),
      ADD COLUMN "facebookId" VARCHAR(255)
    `);
  }
}
