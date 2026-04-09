import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Agrega el valor 'auto_bet' al enum de credit_transaction_source
 * Nota: TypeORM maneja los enums de forma automática, esta migración es de respaldo
 */
export class AddAutoBetToCreditSource1744800000000 implements MigrationInterface {
  name = 'AddAutoBetToCreditSource1744800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Buscar el tipo enum real usado en la columna source
    const columnInfo = await queryRunner.query(`
      SELECT 
        t.typname as enum_name,
        e.enumlabel as enum_value
      FROM pg_type t 
      JOIN pg_enum e ON t.oid = e.enumtypid  
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
      AND t.typname LIKE '%credit%source%'
      ORDER BY e.enumsortorder
    `);
    
    if (columnInfo && columnInfo.length > 0) {
      const enumName = columnInfo[0].enum_name;
      const existingValues = columnInfo.map((v: any) => v.enum_value);
      
      if (!existingValues.includes('auto_bet')) {
        try {
          await queryRunner.query(`
            ALTER TYPE public.${enumName} ADD VALUE 'auto_bet'
          `);
          console.log(`✅ Valor auto_bet agregado al enum ${enumName}`);
        } catch (error) {
          console.log(`⚠️ No se pudo agregar auto_bet al enum: ${error.message}`);
        }
      } else {
        console.log('⏭️ Valor auto_bet ya existe en el enum');
      }
    } else {
      console.log('⏭️ No se encontró enum de credit_transaction_source, TypeORM lo creará automáticamente');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('⚠️ No se puede revertir la adición de valor al enum en PostgreSQL');
  }
}
