import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsers1733902000000 implements MigrationInterface {
  name = 'CreateUsers1733902000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "fullName" VARCHAR(255) NOT NULL,
        "email" VARCHAR(255) NOT NULL UNIQUE,
        "password" VARCHAR(255) NOT NULL,
        "isEmailVerified" BOOLEAN DEFAULT false,
        "lastLoginAt" TIMESTAMP,
        "resetCode" VARCHAR(6),
        "resetCodeExpiresAt" TIMESTAMP,
        "resetCodeUsed" BOOLEAN DEFAULT false,
        "role" VARCHAR(20) NOT NULL DEFAULT 'user',
        "profilePicture" VARCHAR(500),
        "creditsBalance" INTEGER DEFAULT 0,
        "creditsTotalEarned" INTEGER DEFAULT 0,
        "creditsTotalSpent" INTEGER DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_users_role" CHECK ("role" IN ('user', 'admin', 'superadmin'))
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_users_email" ON "users" ("email")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_users_role" ON "users" ("role")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_role"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_email"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
  }
}
