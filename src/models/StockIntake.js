const { query, transaction } = require('../config/database');

class StockIntake {
    static async getAll(limit = 100) {
        const sql = `
            SELECT si.*, s.name as supplier_name
            FROM stock_intakes si
            JOIN suppliers s ON si.supplier_id = s.id
            ORDER BY si.intake_date DESC
            LIMIT ${parseInt(limit)}
        `;
        return await query(sql);
    }

    static async findById(id) {
        const sql = `
            SELECT si.*, s.name as supplier_name
            FROM stock_intakes si
            JOIN suppliers s ON si.supplier_id = s.id
            WHERE si.id = ?
            LIMIT 1
        `;
        const results = await query(sql, [id]);
        return results[0] || null;
    }

    static async getItems(intakeId) {
        const sql = `
            SELECT sii.*, p.name as product_name, p.barcode
            FROM stock_intake_items sii
            JOIN products p ON sii.product_id = p.id
            WHERE sii.stock_intake_id = ?
            ORDER BY p.name ASC
        `;
        return await query(sql, [intakeId]);
    }

    static async create(supplierId, items, notes = null, intakeDate = null) {
        return await transaction(async (conn) => {
            // Calculate total amount
            const totalAmount = items.reduce((sum, item) =>
                sum + (item.quantity * item.purchase_price), 0
            );

            // Insert stock intake record with optional intake_date
            const [intakeResult] = await conn.execute(
                intakeDate
                    ? 'INSERT INTO stock_intakes (supplier_id, total_amount, notes, intake_date) VALUES (?, ?, ?, ?)'
                    : 'INSERT INTO stock_intakes (supplier_id, total_amount, notes) VALUES (?, ?, ?)',
                intakeDate
                    ? [supplierId, totalAmount, notes, intakeDate]
                    : [supplierId, totalAmount, notes]
            );

            const intakeId = intakeResult.insertId;

            // Insert items and update warehouse inventory
            for (const item of items) {
                // Insert intake item
                await conn.execute(
                    `INSERT INTO stock_intake_items
                     (stock_intake_id, product_id, quantity, purchase_price)
                     VALUES (?, ?, ?, ?)`,
                    [intakeId, item.product_id, item.quantity, item.purchase_price]
                );

                // Update product prices
                await conn.execute(
                    `UPDATE products
                     SET purchase_price = ?, last_price_update_at = NOW()
                     WHERE id = ?`,
                    [item.purchase_price, item.product_id]
                );

                // Update warehouse inventory
                await conn.execute(
                    `INSERT INTO warehouse_inventory (product_id, quantity)
                     VALUES (?, ?)
                     ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
                    [item.product_id, item.quantity]
                );
            }

            return intakeId;
        });
    }

    static async delete(id) {
        return await transaction(async (conn) => {
            // Get items before deletion
            const [items] = await conn.execute(
                'SELECT product_id, quantity FROM stock_intake_items WHERE stock_intake_id = ?',
                [id]
            );

            // Deduct quantities from warehouse
            for (const item of items) {
                await conn.execute(
                    `UPDATE warehouse_inventory
                     SET quantity = GREATEST(0, quantity - ?)
                     WHERE product_id = ?`,
                    [item.quantity, item.product_id]
                );
            }

            // Delete intake (items will be deleted by CASCADE)
            await conn.execute('DELETE FROM stock_intakes WHERE id = ?', [id]);
        });
    }

    static async getRecentIntakes(days = 30, limit = 50) {
        const sql = `
            SELECT si.*, s.name as supplier_name,
                   COUNT(sii.id) as items_count
            FROM stock_intakes si
            JOIN suppliers s ON si.supplier_id = s.id
            LEFT JOIN stock_intake_items sii ON si.id = sii.stock_intake_id
            WHERE si.intake_date >= DATE_SUB(NOW(), INTERVAL ${parseInt(days)} DAY)
            GROUP BY si.id
            ORDER BY si.intake_date DESC
            LIMIT ${parseInt(limit)}
        `;
        return await query(sql);
    }

    static async getLatestDate() {
        const sql = `
            SELECT DATE(intake_date) as latest_date
            FROM stock_intakes
            ORDER BY intake_date DESC
            LIMIT 1
        `;
        const results = await query(sql);
        return results[0]?.latest_date || null;
    }
}

module.exports = StockIntake;
