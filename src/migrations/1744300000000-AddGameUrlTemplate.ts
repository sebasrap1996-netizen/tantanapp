import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddGameUrlTemplate1744300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Agregar campo game_url_template
    await queryRunner.addColumn(
      'bookmakers',
      new TableColumn({
        name: 'game_url_template',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
    );

    // Actualizar URLs de juego para cada bookmaker
    await queryRunner.query(`
      UPDATE bookmakers 
      SET game_url_template = 'https://888starz.bet/es/slots/game/{gameId}/aviator'
      WHERE id = 1
    `);

    await queryRunner.query(`
      UPDATE bookmakers 
      SET game_url_template = 'https://1xbet.com/es/slots/game/{gameId}/aviator'
      WHERE id = 3
    `);

    await queryRunner.query(`
      UPDATE bookmakers 
      SET game_url_template = 'https://1win.com/casino/play/v_spribe:aviator'
      WHERE id = 4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('bookmakers', 'game_url_template');
  }
}
