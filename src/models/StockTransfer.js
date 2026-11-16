const { query, transaction } = require('../config/database');

class StockTransfer {
    // Build WHERE clause from list filters: { seller_id, date_from, date_to, product }
    static buildFilter(filters = {}) {
        const where = [];
        const params = [];
        const isDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || '');

        const sellerId = parseInt(filters.seller_id);
        if (sellerId) {
            where.push('st.seller_id = ?');
            params.push(sellerId);
        }
        if (isDate(filters.date_from)) {
            where.push('st.transfer_date >= ?');
            params.push(`${filters.date_from} 00:00:00`);
        }
        if (isDate(filters.date_to)) {
            where.push('st.transfer_date <= ?');
            params.push(`${filters.date_to} 23:59:59`);
        }
        if (filters.product && filters.product.trim()) {
            where.push(`EXISTS (
                SELECT 1 FROM stock_transfer_items fi
                JOIN products fp ON fi.product_id = fp.id
                WHERE fi.stock_transfer_id = st.id AND (fp.name LIKE ? OR fp.barcode LIKE ?)
            )`);
            const term = `%${filters.product.trim()}%`;
            params.push(term, term);
        }

        return {
            whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '',
            params
        };
    }

    static async getAll(page = 1, pageSize = 50, filters = {}) {
        const offset = (page - 1) * pageSize;
        const { whereSql, params } = this.buildFilter(filters);

        const sql = `
            SELECT st.*, s.full_name as seller_name,
                   COALESCE(agg.items_count, 0) as items_count,
                   COALESCE(agg.total_quantity, 0) as total_quantity,
                   COALESCE(agg.total_amount, 0) as total_amount
            FROM stock_transfers st
            JOIN sellers s ON st.seller_id = s.id
            LEFT JOIN (
                SELECT stock_transfer_id,
                       COUNT(*) as items_count,
                       SUM(quantity) as total_quantity,
                       SUM(quantity * seller_price) as total_amount
                FROM stock_transfer_items
                GROUP BY stock_transfer_id
            ) agg ON agg.stock_transfer_id = st.id
            ${whereSql}
            ORDER BY st.transfer_date DESC, st.id DESC
            LIMIT ${parseInt(pageSize)} OFFSET ${parseInt(offset)}
        `;

        return await query(sql, params);
    }

    static async getCount(filters = {}) {
        const { whereSql, params } = this.buildFilter(filters);
        const sql = `SELECT COUNT(*) as total FROM stock_transfers st ${whereSql}`;
        const result = await query(sql, params);
        return result[0].total;
    }

    // Totals for the whole filtered set (not just the current page)
    static async getSummary(filters = {}) {
        const { whereSql, params } = this.buildFilter(filters);
        const sql = `
            SELECT COUNT(DISTINCT st.id) as transfers_count,
                   COALESCE(SUM(sti.quantity), 0) as total_quantity,
                   COALESCE(SUM(sti.quantity * sti.seller_price), 0) as total_amount
            FROM stock_transfers st
            LEFT JOIN stock_transfer_items sti ON sti.stock_transfer_id = st.id
            ${whereSql}
        `;
        const result = await query(sql, params);
        return result[0];
    }

    // One row per transferred product, for the Excel export
    static async getExportRows(filters = {}) {
        const { whereSql, params } = this.buildFilter(filters);
        const sql = `
            SELECT st.id, st.transfer_date, st.notes, s.full_name as seller_name,
                   p.name as product_name, p.barcode,
                   sti.quantity, sti.seller_price,
                   (sti.quantity * sti.seller_price) as subtotal
            FROM stock_transfers st
            JOIN sellers s ON st.seller_id = s.id
            JOIN stock_transfer_items sti ON sti.stock_transfer_id = st.id
            JOIN products p ON sti.product_id = p.id
            ${whereSql}
            ORDER BY st.transfer_date DESC, st.id DESC, p.name ASC
        `;
        return await query(sql, params);
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

    static async create(sellerId, items, notes = null, transferDate = null, user = null) {
        const AuditLog = require('./AuditLog');

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

            // Insert stock transfer record with optional transfer_date
            const [transferResult] = await conn.execute(
                transferDate
                    ? 'INSERT INTO stock_transfers (seller_id, notes, transfer_date) VALUES (?, ?, ?)'
                    : 'INSERT INTO stock_transfers (seller_id, notes) VALUES (?, ?)',
                transferDate
                    ? [sellerId, notes, transferDate]
                    : [sellerId, notes]
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

            // Log audit trail
            const transferData = {
                id: transferId,
                seller_id: sellerId,
                notes: notes,
                transfer_date: transferDate,
                items: items
            };
            await AuditLog.log('stock_transfers', transferId, 'insert', null, transferData, user);

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

    static async getLatestDate() {
        const sql = `
            SELECT DATE(transfer_date) as latest_date
            FROM stock_transfers
            ORDER BY transfer_date DESC
            LIMIT 1
        `;
        const results = await query(sql);
        return results[0]?.latest_date || null;
    }

    static async delete(id, user = null) {
        const AuditLog = require('./AuditLog');

        return await transaction(async (conn) => {
            // Get transfer data for audit log
            const [transfers] = await conn.execute(
                'SELECT * FROM stock_transfers WHERE id = ?',
                [id]
            );

            if (!transfers[0]) {
                throw new Error('Stock transfer not found');
            }

            const transfer = transfers[0];

            // Get items to reverse inventory changes
            const [items] = await conn.execute(
                'SELECT * FROM stock_transfer_items WHERE stock_transfer_id = ?',
                [id]
            );

            // Reverse inventory changes
            for (const item of items) {
                // Add back to warehouse
                await conn.execute(
                    `UPDATE warehouse_inventory
                     SET quantity = quantity + ?
                     WHERE product_id = ?`,
                    [item.quantity, item.product_id]
                );

                // Deduct from seller inventory
                await conn.execute(
                    `UPDATE seller_inventory
                     SET quantity = GREATEST(0, quantity - ?)
                     WHERE seller_id = ? AND product_id = ?`,
                    [item.quantity, transfer.seller_id, item.product_id]
                );
            }

            // Delete transfer (items will be deleted by CASCADE)
            await conn.execute('DELETE FROM stock_transfers WHERE id = ?', [id]);

            // Log audit trail
            await AuditLog.log('stock_transfers', id, 'delete', { ...transfer, items }, null, user);

            return true;
        });
    }
}

module.exports = StockTransfer;
