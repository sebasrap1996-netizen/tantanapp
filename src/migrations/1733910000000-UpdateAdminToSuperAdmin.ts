import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateAdminToSuperAdmin1733910000000 implements MigrationInterface {
  name = 'UpdateAdminToSuperAdmin1733910000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "users" 
      SET "role" = 'superadmin' 
      WHERE "email" = 'admin@aviator.com'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "users" 
      SET "role" = 'admin' 
      WHERE "email" = 'admin@aviator.com'
    `);
  }
}
