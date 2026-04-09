import { MigrationInterface, QueryRunner } from 'typeorm';

export class Fix888starzConfig1744200000000 implements MigrationInterface {
  name = 'Fix888starzConfig1744200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Actualizar 888Starz (ID 1) con configuración correcta
    await queryRunner.query(`
      UPDATE bookmakers 
      SET casino_domain = '888starz.bet',
          game_id_spribe = 52358,
          balance_url = 'https://888starz.bet/account-api/user/balance',
          supports_cookies = true,
          cookie_token_names = '["access_token", "user_token", "SESSION"]',
          balance_response_type = 'array_first',
          balance_field_path = 'balance[0].money',
          currency_field_path = 'balance[0].kode',
          balance_headers = '{"x-auth": "Bearer {{user_token}}", "x-app-n": "__V3_HOST_APP__"}',
          is_active = true
      WHERE id = 1
    `);

    // Actualizar 1Win (ID 4) con configuración
    await queryRunner.query(`
      UPDATE bookmakers 
      SET casino_domain = '1win.com',
          game_id_spribe = 52358,
          balance_url = 'https://1win.com/api/USER-SERVICE-API/api-v1-balances-get-activated',
          supports_cookies = true,
          cookie_token_names = '["1w_token", "session-id", "device-id"]',
          balance_response_type = 'array_first',
          balance_field_path = '[0].amount',
          currency_field_path = '[0].currency',
          balance_headers = '{}',
          is_active = true
      WHERE id = 4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE bookmakers 
      SET casino_domain = NULL, game_id_spribe = NULL, supports_cookies = false
      WHERE id IN (1, 4)
    `);
  }
}
