import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateUserCredits1743446400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Crear tabla credit_transactions
    await queryRunner.createTable(
      new Table({
        name: 'credit_transactions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()'
          },
          {
            name: 'user_id',
            type: 'uuid'
          },
          {
            name: 'transaction_type',
            type: 'enum',
            enum: ['earned', 'spent', 'bonus', 'refund', 'admin_adjustment']
          },
          {
            name: 'source',
            type: 'enum',
            enum: ['signal_win', 'signal_access', 'admin_grant', 'purchase', 'referral']
          },
          {
            name: 'amount',
            type: 'int'
          },
          {
            name: 'balance_before',
            type: 'int'
          },
          {
            name: 'balance_after',
            type: 'int'
          },
          {
            name: 'reference_id',
            type: 'varchar',
            length: '255',
            isNullable: true
          },
          {
            name: 'description',
            type: 'varchar',
            length: '500',
            isNullable: true
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()'
          }
        ]
      }),
      true
    );

    // Crear índice para user_id en credit_transactions
    await queryRunner.createIndex(
      'credit_transactions',
      new TableIndex({
        name: 'IDX_credit_transactions_user_id',
        columnNames: ['user_id']
      })
    );

    // Foreign key para credit_transactions -> users
    await queryRunner.createForeignKey(
      'credit_transactions',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE'
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('credit_transactions');
  }
}
