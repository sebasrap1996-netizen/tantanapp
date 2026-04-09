import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAviatorWs1733903000000 implements MigrationInterface {
  name = 'CreateAviatorWs1733903000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "aviator_ws" (
        "id" SERIAL PRIMARY KEY,
        "bookmaker_id" INT NOT NULL,
        "game_id" INT NOT NULL,
        "url_websocket" VARCHAR(500) NOT NULL,
        "api_message" TEXT,
        "auth_message" TEXT,
        "ping_message" TEXT,
        "headers" JSONB,
        "status_ws" VARCHAR(20) NOT NULL DEFAULT 'DISCONNECTED',
        "is_editable" BOOLEAN DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_aviator_ws_bookmaker_id" FOREIGN KEY ("bookmaker_id") REFERENCES "bookmakers"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_aviator_ws_game_id" FOREIGN KEY ("game_id") REFERENCES "games_list"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_aviator_ws_bookmaker_id" ON "aviator_ws" ("bookmaker_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_aviator_ws_game_id" ON "aviator_ws" ("game_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_aviator_ws_status_ws" ON "aviator_ws" ("status_ws")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_aviator_ws_status_ws"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_aviator_ws_game_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_aviator_ws_bookmaker_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "aviator_ws"`);
  }
}
