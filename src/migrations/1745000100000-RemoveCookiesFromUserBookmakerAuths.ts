import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveCookiesFromUserBookmakerAuths1745000100000 implements MigrationInterface {
  name = 'RemoveCookiesFromUserBookmakerAuths1745000100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Remove cookies column from user_bookmaker_auths table
    await queryRunner.query(`
      ALTER TABLE user_bookmaker_auths 
      DROP COLUMN IF EXISTS cookies
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Add back the cookies column (for rollback)
    await queryRunner.query(`
      ALTER TABLE user_bookmaker_auths 
      ADD COLUMN cookies text
    `);
  }
}
