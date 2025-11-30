const { query } = require('../config/database');

class Seller {
    static async getAll() {
        const sql = 'SELECT * FROM sellers ORDER BY full_name ASC';
        return await query(sql);
    }

    static async findById(id) {
        const sql = 'SELECT * FROM sellers WHERE id = ? LIMIT 1';
        const results = await query(sql, [id]);
        return results[0] || null;
    }

    static async create(data, user = null) {
        const AuditLog = require('./AuditLog');

        const sql = `
            INSERT INTO sellers (full_name, phone, commission_percent)
            VALUES (?, ?, ?)
        `;
        const result = await query(sql, [
            data.full_name,
            data.phone || null,
            data.commission_percent || 0
        ]);

        const sellerId = result.insertId;

        // Log audit trail
        await AuditLog.log('sellers', sellerId, 'insert', null, data, user);

        return sellerId;
    }

    static async update(id, data, user = null) {
        const AuditLog = require('./AuditLog');

        // Get old data
        const oldSeller = await this.findById(id);

        const sql = `
            UPDATE sellers
            SET full_name = ?, phone = ?, commission_percent = ?
            WHERE id = ?
        `;
        await query(sql, [
            data.full_name,
            data.phone || null,
            data.commission_percent || 0,
            id
        ]);

        // Get new data
        const newSeller = await this.findById(id);

        // Log audit trail
        await AuditLog.log('sellers', id, 'update', oldSeller, newSeller, user);
    }

    static async delete(id, user = null) {
        const AuditLog = require('./AuditLog');

        // Get seller data before deletion
        const seller = await this.findById(id);

        const sql = 'DELETE FROM sellers WHERE id = ?';
        await query(sql, [id]);

        // Log audit trail
        await AuditLog.log('sellers', id, 'delete', seller, null, user);
    }

    static async getInventory(sellerId) {
        const sql = `
            SELECT si.*, p.name as product_name, p.barcode, p.warranty_months
            FROM seller_inventory si
            JOIN products p ON si.product_id = p.id
            WHERE si.seller_id = ? AND si.quantity > 0
            ORDER BY p.name ASC
        `;
        return await query(sql, [sellerId]);
    }

    static async getProductInventory(sellerId, productId) {
        const sql = `
            SELECT * FROM seller_inventory
            WHERE seller_id = ? AND product_id = ?
            LIMIT 1
        `;
        const results = await query(sql, [sellerId, productId]);
        return results[0] || null;
    }

    static async getSalesHistory(sellerId, limit = 50) {
        const sql = `
            SELECT s.*, c.full_name as customer_name, c.phone as customer_phone
            FROM sales s
            JOIN customers c ON s.customer_id = c.id
            WHERE s.seller_id = ?
            ORDER BY s.sale_date DESC
            LIMIT ${parseInt(limit)}
        `;
        return await query(sql, [sellerId]);
    }

    static async search(searchTerm) {
        const sql = `
            SELECT * FROM sellers
            WHERE full_name LIKE ? OR phone LIKE ?
            ORDER BY full_name ASC
            LIMIT 50
        `;
        const term = `%${searchTerm}%`;
        return await query(sql, [term, term]);
    }
    
    static async getDebtors(sellerId) {
        const sql = `
            SELECT DISTINCT c.id, c.full_name, c.phone,
                   SUM(d.current_amount) as total_debt
            FROM debts d
            JOIN sales s ON d.sale_id = s.id
            JOIN customers c ON d.customer_id = c.id
            WHERE s.seller_id = ? AND d.status = 'active'
            GROUP BY c.id, c.full_name, c.phone
            ORDER BY total_debt DESC
        `;
        return await query(sql, [sellerId]);
    }

    static async getTransfers(sellerId, limit = 50) {
        const sql = `
            SELECT st.*
            FROM stock_transfers st
            WHERE st.seller_id = ?
            ORDER BY st.transfer_date DESC
            LIMIT ${parseInt(limit)}
        `;
        return await query(sql, [sellerId]);
    }

    static async getSalesStats(sellerId) {
        const sql = `
            SELECT
                COUNT(*) as total_sales,
                SUM(total_amount) as total_revenue,
                SUM(paid_amount) as total_collected,
                SUM(total_amount - paid_amount) as total_pending
            FROM sales
            WHERE seller_id = ?
        `;
        const results = await query(sql, [sellerId]);
        return results[0] || {};
    }
}

module.exports = Seller;
