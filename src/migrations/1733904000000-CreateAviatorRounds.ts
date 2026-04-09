import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAviatorRounds1733904000000 implements MigrationInterface {
  name = 'CreateAviatorRounds1733904000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "aviator_rounds" (
        "id" SERIAL PRIMARY KEY,
        "bookmaker_id" INT NOT NULL,
        "round_id" VARCHAR(100) NOT NULL,
        "bets_count" INT DEFAULT 0,
        "total_bet_amount" DECIMAL(15, 2) DEFAULT 0.00,
        "online_players" INT DEFAULT 0,
        "max_multiplier" DECIMAL(10, 2) DEFAULT 0.00,
        "total_cashout" DECIMAL(15, 2) DEFAULT 0.00,
        "casino_profit" DECIMAL(15, 2) DEFAULT 0.00,
        "loss_percentage" DECIMAL(5, 2) DEFAULT 0.00,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_aviator_rounds_bookmaker_id" FOREIGN KEY ("bookmaker_id") REFERENCES "bookmakers"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_aviator_rounds_bookmaker_id" ON "aviator_rounds" ("bookmaker_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_aviator_rounds_round_id" ON "aviator_rounds" ("round_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_aviator_rounds_created_at" ON "aviator_rounds" ("created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_aviator_rounds_created_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_aviator_rounds_round_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_aviator_rounds_bookmaker_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "aviator_rounds"`);
  }
}
