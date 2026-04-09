import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateLicensesTable1700000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Verificar si la tabla ya existe
    const tableExists = await queryRunner.hasTable('licenses');
    if (tableExists) {
      console.log('Table licenses already exists, skipping...');
      return;
    }

    // Verificar si los enums ya existen
    const typeEnumExists = await queryRunner.query(`
      SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'licenses_type_enum')
    `);
    
    const statusEnumExists = await queryRunner.query(`
      SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'licenses_status_enum')
    `);

    // Solo crear enums si no existen
    if (!typeEnumExists[0]?.exists) {
      await queryRunner.query(`
        CREATE TYPE licenses_type_enum AS ENUM ('credits', 'subscription', 'bonus')
      `);
    }

    if (!statusEnumExists[0]?.exists) {
      await queryRunner.query(`
        CREATE TYPE licenses_status_enum AS ENUM ('active', 'used', 'expired', 'cancelled')
      `);
    }

    // Crear tabla con o sin defaults según existan los enums
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "licenses" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "licenseKey" varchar(255) NOT NULL,
        "type" varchar(50) NOT NULL DEFAULT 'credits',
        "status" varchar(50) NOT NULL DEFAULT 'active',
        "creditsAmount" int NOT NULL,
        "redeemedBy" uuid,
        "redeemedAt" timestamp,
        "expiresAt" timestamp,
        "description" varchar(500),
        "createdBy" uuid,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_a61fb8cd7c2c7a71f9499bd5aa2" UNIQUE ("licenseKey"),
        CONSTRAINT "FK_87d0d2bcc63f1c5c77ccb6baf5f" FOREIGN KEY ("redeemedBy") REFERENCES "users" ("id") ON DELETE SET NULL,
        CONSTRAINT "FK_b3d63148dbcd076669833df44e6" FOREIGN KEY ("createdBy") REFERENCES "users" ("id") ON DELETE SET NULL,
        CONSTRAINT "PK_da5021501ce80efa03de6f40086" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_LICENSE_KEY" ON "licenses" ("licenseKey")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('licenses');
  }
}
