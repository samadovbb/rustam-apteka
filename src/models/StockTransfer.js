const { query, transaction } = require('../config/database');

class StockTransfer {
    static async getAll(limit = 100) {
        const sql = `
            SELECT st.*, s.full_name as seller_name
            FROM stock_transfers st
            JOIN sellers s ON st.seller_id = s.id
            ORDER BY st.transfer_date DESC
            LIMIT ${parseInt(limit)}
        `;
        return await query(sql);
    }

    static async findById(id) {
        const sql = `
            SELECT st.*, s.full_name as seller_name
            FROM stock_transfers st
            JOIN sellers s ON st.seller_id = s.id
            WHERE st.id = ?
            LIMIT 1
        `;
        const results = await query(sql, [id]);
        return results[0] || null;
    }

    static async getItems(transferId) {
        const sql = `
            SELECT sti.*, p.name as product_name, p.barcode
            FROM stock_transfer_items sti
            JOIN products p ON sti.product_id = p.id
            WHERE sti.stock_transfer_id = ?
            ORDER BY p.name ASC
        `;
        return await query(sql, [transferId]);
    }

    static async create(sellerId, items, notes = null) {
        return await transaction(async (conn) => {
            // Validate warehouse has enough stock
            for (const item of items) {
                const [warehouse] = await conn.execute(
                    'SELECT quantity FROM warehouse_inventory WHERE product_id = ?',
                    [item.product_id]
                );

                const availableQty = warehouse[0]?.quantity || 0;
                if (availableQty < item.quantity) {
                    throw new Error(`Insufficient warehouse stock for product ID ${item.product_id}`);
                }
            }

            // Insert stock transfer record
            const [transferResult] = await conn.execute(
                'INSERT INTO stock_transfers (seller_id, notes) VALUES (?, ?)',
                [sellerId, notes]
            );

            const transferId = transferResult.insertId;

            // Insert items and update inventories
            for (const item of items) {
                // Insert transfer item
                await conn.execute(
                    `INSERT INTO stock_transfer_items
                     (stock_transfer_id, product_id, quantity, seller_price)
                     VALUES (?, ?, ?, ?)`,
                    [transferId, item.product_id, item.quantity, item.seller_price]
                );

                // Deduct from warehouse
                await conn.execute(
                    `UPDATE warehouse_inventory
                     SET quantity = quantity - ?
                     WHERE product_id = ?`,
                    [item.quantity, item.product_id]
                );

                // Add to seller inventory
                await conn.execute(
                    `INSERT INTO seller_inventory (seller_id, product_id, quantity, seller_price)
                     VALUES (?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE
                        quantity = quantity + VALUES(quantity),
                        seller_price = VALUES(seller_price)`,
                    [sellerId, item.product_id, item.quantity, item.seller_price]
                );
            }

            return transferId;
        });
    }

    static async getBySellergetAll(sellerId, limit = 50) {
        const sql = `
            SELECT st.*
            FROM stock_transfers st
            WHERE st.seller_id = ?
            ORDER BY st.transfer_date DESC
            LIMIT ${parseInt(limit)}
        `;
        return await query(sql, [sellerId]);
    }

    static async getRecentTransfers(days = 30, limit = 50) {
        const sql = `
            SELECT st.*, s.full_name as seller_name,
                   COUNT(sti.id) as items_count
            FROM stock_transfers st
            JOIN sellers s ON st.seller_id = s.id
            LEFT JOIN stock_transfer_items sti ON st.id = sti.stock_transfer_id
            WHERE st.transfer_date >= DATE_SUB(NOW(), INTERVAL ${parseInt(days)} DAY)
            GROUP BY st.id
            ORDER BY st.transfer_date DESC
            LIMIT ${parseInt(limit)}
        `;
        return await query(sql);
    }
}

module.exports = StockTransfer;
