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

    static async create(data) {
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
        return result.insertId;
    }

    static async update(id, data) {
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
    }

    static async updatePrices(id, purchasePrice, sellPrice) {
        const sql = `
            UPDATE products
            SET purchase_price = ?, sell_price = ?, last_price_update_at = NOW()
            WHERE id = ?
        `;
        await query(sql, [purchasePrice, sellPrice, id]);
    }

    static async delete(id) {
        const sql = 'DELETE FROM products WHERE id = ?';
        await query(sql, [id]);
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
