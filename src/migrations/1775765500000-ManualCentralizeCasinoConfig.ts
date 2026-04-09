import { MigrationInterface, QueryRunner } from "typeorm";

export class ManualCentralizeCasinoConfig1775765500000 implements MigrationInterface {
    name = 'ManualCentralizeCasinoConfig1775765500000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Update bookmakers table
        await queryRunner.query(`ALTER TABLE "bookmakers" ADD COLUMN IF NOT EXISTS "bookmaker_url" varchar(500)`);
        
        // 2. Update user_bookmaker_auths table
        await queryRunner.query(`ALTER TABLE "user_bookmaker_auths" ADD COLUMN IF NOT EXISTS "current_balance" numeric(18,2) NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE "user_bookmaker_auths" ADD COLUMN IF NOT EXISTS "currency" varchar(10) NOT NULL DEFAULT 'USD'`);

        // Drop legacy columns from user_bookmaker_auths
        const columnsToDrop = [
            'auth_message', 
            'websocket_url', 
            'api_token', 
            'session_token', 
            'cookies', 
            'ping_message', 
            'game_zone', 
            'is_verified', 
            'verified_at', 
            'tokens_updated_at', 
            'bookmaker_username', 
            'bookmaker_player_id', 
            'casino_domain', 
            'balance_url'
        ];

        for (const col of columnsToDrop) {
            await queryRunner.query(`ALTER TABLE "user_bookmaker_auths" DROP COLUMN IF EXISTS "${col}"`);
        }

        // 3. Clean up any other potential issues
        // Note: The auto-generated migration tried to drop many constraints and recreate them.
        // We'll skip that for now and see if the app works with these structural changes.
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Reverse operations if needed
        await queryRunner.query(`ALTER TABLE "bookmakers" DROP COLUMN IF EXISTS "bookmaker_url"`);
        await queryRunner.query(`ALTER TABLE "user_bookmaker_auths" DROP COLUMN IF EXISTS "current_balance"`);
        await queryRunner.query(`ALTER TABLE "user_bookmaker_auths" DROP COLUMN IF EXISTS "currency"`);
    }
}
