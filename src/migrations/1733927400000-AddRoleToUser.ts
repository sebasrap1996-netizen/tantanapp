import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddRoleToUser1733927400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Verificar si la columna ya existe
    const table = await queryRunner.getTable('users');
    const hasRoleColumn = table?.findColumnByName('role');
    
    if (!hasRoleColumn) {
      await queryRunner.addColumn(
        'users',
        new TableColumn({
          name: 'role',
          type: 'enum',
          enum: ['user', 'admin', 'superadmin'],
          default: "'user'",
          isNullable: false,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('users');
    const hasRoleColumn = table?.findColumnByName('role');
    
    if (hasRoleColumn) {
      await queryRunner.dropColumn('users', 'role');
    }
  }
}
