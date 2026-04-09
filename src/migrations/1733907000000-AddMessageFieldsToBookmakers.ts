import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMessageFieldsToBookmakers1733907000000 implements MigrationInterface {
  name = 'AddMessageFieldsToBookmakers1733907000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bookmakers" 
      ADD COLUMN "url_websocket" VARCHAR(500),
      ADD COLUMN "api_message" TEXT,
      ADD COLUMN "auth_message" TEXT,
      ADD COLUMN "ping_message" TEXT
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bookmakers" 
      DROP COLUMN IF EXISTS "url_websocket",
      DROP COLUMN IF EXISTS "api_message",
      DROP COLUMN IF EXISTS "auth_message",
      DROP COLUMN IF EXISTS "ping_message"
    `);
  }
}
