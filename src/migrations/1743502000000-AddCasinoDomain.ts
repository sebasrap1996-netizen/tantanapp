import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCasinoDomain1743502000000 implements MigrationInterface {
  name = 'AddCasinoDomain1743502000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "bookmakers" ADD COLUMN IF NOT EXISTS "casino_domain" varchar(255)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "bookmakers" DROP COLUMN IF EXISTS "casino_domain"`);
  }
}
