const { query } = require('../config/database');

class Product {
    static async getAll() {
        const sql = 'SELECT * FROM products ORDER BY name ASC';
        return await query(sql);
    }

    static async findById(id) {
        const sql = 'SELECT * FROM products WHERE id = ? LIMIT 1';
        const results = await query(sql, [id]);
        return results[0] || null;
    }

    static async findByBarcode(barcode) {
        const sql = 'SELECT * FROM products WHERE barcode = ? LIMIT 1';
        const results = await query(sql, [barcode]);
        return results[0] || null;
    }

    static async search(searchTerm) {
        const sql = `
            SELECT * FROM products
            WHERE name LIKE ? OR barcode LIKE ?
            ORDER BY name ASC
            LIMIT 50
        `;
        const term = `%${searchTerm}%`;
        return await query(sql, [term, term]);
    }

    static async create(data, user = null) {
        const AuditLog = require('./AuditLog');

        const sql = `
            INSERT INTO products
            (name, barcode, warranty_months, purchase_price, sell_price, last_price_update_at)
            VALUES (?, ?, ?, ?, ?, NOW())
        `;
        const result = await query(sql, [
            data.name,
            data.barcode,
            data.warranty_months || 0,
            data.purchase_price || 0,
            data.sell_price || 0
        ]);

        const productId = result.insertId;

        // Log audit trail
        await AuditLog.log('products', productId, 'insert', null, data, user);

        return productId;
    }

    static async update(id, data, user = null) {
        const AuditLog = require('./AuditLog');

        // Get old data
        const oldProduct = await this.findById(id);

        const sql = `
            UPDATE products
            SET name = ?, barcode = ?, warranty_months = ?,
                purchase_price = ?, sell_price = ?,
                last_price_update_at = NOW()
            WHERE id = ?
        `;
        await query(sql, [
            data.name,
            data.barcode,
            data.warranty_months,
            data.purchase_price,
            data.sell_price,
            id
        ]);

        // Get new data
        const newProduct = await this.findById(id);

        // Log audit trail
        await AuditLog.log('products', id, 'update', oldProduct, newProduct, user);
    }

    static async updatePrices(id, purchasePrice, sellPrice, user = null) {
        const AuditLog = require('./AuditLog');

        // Get old data
        const oldProduct = await this.findById(id);

        const sql = `
            UPDATE products
            SET purchase_price = ?, sell_price = ?, last_price_update_at = NOW()
            WHERE id = ?
        `;
        await query(sql, [purchasePrice, sellPrice, id]);

        // Get new data
        const newProduct = await this.findById(id);

        // Log audit trail
        await AuditLog.log('products', id, 'update', oldProduct, newProduct, user);
    }

    static async delete(id, user = null) {
        const AuditLog = require('./AuditLog');

        // Get product data before deletion
        const product = await this.findById(id);

        const sql = 'DELETE FROM products WHERE id = ?';
        await query(sql, [id]);

        // Log audit trail
        await AuditLog.log('products', id, 'delete', product, null, user);
    }

    static async getWarehouseStock(productId) {
        const sql = `
            SELECT wi.*, p.name as product_name, p.barcode
            FROM warehouse_inventory wi
            JOIN products p ON wi.product_id = p.id
            WHERE wi.product_id = ?
        `;
        const results = await query(sql, [productId]);
        return results[0] || null;
    }

    static async getAllWarehouseStock() {
        const sql = `
            SELECT wi.*, p.name as product_name, p.barcode, p.purchase_price, p.sell_price
            FROM warehouse_inventory wi
            JOIN products p ON wi.product_id = p.id
            WHERE wi.quantity > 0
            ORDER BY p.name ASC
        `;
        return await query(sql);
    }
}

module.exports = Product;
