import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBookmakers1733901000000 implements MigrationInterface {
  name = 'CreateBookmakers1733901000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "bookmakers" (
        "id" SERIAL PRIMARY KEY,
        "game_id" INT NOT NULL,
        "bookmaker" VARCHAR(100) NOT NULL,
        "bookmaker_img" VARCHAR(255) NOT NULL,
        "scale_img" INT DEFAULT 65,
        "is_active" BOOLEAN DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_bookmakers_game_id" FOREIGN KEY ("game_id") REFERENCES "games_list"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_bookmakers_game_id" ON "bookmakers" ("game_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_bookmakers_bookmaker" ON "bookmakers" ("bookmaker")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_bookmakers_is_active" ON "bookmakers" ("is_active")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_bookmakers_is_active"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_bookmakers_bookmaker"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_bookmakers_game_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "bookmakers"`);
  }
}
