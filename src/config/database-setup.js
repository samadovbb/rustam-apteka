const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function setupDatabase() {
    let connection;

    try {
        // Connect without database selection
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            port: process.env.DB_PORT || 3306,
            multipleStatements: true
        });

        console.log('🔗 Connected to MySQL server');

        // Read and execute schema file
        const schemaPath = path.join(__dirname, '../../database/schema.sql');
        let schema = await fs.readFile(schemaPath, 'utf8');

        // Hash the default admin password
        const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', 10);

        // Replace the placeholder password with actual hashed password
        schema = schema.replace(
            '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
            hashedPassword
        );

        console.log('📖 Executing database schema...');
        await connection.query(schema);

        console.log('✅ Database setup completed successfully!');
        console.log('📊 Database:', process.env.DB_NAME || 'megadent_pos');
        console.log('👤 Admin login:', process.env.ADMIN_LOGIN || 'admin');
        console.log('🔑 Admin password:', process.env.ADMIN_PASSWORD || 'admin123');

    } catch (error) {
        console.error('❌ Database setup failed:', error.message);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// Run setup
setupDatabase();
