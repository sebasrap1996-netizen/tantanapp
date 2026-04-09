import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveCookieFieldsFromBookmakers1745000000000 implements MigrationInterface {
  name = 'RemoveCookieFieldsFromBookmakers1745000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Remove cookie-related columns from bookmakers table
    await queryRunner.query(`
      ALTER TABLE bookmakers 
      DROP COLUMN IF EXISTS balance_url,
      DROP COLUMN IF EXISTS balance_headers,
      DROP COLUMN IF EXISTS balance_response_type,
      DROP COLUMN IF EXISTS balance_field_path,
      DROP COLUMN IF EXISTS currency_field_path,
      DROP COLUMN IF EXISTS cookie_token_names,
      DROP COLUMN IF EXISTS supports_cookies
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Add back the cookie-related columns (for rollback)
    await queryRunner.query(`
      ALTER TABLE bookmakers 
      ADD COLUMN balance_url varchar(500),
      ADD COLUMN balance_headers json,
      ADD COLUMN balance_response_type varchar(50) DEFAULT 'array_first',
      ADD COLUMN balance_field_path varchar(255) DEFAULT 'balance[0].money',
      ADD COLUMN currency_field_path varchar(255) DEFAULT 'balance[0].kode',
      ADD COLUMN cookie_token_names varchar(255),
      ADD COLUMN supports_cookies boolean DEFAULT false
    `);
  }
}
