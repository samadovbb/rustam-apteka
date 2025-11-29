const { query } = require('../config/database');

class Customer {
    static async getAll() {
        const sql = 'SELECT * FROM customers ORDER BY full_name ASC';
        return await query(sql);
    }

    static async findById(id) {
        const sql = 'SELECT * FROM customers WHERE id = ? LIMIT 1';
        const results = await query(sql, [id]);
        return results[0] || null;
    }

    static async findByPhone(phone) {
        const sql = 'SELECT * FROM customers WHERE phone = ? LIMIT 1';
        const results = await query(sql, [phone]);
        return results[0] || null;
    }

    static async search(searchTerm) {
        const sql = `
            SELECT * FROM customers
            WHERE full_name LIKE ? OR phone LIKE ?
            ORDER BY full_name ASC
            LIMIT 50
        `;
        const term = `%${searchTerm}%`;
        return await query(sql, [term, term]);
    }

    static async create(data) {
        const sql = `
            INSERT INTO customers (full_name, phone, address)
            VALUES (?, ?, ?)
        `;
        const result = await query(sql, [
            data.full_name,
            data.phone,
            data.address || null
        ]);
        return result.insertId;
    }

    static async update(id, data) {
        const sql = `
            UPDATE customers
            SET full_name = ?, phone = ?, address = ?
            WHERE id = ?
        `;
        await query(sql, [
            data.full_name,
            data.phone,
            data.address || null,
            id
        ]);
    }

    static async delete(id) {
        const sql = 'DELETE FROM customers WHERE id = ?';
        await query(sql, [id]);
    }

    static async getPurchaseHistory(customerId, limit = 50) {
        const sql = `
            SELECT s.*, sel.full_name as seller_name
            FROM sales s
            JOIN sellers sel ON s.seller_id = sel.id
            WHERE s.customer_id = ?
            ORDER BY s.sale_date DESC
            LIMIT ${parseInt(limit)}
        `;
        return await query(sql, [customerId]);
    }

    static async getActiveDebts(customerId) {
        const sql = `
            SELECT d.*, s.id as sale_id, s.sale_date, s.total_amount
            FROM debts d
            JOIN sales s ON d.sale_id = s.id
            WHERE d.customer_id = ? AND d.status = 'active'
            ORDER BY d.created_at DESC
        `;
        return await query(sql, [customerId]);
    }

    static async getTotalDebt(customerId) {
        const sql = `
            SELECT SUM(current_amount) as total_debt
            FROM debts
            WHERE customer_id = ? AND status = 'active'
        `;
        const results = await query(sql, [customerId]);
        return results[0]?.total_debt || 0;
    }
}

module.exports = Customer;
