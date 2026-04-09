import { MigrationInterface, QueryRunner } from 'typeorm';

export class Configure1xbetAviator1744000000000 implements MigrationInterface {
  name = 'Configure1xbetAviator1744000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Actualizar bookmaker 1xbet con configuración para cookies
    await queryRunner.query(`
      UPDATE bookmakers 
      SET casino_domain = '1xbet.com',
          game_id_spribe = 52358,
          balance_url = 'https://1xbet.com/api/internal/user/balance',
          supports_cookies = true
      WHERE bookmaker = '1xbet'
    `);

    // Insertar/actualizar configuración de aviator_ws para 1xbet
    // Primero verificar si existe el bookmaker 1xbet
    const bookmakerResult = await queryRunner.query(`
      SELECT id FROM bookmakers WHERE bookmaker = '1xbet' LIMIT 1
    `);

    if (bookmakerResult && bookmakerResult.length > 0) {
      const bookmakerId = bookmakerResult[0].id;

      // Verificar si ya existe configuración en aviator_ws
      const existingConfig = await queryRunner.query(`
        SELECT id FROM aviator_ws WHERE bookmaker_id = $1 AND game_id = 1
      `, [bookmakerId]);

      if (existingConfig && existingConfig.length > 0) {
        // Actualizar configuración existente
        await queryRunner.query(`
          UPDATE aviator_ws 
          SET url_websocket = 'wss://eu-central-1-game9.spribegaming.com/BlueBox/websocket',
              api_message = 'gAAyEgADAAFjAgAAAWEDAAAAAXASAAIAA2FwaQgABTEuOC40AAJjbAgACkphdmFTY3JpcHQ=',
              ping_message = 'gAA+EgADAAFjAgEAAWEDAA0AAXASAAMAAWMIABZjdXJyZW50QmV0c0luZm9IYW5kbGVyAAFyBP////8AAXASAAA=',
              updated_at = now()
          WHERE bookmaker_id = $1 AND game_id = 1
        `, [bookmakerId]);
      } else {
        // Insertar nueva configuración
        await queryRunner.query(`
          INSERT INTO aviator_ws (bookmaker_id, game_id, url_websocket, api_message, ping_message, status_ws, is_editable, created_at, updated_at)
          VALUES ($1, 1, 'wss://eu-central-1-game9.spribegaming.com/BlueBox/websocket', 'gAAyEgADAAFjAgAAAWEDAAAAAXASAAIAA2FwaQgABTEuOC40AAJjbAgACkphdmFTY3JpcHQ=', 'gAA+EgADAAFjAgEAAWEDAA0AAXASAAMAAWMIABZjdXJyZW50QmV0c0luZm9IYW5kbGVyAAFyBP////8AAXASAAA=', 'DISCONNECTED', true, now(), now())
        `, [bookmakerId]);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revertir configuración del bookmaker
    await queryRunner.query(`
      UPDATE bookmakers 
      SET casino_domain = NULL,
          game_id_spribe = NULL,
          balance_url = NULL,
          supports_cookies = false
      WHERE bookmaker = '1xbet'
    `);

    // Eliminar configuración de aviator_ws
    const bookmakerResult = await queryRunner.query(`
      SELECT id FROM bookmakers WHERE bookmaker = '1xbet' LIMIT 1
    `);

    if (bookmakerResult && bookmakerResult.length > 0) {
      const bookmakerId = bookmakerResult[0].id;
      await queryRunner.query(`
        DELETE FROM aviator_ws WHERE bookmaker_id = $1 AND game_id = 1
      `, [bookmakerId]);
    }
  }
}
