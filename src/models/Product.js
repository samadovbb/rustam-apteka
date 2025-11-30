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

    static async getIntakeHistory(productId, limit = 50) {
        const sql = `
            SELECT sii.*, si.intake_date, si.id as intake_id,
                   s.name as supplier_name
            FROM stock_intake_items sii
            JOIN stock_intakes si ON sii.stock_intake_id = si.id
            JOIN suppliers s ON si.supplier_id = s.id
            WHERE sii.product_id = ?
            ORDER BY si.intake_date DESC
            LIMIT ${parseInt(limit)}
        `;
        return await query(sql, [productId]);
    }

    static async getSalesHistory(productId, limit = 50) {
        const sql = `
            SELECT si.*, s.id as sale_id, s.sale_date,
                   c.full_name as customer_name,
                   sel.full_name as seller_name
            FROM sale_items si
            JOIN sales s ON si.sale_id = s.id
            JOIN customers c ON s.customer_id = c.id
            JOIN sellers sel ON s.seller_id = sel.id
            WHERE si.product_id = ?
            ORDER BY s.sale_date DESC
            LIMIT ${parseInt(limit)}
        `;
        return await query(sql, [productId]);
    }

    static async getTransferHistory(productId, limit = 50) {
        const sql = `
            SELECT sti.*, st.transfer_date, st.id as transfer_id,
                   sel.full_name as seller_name
            FROM stock_transfer_items sti
            JOIN stock_transfers st ON sti.stock_transfer_id = st.id
            JOIN sellers sel ON st.seller_id = sel.id
            WHERE sti.product_id = ?
            ORDER BY st.transfer_date DESC
            LIMIT ${parseInt(limit)}
        `;
        return await query(sql, [productId]);
    }

    static async getStats(productId) {
        const intakeSql = `
            SELECT COALESCE(SUM(quantity), 0) as total_intake
            FROM stock_intake_items
            WHERE product_id = ?
        `;
        const salesSql = `
            SELECT COALESCE(SUM(quantity), 0) as total_sold
            FROM sale_items
            WHERE product_id = ?
        `;
        const transferSql = `
            SELECT COALESCE(SUM(quantity), 0) as total_transferred
            FROM stock_transfer_items
            WHERE product_id = ?
        `;

        const intakeResults = await query(intakeSql, [productId]);
        const salesResults = await query(salesSql, [productId]);
        const transferResults = await query(transferSql, [productId]);

        return {
            total_intake: intakeResults[0]?.total_intake || 0,
            total_sold: salesResults[0]?.total_sold || 0,
            total_transferred: transferResults[0]?.total_transferred || 0
        };
    }
}

module.exports = Product;
