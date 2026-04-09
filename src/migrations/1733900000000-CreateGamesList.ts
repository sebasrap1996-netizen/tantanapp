import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateGamesList1733900000000 implements MigrationInterface {
  name = 'CreateGamesList1733900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "games_list" (
        "id" SERIAL PRIMARY KEY,
        "name" VARCHAR(100) NOT NULL,
        "proveedor" VARCHAR(100),
        "proveedor_img" VARCHAR(255),
        "game_img" VARCHAR(255),
        "color" VARCHAR(50),
        "scale_img" INT DEFAULT 65,
        "is_active" BOOLEAN DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_games_list_name" ON "games_list" ("name")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_games_list_is_active" ON "games_list" ("is_active")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_games_list_is_active"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_games_list_name"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "games_list"`);
  }
}
