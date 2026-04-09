import { MigrationInterface, QueryRunner } from 'typeorm';

export class Add1xslotsBookmaker1744400000000 implements MigrationInterface {
  name = 'Add1xslotsBookmaker1744400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Insertar nuevo bookmaker 1xslots
    await queryRunner.query(`
      INSERT INTO bookmakers (game_id, bookmaker, bookmaker_img, casino_domain, game_id_spribe, balance_url, supports_cookies, cookie_token_names, balance_response_type, balance_field_path, currency_field_path, balance_headers, game_url_template, is_active, scale_img, created_at, updated_at)
      VALUES (
        1,
        '1xslots',
        '/logos/1xslots.svg',
        '1xslots.com',
        52358,
        'https://1xslots.com/account-api/user/balance',
        true,
        '["access_token", "user_token", "SESSION"]',
        'array_first',
        'balance[0].money',
        'balance[0].kode',
        '{"x-auth": "Bearer {{user_token}}", "x-app-n": "__V3_HOST_APP__"}',
        'https://1xslots.com/es/slots/game/{gameId}/aviator',
        true,
        65,
        now(),
        now()
      )
    `);

    // Obtener el ID del bookmaker insertado
    const bookmakerResult = await queryRunner.query(`
      SELECT id FROM bookmakers WHERE bookmaker = '1xslots' LIMIT 1
    `);

    if (bookmakerResult && bookmakerResult.length > 0) {
      const bookmakerId = bookmakerResult[0].id;

      // Insertar configuración de aviator_ws para 1xslots
      await queryRunner.query(`
        INSERT INTO aviator_ws (bookmaker_id, game_id, url_websocket, api_message, ping_message, status_ws, is_editable, created_at, updated_at)
        VALUES ($1, 1, 'wss://eu-central-1-game9.spribegaming.com/BlueBox/websocket', 'gAAyEgADAAFjAgAAAWEDAAAAAXASAAIAA2FwaQgABTEuOC40AAJjbAgACkphdmFTY3JpcHQ=', 'gAA+EgADAAFjAgEAAWEDAA0AAXASAAMAAWMIABZjdXJyZW50QmV0c0luZm9IYW5kbGVyAAFyBP////8AAXASAAA=', 'DISCONNECTED', true, now(), now())
      `, [bookmakerId]);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Eliminar configuración de aviator_ws
    const bookmakerResult = await queryRunner.query(`
      SELECT id FROM bookmakers WHERE bookmaker = '1xslots' LIMIT 1
    `);

    if (bookmakerResult && bookmakerResult.length > 0) {
      const bookmakerId = bookmakerResult[0].id;
      await queryRunner.query(`
        DELETE FROM aviator_ws WHERE bookmaker_id = $1
      `, [bookmakerId]);
    }

    // Eliminar bookmaker
    await queryRunner.query(`
      DELETE FROM bookmakers WHERE bookmaker = '1xslots'
    `);
  }
}
