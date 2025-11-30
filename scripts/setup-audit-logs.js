const { query } = require('../src/config/database');
const fs = require('fs');
const path = require('path');

async function setupAuditLogs() {
    try {
        console.log('🔍 Checking if audit_logs table exists...');

        // Check if table exists
        const tables = await query("SHOW TABLES LIKE 'audit_logs'");

        if (tables.length === 0) {
            console.log('⚠️  audit_logs table does not exist. Creating it now...');

            // Read and execute migration SQL
            const migrationPath = path.join(__dirname, '../database/add_audit_logs.sql');
            const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

            // Split by semicolons and execute each statement
            const statements = migrationSQL
                .split(';')
                .map(s => s.trim())
                .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('SELECT'));

            for (const statement of statements) {
                if (statement.toLowerCase().includes('create table')) {
                    await query(statement);
                }
            }

            console.log('✅ audit_logs table created successfully!');
        } else {
            console.log('✅ audit_logs table already exists.');
        }

        // Verify table structure
        console.log('\n📋 Table structure:');
        const columns = await query("DESCRIBE audit_logs");
        console.table(columns);

        // Check if there are any existing logs
        const logCount = await query("SELECT COUNT(*) as count FROM audit_logs");
        console.log(`\n📊 Total audit logs in database: ${logCount[0].count}`);

        // Show recent logs if any
        if (logCount[0].count > 0) {
            const recentLogs = await query(`
                SELECT id, table_name, record_id, action, user_login, created_at
                FROM audit_logs
                ORDER BY created_at DESC
                LIMIT 5
            `);
            console.log('\n📝 Recent audit logs:');
            console.table(recentLogs);
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error);
        process.exit(1);
    }
}

setupAuditLogs();
