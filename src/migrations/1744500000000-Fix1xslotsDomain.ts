import { MigrationInterface, QueryRunner } from 'typeorm';

export class Fix1xslotsDomain1744500000000 implements MigrationInterface {
  name = 'Fix1xslotsDomain1744500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Corregir dominio de 1xslots
    await queryRunner.query(`
      UPDATE bookmakers 
      SET casino_domain = '1xslots.com',
          balance_url = 'https://1xslots.com/account-api/user/balance'
      WHERE bookmaker = '1xslots'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE bookmakers 
      SET casino_domain = '1xslot.com',
          balance_url = 'https://1xslot.com/api/internal/user/balance'
      WHERE bookmaker = '1xslots'
    `);
  }
}
