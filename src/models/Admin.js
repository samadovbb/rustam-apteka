const { query } = require('../config/database');
const bcrypt = require('bcryptjs');

class Admin {
    static async findByLogin(login) {
        const sql = 'SELECT * FROM admins WHERE login = ? LIMIT 1';
        const results = await query(sql, [login]);
        return results[0] || null;
    }

    static async findById(id) {
        const sql = 'SELECT * FROM admins WHERE id = ? LIMIT 1';
        const results = await query(sql, [id]);
        return results[0] || null;
    }

    static async create(data) {
        const hashedPassword = await bcrypt.hash(data.password, 10);
        const sql = `
            INSERT INTO admins (login, password, full_name)
            VALUES (?, ?, ?)
        `;
        const result = await query(sql, [data.login, hashedPassword, data.full_name || null]);
        return result.insertId;
    }

    static async verifyPassword(plainPassword, hashedPassword) {
        return await bcrypt.compare(plainPassword, hashedPassword);
    }

    static async updatePassword(id, newPassword) {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        const sql = 'UPDATE admins SET password = ? WHERE id = ?';
        await query(sql, [hashedPassword, id]);
    }

    static async getAll() {
        const sql = 'SELECT id, login, full_name, created_at, updated_at FROM admins';
        return await query(sql);
    }
}

module.exports = Admin;
