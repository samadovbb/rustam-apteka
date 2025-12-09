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

    static async create(data, user = null) {
        const AuditLog = require('./AuditLog');

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

        const supplierId = result.insertId;

        // Log audit trail
        await AuditLog.log('suppliers', supplierId, 'insert', null, data, user);

        return supplierId;
    }

    static async update(id, data, user = null) {
        const AuditLog = require('./AuditLog');

        // Get old data
        const oldSupplier = await this.findById(id);

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

        // Get new data
        const newSupplier = await this.findById(id);

        // Log audit trail
        await AuditLog.log('suppliers', id, 'update', oldSupplier, newSupplier, user);
    }

    static async delete(id, user = null) {
        const AuditLog = require('./AuditLog');

        // Get supplier data before deletion
        const supplier = await this.findById(id);

        const sql = 'DELETE FROM suppliers WHERE id = ?';
        await query(sql, [id]);

        // Log audit trail
        await AuditLog.log('suppliers', id, 'delete', supplier, null, user);
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

    static async search(searchTerm) {
        const sql = `
            SELECT * FROM suppliers
            WHERE name LIKE ? OR phone LIKE ? OR email LIKE ?
            ORDER BY name ASC
            LIMIT 50
        `;
        const term = `%${searchTerm}%`;
        return await query(sql, [term, term, term]);
    }
}

module.exports = Supplier;
