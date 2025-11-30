const { query, transaction } = require('../config/database');

class Sale {
    static async getAll(limit = 100) {
        const sql = `
            SELECT s.*, c.full_name as customer_name, c.phone as customer_phone,
                   sel.full_name as seller_name,
                   (s.total_amount - s.paid_amount) as remaining_amount
            FROM sales s
            JOIN customers c ON s.customer_id = c.id
            JOIN sellers sel ON s.seller_id = sel.id
            ORDER BY s.sale_date DESC
            LIMIT ${parseInt(limit)}
        `;
        return await query(sql);
    }

    static async findById(id) {
        const sql = `
            SELECT s.*, c.full_name as customer_name, c.phone as customer_phone,
                   sel.full_name as seller_name,
                   (s.total_amount - s.paid_amount) as remaining_amount
            FROM sales s
            JOIN customers c ON s.customer_id = c.id
            JOIN sellers sel ON s.seller_id = sel.id
            WHERE s.id = ?
            LIMIT 1
        `;
        const results = await query(sql, [id]);
        return results[0] || null;
    }

    static async getItems(saleId) {
        const sql = `
            SELECT si.*, p.name as product_name, p.barcode
            FROM sale_items si
            JOIN products p ON si.product_id = p.id
            WHERE si.sale_id = ?
            ORDER BY p.name ASC
        `;
        return await query(sql, [saleId]);
    }

    static async getPayments(saleId) {
        const sql = `
            SELECT * FROM payments
            WHERE sale_id = ?
            ORDER BY payment_date DESC
        `;
        return await query(sql, [saleId]);
    }

    static async create(customerId, sellerId, items, initialPayment = 0, paymentMethod = 'cash', debtConfig = null, saleDate = null) {
        return await transaction(async (conn) => {
            // Validate seller has enough stock and prices
            for (const item of items) {
                const [sellerInv] = await conn.execute(
                    'SELECT quantity, seller_price FROM seller_inventory WHERE seller_id = ? AND product_id = ?',
                    [sellerId, item.product_id]
                );

                if (!sellerInv[0] || sellerInv[0].quantity < item.quantity) {
                    throw new Error(`Insufficient stock for product ID ${item.product_id}`);
                }

                // Validate selling price is not below seller's price
                if (item.unit_price < sellerInv[0].seller_price) {
                    throw new Error(`Unit price cannot be below seller's price for product ID ${item.product_id}`);
                }
            }

            // Calculate total amount
            const totalAmount = items.reduce((sum, item) =>
                sum + (item.quantity * item.unit_price), 0
            );

            // Determine sale status
            let status = 'unpaid';
            if (initialPayment >= totalAmount) {
                status = 'paid';
                initialPayment = totalAmount; // Cap payment at total
            } else if (initialPayment > 0) {
                status = 'partial';
            }

            // Insert sale record with optional sale_date
            const [saleResult] = await conn.execute(
                saleDate
                    ? `INSERT INTO sales (customer_id, seller_id, total_amount, paid_amount, status, sale_date)
                       VALUES (?, ?, ?, ?, ?, ?)`
                    : `INSERT INTO sales (customer_id, seller_id, total_amount, paid_amount, status)
                       VALUES (?, ?, ?, ?, ?)`,
                saleDate
                    ? [customerId, sellerId, totalAmount, initialPayment, status, saleDate]
                    : [customerId, sellerId, totalAmount, initialPayment, status]
            );

            const saleId = saleResult.insertId;

            // Insert sale items and update seller inventory
            for (const item of items) {
                await conn.execute(
                    `INSERT INTO sale_items (sale_id, product_id, quantity, unit_price)
                     VALUES (?, ?, ?, ?)`,
                    [saleId, item.product_id, item.quantity, item.unit_price]
                );

                // Deduct from seller inventory
                await conn.execute(
                    `UPDATE seller_inventory
                     SET quantity = quantity - ?
                     WHERE seller_id = ? AND product_id = ?`,
                    [item.quantity, sellerId, item.product_id]
                );
            }

            // Record initial payment if > 0
            if (initialPayment > 0) {
                await conn.execute(
                    `INSERT INTO payments (sale_id, amount, payment_method)
                     VALUES (?, ?, ?)`,
                    [saleId, initialPayment, paymentMethod]
                );
            }

            // Create debt record if there's remaining amount
            const remainingAmount = totalAmount - initialPayment;
            if (remainingAmount > 0 && debtConfig) {
                const graceEndDate = new Date();
                graceEndDate.setMonth(graceEndDate.getMonth() + (debtConfig.grace_period_months || 0));

                await conn.execute(
                    `INSERT INTO debts
                     (sale_id, customer_id, original_amount, current_amount, markup_type,
                      markup_value, grace_period_months, grace_end_date)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        saleId,
                        customerId,
                        remainingAmount,
                        remainingAmount,
                        debtConfig.markup_type,
                        debtConfig.markup_value,
                        debtConfig.grace_period_months || 0,
                        graceEndDate.toISOString().split('T')[0]
                    ]
                );
            }

            return saleId;
        });
    }

    static async addPayment(saleId, amount, paymentMethod = 'cash', paymentDate = null) {
        return await transaction(async (conn) => {
            // Get current sale
            const [sales] = await conn.execute(
                'SELECT total_amount, paid_amount, customer_id FROM sales WHERE id = ?',
                [saleId]
            );

            if (!sales[0]) {
                throw new Error('Sale not found');
            }

            const sale = sales[0];
            const remainingAmount = sale.total_amount - sale.paid_amount;

            if (amount > remainingAmount) {
                throw new Error('Payment amount exceeds remaining balance');
            }

            const newPaidAmount = sale.paid_amount + amount;
            const newStatus = newPaidAmount >= sale.total_amount ? 'paid' : 'partial';

            // Update sale
            await conn.execute(
                'UPDATE sales SET paid_amount = ?, status = ? WHERE id = ?',
                [newPaidAmount, newStatus, saleId]
            );

            // Insert payment record with optional payment_date
            const [paymentResult] = await conn.execute(
                paymentDate
                    ? 'INSERT INTO payments (sale_id, amount, payment_method, payment_date) VALUES (?, ?, ?, ?)'
                    : 'INSERT INTO payments (sale_id, amount, payment_method) VALUES (?, ?, ?)',
                paymentDate
                    ? [saleId, amount, paymentMethod, paymentDate]
                    : [saleId, amount, paymentMethod]
            );

            // Update debt if exists
            const [debts] = await conn.execute(
                'SELECT id, current_amount FROM debts WHERE sale_id = ? AND status = "active"',
                [saleId]
            );

            if (debts[0]) {
                const newDebtAmount = Math.max(0, debts[0].current_amount - amount);
                const debtStatus = newDebtAmount === 0 ? 'paid' : 'active';

                await conn.execute(
                    'UPDATE debts SET current_amount = ?, status = ? WHERE id = ?',
                    [newDebtAmount, debtStatus, debts[0].id]
                );

                // Record debt payment
                await conn.execute(
                    'INSERT INTO debt_payments (debt_id, payment_id, amount) VALUES (?, ?, ?)',
                    [debts[0].id, paymentResult.insertId, amount]
                );
            }

            return paymentResult.insertId;
        });
    }

    static async getRecentSales(days = 30, limit = 50) {
        const sql = `
            SELECT s.*, c.full_name as customer_name, sel.full_name as seller_name
            FROM sales s
            JOIN customers c ON s.customer_id = c.id
            JOIN sellers sel ON s.seller_id = sel.id
            WHERE s.sale_date >= DATE_SUB(NOW(), INTERVAL ${parseInt(days)} DAY)
            ORDER BY s.sale_date DESC
            LIMIT ${parseInt(limit)}
        `;
        return await query(sql, []);
    }

    static async getSalesByStatus(status, limit = 100) {
        const sql = `
            SELECT s.*, c.full_name as customer_name, sel.full_name as seller_name
            FROM sales s
            JOIN customers c ON s.customer_id = c.id
            JOIN sellers sel ON s.seller_id = sel.id
            WHERE s.status = ?
            ORDER BY s.sale_date DESC
            LIMIT ${parseInt(limit)}
        `;
        return await query(sql, [status]);
    }

    static async getLatestDate() {
        const sql = `
            SELECT DATE(sale_date) as latest_date
            FROM sales
            ORDER BY sale_date DESC
            LIMIT 1
        `;
        const results = await query(sql);
        return results[0]?.latest_date || null;
    }

    static async delete(saleId, user = null) {
        const AuditLog = require('./AuditLog');

        return await transaction(async (conn) => {
            // Get sale data for audit log
            const [sales] = await conn.execute(
                'SELECT * FROM sales WHERE id = ?',
                [saleId]
            );

            if (!sales[0]) {
                throw new Error('Sale not found');
            }

            const sale = sales[0];

            // Get sale items to restore inventory
            const [items] = await conn.execute(
                'SELECT * FROM sale_items WHERE sale_id = ?',
                [saleId]
            );

            // Restore seller inventory for each item
            for (const item of items) {
                await conn.execute(
                    `INSERT INTO seller_inventory (seller_id, product_id, quantity, seller_price)
                     VALUES (?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
                    [sale.seller_id, item.product_id, item.quantity, item.unit_price]
                );
            }

            // Delete payments (will cascade delete debt_payments)
            await conn.execute('DELETE FROM payments WHERE sale_id = ?', [saleId]);

            // Delete debts
            await conn.execute('DELETE FROM debts WHERE sale_id = ?', [saleId]);

            // Delete sale items (will be cascaded)
            await conn.execute('DELETE FROM sale_items WHERE sale_id = ?', [saleId]);

            // Delete sale
            await conn.execute('DELETE FROM sales WHERE id = ?', [saleId]);

            // Log audit trail
            await AuditLog.log('sales', saleId, 'delete', sale, null, user);

            return true;
        });
    }
}

module.exports = Sale;
