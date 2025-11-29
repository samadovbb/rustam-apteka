const { query } = require('../config/database');

class Supplier {
    static async getAll() {
        const sql = 'SELECT * FROM suppliers ORDER BY name ASC';
        return await query(sql);
    }

    static async findById(id) {
        const sql = 'SELECT * FROM suppliers WHERE id = ? LIMIT 1';
        const results = await query(sql, [id]);
        return results[0] || null;
    }

    static async create(data) {
        const sql = `
            INSERT INTO suppliers (name, phone, email, address)
            VALUES (?, ?, ?, ?)
        `;
        const result = await query(sql, [
            data.name,
            data.phone || null,
            data.email || null,
            data.address || null
        ]);
        return result.insertId;
    }

    static async update(id, data) {
        const sql = `
            UPDATE suppliers
            SET name = ?, phone = ?, email = ?, address = ?
            WHERE id = ?
        `;
        await query(sql, [
            data.name,
            data.phone || null,
            data.email || null,
            data.address || null,
            id
        ]);
    }

    static async delete(id) {
        const sql = 'DELETE FROM suppliers WHERE id = ?';
        await query(sql, [id]);
    }

    static async getStockIntakeHistory(supplierId) {
        const sql = `
            SELECT si.*, COUNT(sii.id) as items_count
            FROM stock_intakes si
            LEFT JOIN stock_intake_items sii ON si.id = sii.stock_intake_id
            WHERE si.supplier_id = ?
            GROUP BY si.id
            ORDER BY si.intake_date DESC
        `;
        return await query(sql, [supplierId]);
    }
}

module.exports = Supplier;
