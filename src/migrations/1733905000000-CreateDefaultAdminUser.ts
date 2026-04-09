import { MigrationInterface, QueryRunner } from 'typeorm';
import * as bcrypt from 'bcryptjs';

export class CreateDefaultAdminUser1733905000000 implements MigrationInterface {
  name = 'CreateDefaultAdminUser1733905000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hashedPassword = await bcrypt.hash('admin123', 10);

    await queryRunner.query(`
      INSERT INTO "users" (
        "fullName",
        "email",
        "password",
        "isEmailVerified",
        "role",
        "createdAt",
        "updatedAt"
      ) VALUES (
        'Administrator',
        'admin@aviator.com',
        '${hashedPassword}',
        true,
        'superadmin',
        now(),
        now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "users" WHERE "email" = 'admin@aviator.com'
    `);
  }
}
