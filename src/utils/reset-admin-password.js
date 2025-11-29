const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function resetAdminPassword() {
    let connection;

    try {
        // Connect to database
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'megadent_pos',
            port: process.env.DB_PORT || 3306
        });

        console.log('🔗 Connected to database');

        const login = process.env.ADMIN_LOGIN || 'admin';
        const password = process.env.ADMIN_PASSWORD || 'admin123';

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        console.log('🔐 Hashing password...');

        // Check if admin exists
        const [existing] = await connection.execute(
            'SELECT id FROM admins WHERE login = ?',
            [login]
        );

        if (existing.length > 0) {
            // Update existing admin
            await connection.execute(
                'UPDATE admins SET password = ? WHERE login = ?',
                [hashedPassword, login]
            );
            console.log(`✅ Admin password updated for: ${login}`);
        } else {
            // Create new admin
            await connection.execute(
                'INSERT INTO admins (login, password, full_name) VALUES (?, ?, ?)',
                [login, hashedPassword, 'System Administrator']
            );
            console.log(`✅ Admin user created: ${login}`);
        }

        console.log('');
        console.log('='.repeat(50));
        console.log('✅ Admin password reset successful!');
        console.log('='.repeat(50));
        console.log(`Login: ${login}`);
        console.log(`Password: ${password}`);
        console.log('='.repeat(50));

    } catch (error) {
        console.error('❌ Error resetting admin password:', error.message);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// Run the password reset
resetAdminPassword();
