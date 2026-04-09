import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateCurrencyLength1743501000000 implements MigrationInterface {
  name = 'UpdateCurrencyLength1743501000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user_bookmaker_auths" ALTER COLUMN "currency" TYPE varchar(50)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user_bookmaker_auths" ALTER COLUMN "currency" TYPE varchar(10)`);
  }
}
