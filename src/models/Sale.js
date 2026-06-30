const { query, transaction } = require('../config/database');

class Sale {
    static async getAll(page = 1, pageSize = 50) {
        const offset = (page - 1) * pageSize;

        const sql = `
            SELECT s.*, c.full_name as customer_name, c.phone as customer_phone,
                   sel.full_name as seller_name,
                   COALESCE(d.current_amount, s.total_amount - s.paid_amount) as remaining_amount,
                   CASE
                       WHEN COALESCE(d.current_amount, s.total_amount - s.paid_amount) <= 0 THEN 'paid'
                       WHEN s.paid_amount > 0 THEN 'partial'
                       ELSE 'unpaid'
                   END as status
            FROM sales s
            JOIN customers c ON s.customer_id = c.id
            JOIN sellers sel ON s.seller_id = sel.id
            LEFT JOIN debts d ON s.id = d.sale_id
            ORDER BY s.sale_date DESC
            LIMIT ${parseInt(pageSize)} OFFSET ${parseInt(offset)}
        `;

        return await query(sql);
    }

    static async getCount() {
        const sql = `SELECT COUNT(*) as total FROM sales`;
        const result = await query(sql);
        return result[0].total;
    }

    static async findById(id) {
        const sql = `
            SELECT s.*, c.full_name as customer_name, c.phone as customer_phone,
                   sel.full_name as seller_name,
                   COALESCE(d.current_amount, s.total_amount - s.paid_amount) as remaining_amount,
                   CASE
                       WHEN COALESCE(d.current_amount, s.total_amount - s.paid_amount) <= 0 THEN 'paid'
                       WHEN s.paid_amount > 0 THEN 'partial'
                       ELSE 'unpaid'
                   END as status,
                   d.id as debt_id, d.current_amount as debt_current_amount,
                   d.original_amount as debt_original_amount, d.markup_type, d.markup_value
            FROM sales s
            JOIN customers c ON s.customer_id = c.id
            JOIN sellers sel ON s.seller_id = sel.id
            LEFT JOIN debts d ON s.id = d.sale_id
            WHERE s.id = ?
            LIMIT 1
        `;
        const results = await query(sql, [id]);
        return results[0] || null;
    }

    static async getItems(saleId) {
        const sql = `
            SELECT si.*, p.name as product_name, p.barcode,
                   (si.quantity * (si.unit_price - si.purchase_price_at_sale)) as item_profit,
                   (SELECT COUNT(*) FROM sale_item_price_history sph WHERE sph.sale_item_id = si.id) as price_change_count
            FROM sale_items si
            JOIN products p ON si.product_id = p.id
            WHERE si.sale_id = ?
            ORDER BY p.name ASC
        `;
        return await query(sql, [saleId]);
    }

    static async calculateProfit(saleId) {
        const sql = `
            SELECT
                SUM(si.quantity * si.unit_price) as total_revenue,
                SUM(si.quantity * si.purchase_price_at_sale) as total_cost,
                SUM(si.quantity * (si.unit_price - si.purchase_price_at_sale)) as total_profit
            FROM sale_items si
            WHERE si.sale_id = ?
        `;
        const results = await query(sql, [saleId]);
        return results[0] || { total_revenue: 0, total_cost: 0, total_profit: 0 };
    }

    static async getPayments(saleId) {
        const sql = `
            SELECT * FROM payments
            WHERE sale_id = ?
            ORDER BY payment_date DESC
        `;
        return await query(sql, [saleId]);
    }

    static async create(customerId, sellerId, items, initialPayment = 0, paymentMethod = 'naqt', debtConfig = null, saleDate = null, user = null) {
        const AuditLog = require('./AuditLog');

        return await transaction(async (conn) => {
            // Validate seller has enough stock
            for (const item of items) {
                const [sellerInv] = await conn.execute(
                    'SELECT quantity, seller_price FROM seller_inventory WHERE seller_id = ? AND product_id = ?',
                    [sellerId, item.product_id]
                );

                if (!sellerInv[0] || sellerInv[0].quantity < item.quantity) {
                    throw new Error(`Insufficient stock for product ID ${item.product_id}`);
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
                // Get product's purchase price and last intake date for profit calculation
                const [productInfo] = await conn.execute(
                    `SELECT purchase_price, last_price_update_at
                     FROM products
                     WHERE id = ?`,
                    [item.product_id]
                );

                const purchasePriceAtSale = productInfo[0]?.purchase_price || 0;
                const intakeDate = productInfo[0]?.last_price_update_at || null;

                await conn.execute(
                    `INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, purchase_price_at_sale, intake_date)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [saleId, item.product_id, item.quantity, item.unit_price, purchasePriceAtSale, intakeDate]
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
                // Use sale_date for payment_date if provided, otherwise use current timestamp
                const paymentDate = saleDate || null;

                await conn.execute(
                    paymentDate
                        ? `INSERT INTO payments (sale_id, amount, payment_method, payment_date)
                           VALUES (?, ?, ?, ?)`
                        : `INSERT INTO payments (sale_id, amount, payment_method)
                           VALUES (?, ?, ?)`,
                    paymentDate
                        ? [saleId, initialPayment, paymentMethod, paymentDate]
                        : [saleId, initialPayment, paymentMethod]
                );
            }

            // Create debt record if there's remaining amount
            const remainingAmount = totalAmount - initialPayment;
            if (remainingAmount > 0) {
                // Calculate grace_end_date based on sale_date, not current date
                const baseDateForGrace = saleDate ? new Date(saleDate) : new Date();
                const gracePeriodMonths = debtConfig?.grace_period_months || 0;
                baseDateForGrace.setMonth(baseDateForGrace.getMonth() + gracePeriodMonths);

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
                        debtConfig?.markup_type || null,
                        debtConfig?.markup_value || null,
                        gracePeriodMonths,
                        baseDateForGrace.toISOString().split('T')[0]
                    ]
                );
            }

            // Log audit trail
            const saleData = {
                id: saleId,
                customer_id: customerId,
                seller_id: sellerId,
                total_amount: totalAmount,
                paid_amount: initialPayment,
                status: status,
                sale_date: saleDate,
                items: items,
                debt_config: debtConfig
            };
            await AuditLog.log('sales', saleId, 'insert', null, saleData, user);

            return saleId;
        });
    }

    static async addPayment(saleId, amount, paymentMethod = 'naqt', paymentDate = null, user = null) {
        const AuditLog = require('./AuditLog');

        return await transaction(async (conn) => {
            // Get current sale (old data for audit)
            const [sales] = await conn.execute(
                'SELECT * FROM sales WHERE id = ?',
                [saleId]
            );

            if (!sales[0]) {
                throw new Error('Sale not found');
            }

            const sale = sales[0];
            const oldData = { ...sale };

            // Parse numeric values to ensure proper calculations
            const saleTotal = parseFloat(sale.total_amount);
            const salePaid = parseFloat(sale.paid_amount);
            const paymentAmount = parseFloat(amount);

            // Check if there's an active debt
            const [debts] = await conn.execute(
                'SELECT id, current_amount FROM debts WHERE sale_id = ? -- AND status = "active"',
                [saleId]
            );

            // Calculate remaining amount considering debt with markup
            const remainingAmount = debts[0] ? parseFloat(debts[0].current_amount) : (saleTotal - salePaid);

            // Allow overpayments - validation removed

            const newPaidAmount = salePaid + paymentAmount;

            // Determine new status: only mark as 'paid' if no active debt or debt will be fully paid
            let newStatus;
            if (debts[0]) {
                const currentDebtAmount = parseFloat(debts[0].current_amount);
                const newDebtAmount = Math.max(0, currentDebtAmount - paymentAmount);
                newStatus = newDebtAmount === 0 ? 'paid' : 'partial';
            } else {
                newStatus = newPaidAmount >= saleTotal ? 'paid' : 'partial';
            }

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
            if (debts[0]) {
                const currentDebtAmount = parseFloat(debts[0].current_amount);
                const newDebtAmount = Math.max(0, currentDebtAmount - paymentAmount);
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

            // Get updated sale data for audit
            const [updatedSales] = await conn.execute(
                'SELECT * FROM sales WHERE id = ?',
                [saleId]
            );
            const newData = {
                ...updatedSales[0],
                payment_added: {
                    amount: amount,
                    payment_method: paymentMethod,
                    payment_date: paymentDate
                }
            };

            // Log audit trail
            await AuditLog.log('sales', saleId, 'update', oldData, newData, user);

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
            SELECT s.*, c.full_name as customer_name, sel.full_name as seller_name,
                   COALESCE(d.current_amount, s.total_amount - s.paid_amount) as remaining_amount,
                   CASE
                       WHEN COALESCE(d.current_amount, s.total_amount - s.paid_amount) <= 0 THEN 'paid'
                       WHEN s.paid_amount > 0 THEN 'partial'
                       ELSE 'unpaid'
                   END as status
            FROM sales s
            JOIN customers c ON s.customer_id = c.id
            JOIN sellers sel ON s.seller_id = sel.id
            LEFT JOIN debts d ON s.id = d.sale_id
            HAVING status = ?
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

    static async updateSaleDate(saleId, newDate, user = null) {
        const AuditLog = require('./AuditLog');

        // Get old sale data
        const sales = await query(`SELECT * FROM sales WHERE id = ${saleId}`, []);
        console.log('Old Sale Data:', sales[0]);
        if (!sales[0]) {
            throw new Error('Sale not found');
        }

        const oldData = { ...sales[0] };

        // Update sale date
        await query('UPDATE sales SET sale_date = ? WHERE id = ?', [newDate, saleId]);

        // Get updated sale data
        const updatedSales = await query('SELECT * FROM sales WHERE id = ?', [saleId]);
        const newData = { ...updatedSales[0] };

        // Log audit trail
        await AuditLog.log('sales', saleId, 'update', oldData, newData, user);

        return true;
    }

    static async updatePaymentDate(paymentId, newDate, user = null) {
        const AuditLog = require('./AuditLog');

        // Get payment data
        const payments = await query('SELECT * FROM payments WHERE id = ?', [paymentId]);

        if (!payments[0]) {
            throw new Error('Payment not found');
        }

        const payment = payments[0];
        const oldData = { ...payment };

        // Update payment date
        await query('UPDATE payments SET payment_date = ? WHERE id = ?', [newDate, paymentId]);

        // Get updated payment data
        const updatedPayments = await query('SELECT * FROM payments WHERE id = ?', [paymentId]);
        const newData = { ...updatedPayments[0] };

        // Log audit trail for the sale
        await AuditLog.log('payments', paymentId, 'update', oldData, newData, user);

        return true;
    }

    static async updatePaymentAmount(paymentId, newAmount, user = null) {
        const AuditLog = require('./AuditLog');

        return await transaction(async (conn) => {
            // Get payment data
            const [payments] = await conn.execute('SELECT * FROM payments WHERE id = ?', [paymentId]);

            if (!payments[0]) {
                throw new Error('Payment not found');
            }

            const payment = payments[0];
            const oldAmount = parseFloat(payment.amount);
            const targetAmount = parseFloat(newAmount);
            const diff = targetAmount - oldAmount;

            if (diff === 0) {
                return true; // No change needed
            }

            const saleId = payment.sale_id;

            // Get current sale data
            const [sales] = await conn.execute('SELECT * FROM sales WHERE id = ?', [saleId]);
            if (!sales[0]) {
                throw new Error('Sale not found');
            }
            const sale = sales[0];

            // Calculate new paid_amount for sale
            const newPaidAmount = parseFloat(sale.paid_amount) + diff;

            // Update payment amount
            await conn.execute('UPDATE payments SET amount = ? WHERE id = ?', [targetAmount, paymentId]);

            // Check if there is an associated debt
            const [debts] = await conn.execute('SELECT * FROM debts WHERE sale_id = ?', [saleId]);

            let newStatus;
            if (debts[0]) {
                const debt = debts[0];
                // Check if this payment is recorded in debt_payments
                const [debtPayments] = await conn.execute(
                    'SELECT * FROM debt_payments WHERE debt_id = ? AND payment_id = ?',
                    [debt.id, paymentId]
                );

                if (debtPayments[0]) {
                    // Update debt_payments amount
                    await conn.execute(
                        'UPDATE debt_payments SET amount = ? WHERE debt_id = ? AND payment_id = ?',
                        [targetAmount, debt.id, paymentId]
                    );

                    // Update debt current_amount
                    const newDebtAmount = Math.max(0, parseFloat(debt.current_amount) - diff);
                    const debtStatus = newDebtAmount === 0 ? 'paid' : 'active';

                    await conn.execute(
                        'UPDATE debts SET current_amount = ?, status = ? WHERE id = ?',
                        [newDebtAmount, debtStatus, debt.id]
                    );

                    newStatus = newDebtAmount === 0 ? 'paid' : 'partial';
                } else {
                    newStatus = newPaidAmount >= parseFloat(sale.total_amount) ? 'paid' : 'partial';
                }
            } else {
                newStatus = newPaidAmount >= parseFloat(sale.total_amount) ? 'paid' : 'partial';
            }

            // Update sale paid_amount and status
            await conn.execute(
                'UPDATE sales SET paid_amount = ?, status = ? WHERE id = ?',
                [newPaidAmount, newStatus, saleId]
            );

            // Get updated payment data for audit trail
            const [updatedPayments] = await conn.execute('SELECT * FROM payments WHERE id = ?', [paymentId]);
            const newPaymentData = { ...updatedPayments[0] };

            // Log audit trail for payments
            await AuditLog.log('payments', paymentId, 'update', payment, newPaymentData, user);

            return true;
        });
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

    static async changeSeller(saleId, newSellerId, user = null) {
        const AuditLog = require('./AuditLog');

        return await transaction(async (conn) => {
            // Get current sale
            const [sales] = await conn.execute(
                'SELECT * FROM sales WHERE id = ?',
                [saleId]
            );

            if (!sales[0]) {
                throw new Error('Sale not found');
            }

            const sale = sales[0];
            const oldSellerId = sale.seller_id;

            // Update sale with new seller
            await conn.execute(
                `UPDATE sales
                 SET seller_id = ?,
                     original_seller_id = COALESCE(original_seller_id, ?),
                     seller_changed_at = NOW()
                 WHERE id = ?`,
                [newSellerId, oldSellerId, saleId]
            );

            // Log audit trail
            const oldData = { seller_id: oldSellerId };
            const newData = { seller_id: newSellerId, changed_at: new Date() };
            await AuditLog.log('sales', saleId, 'update', oldData, newData, user);

            return true;
        });
    }

    static async returnItems(saleId, returns, user = null) {
        const AuditLog = require('./AuditLog');

        return await transaction(async (conn) => {
            // Get sale info
            const [sales] = await conn.execute(
                'SELECT * FROM sales WHERE id = ?',
                [saleId]
            );

            if (!sales[0]) {
                throw new Error('Sale not found');
            }

            const sale = sales[0];
            let totalRefund = 0;

            // Process each return
            for (const ret of returns) {
                const { sale_item_id, quantity, reason } = ret;

                // Get sale item info
                const [items] = await conn.execute(
                    'SELECT * FROM sale_items WHERE id = ? AND sale_id = ?',
                    [sale_item_id, saleId]
                );

                if (!items[0]) {
                    throw new Error(`Sale item ${sale_item_id} not found`);
                }

                const item = items[0];

                if (quantity > item.quantity) {
                    throw new Error(`Cannot return ${quantity} items, only ${item.quantity} were sold`);
                }

                const refundAmount = quantity * item.unit_price;
                totalRefund += refundAmount;

                // Insert return record
                await conn.execute(
                    `INSERT INTO sale_returns
                     (sale_id, sale_item_id, quantity, refund_amount, reason, returned_by)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [saleId, sale_item_id, quantity, refundAmount, reason || null, user?.login || null]
                );

                // Update or delete sale item
                if (quantity === item.quantity) {
                    // Full return - delete item
                    await conn.execute(
                        'DELETE FROM sale_items WHERE id = ?',
                        [sale_item_id]
                    );
                } else {
                    // Partial return - update quantity (subtotal will be auto-calculated)
                    const newQuantity = item.quantity - quantity;

                    await conn.execute(
                        'UPDATE sale_items SET quantity = ? WHERE id = ?',
                        [newQuantity, sale_item_id]
                    );
                }

                // Return inventory to seller
                await conn.execute(
                    `UPDATE seller_inventory
                     SET quantity = quantity + ?
                     WHERE seller_id = ? AND product_id = ?`,
                    [quantity, sale.seller_id, item.product_id]
                );
            }

            // Update sale totals (remaining_amount will be auto-calculated)
            const newTotalAmount = sale.total_amount - totalRefund;
            const newPaidAmount = Math.min(sale.paid_amount, newTotalAmount);

            let newStatus = 'unpaid';
            if (newPaidAmount >= newTotalAmount) {
                newStatus = 'paid';
            } else if (newPaidAmount > 0) {
                newStatus = 'partial';
            }

            await conn.execute(
                `UPDATE sales
                 SET total_amount = ?,
                     paid_amount = ?,
                     status = ?
                 WHERE id = ?`,
                [newTotalAmount, newPaidAmount, newStatus, saleId]
            );

            // Update debt if exists
            const [debts] = await conn.execute(
                'SELECT * FROM debts WHERE sale_id = ? AND status = "active"',
                [saleId]
            );

            if (debts[0]) {
                const debt = debts[0];
                const newDebtAmount = Math.max(0, debt.current_amount - totalRefund);
                const debtStatus = newDebtAmount === 0 ? 'paid' : 'active';

                await conn.execute(
                    'UPDATE debts SET current_amount = ?, original_amount = ?, status = ? WHERE id = ?',
                    [newDebtAmount, newDebtAmount, debtStatus, debt.id]
                );
            }

            // Log audit trail
            const oldData = {
                total_amount: sale.total_amount,
                items_returned: returns.length
            };
            const newData = {
                total_amount: newTotalAmount,
                refund_amount: totalRefund,
                returns: returns
            };
            await AuditLog.log('sales', saleId, 'return', oldData, newData, user);

            return {
                totalRefund,
                newTotalAmount,
                itemsReturned: returns.length
            };
        });
    }

    static async getReturns(saleId) {
        const sql = `
            SELECT sr.*, si.product_id, p.name as product_name, p.barcode
            FROM sale_returns sr
            LEFT JOIN sale_items si ON sr.sale_item_id = si.id
            LEFT JOIN products p ON si.product_id = p.id
            WHERE sr.sale_id = ?
            ORDER BY sr.returned_at DESC
        `;
        return await query(sql, [saleId]);
    }

    static async toggleProfitGiven(saleId, user = null) {
        const AuditLog = require('./AuditLog');

        // Get current sale
        const sale = await this.findById(saleId);
        if (!sale) {
            throw new Error('Sale not found');
        }

        const oldProfitGiven = sale.profit_given;
        const newProfitGiven = oldProfitGiven ? 0 : 1;
        const profitGivenAt = newProfitGiven ? new Date() : null;

        await query(
            'UPDATE sales SET profit_given = ?, profit_given_at = ? WHERE id = ?',
            [newProfitGiven, profitGivenAt, saleId]
        );

        // Log audit trail
        const oldData = { profit_given: oldProfitGiven };
        const newData = { profit_given: newProfitGiven, profit_given_at: profitGivenAt };
        await AuditLog.log('sales', saleId, 'update', oldData, newData, user);

        return { profit_given: newProfitGiven, profit_given_at: profitGivenAt };
    }
    static async updateItemPrice(saleItemId, newUnitPrice, reason = null, user = null) {
        const AuditLog = require('./AuditLog');

        return await transaction(async (conn) => {
            // Get current sale item
            const [items] = await conn.execute(
                'SELECT * FROM sale_items WHERE id = ?',
                [saleItemId]
            );

            if (!items[0]) {
                throw new Error('Sale item not found');
            }

            const item = items[0];
            const oldUnitPrice = parseFloat(item.unit_price);
            const saleId = item.sale_id;

            if (oldUnitPrice === parseFloat(newUnitPrice)) {
                throw new Error('Yangi narx eski narx bilan bir xil');
            }

            // If original_unit_price is null, set it to current unit_price (first time changing)
            if (item.original_unit_price === null) {
                await conn.execute(
                    'UPDATE sale_items SET original_unit_price = ? WHERE id = ?',
                    [oldUnitPrice, saleItemId]
                );
            }

            // Record price change history
            await conn.execute(
                `INSERT INTO sale_item_price_history 
                 (sale_item_id, sale_id, old_unit_price, new_unit_price, changed_by, reason)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [saleItemId, saleId, oldUnitPrice, newUnitPrice, user?.login || null, reason || null]
            );

            // Update the unit_price on the sale item
            await conn.execute(
                'UPDATE sale_items SET unit_price = ? WHERE id = ?',
                [newUnitPrice, saleItemId]
            );

            // Recalculate sale total_amount
            const [allItems] = await conn.execute(
                'SELECT SUM(quantity * unit_price) as new_total FROM sale_items WHERE sale_id = ?',
                [saleId]
            );
            const newTotalAmount = parseFloat(allItems[0].new_total || 0);

            // Get current sale data
            const [sales] = await conn.execute(
                'SELECT * FROM sales WHERE id = ?',
                [saleId]
            );
            const sale = sales[0];
            const priceDiff = (parseFloat(newUnitPrice) - oldUnitPrice) * item.quantity;

            // Update sale total
            const newPaidAmount = parseFloat(sale.paid_amount);
            let newStatus = 'unpaid';
            if (newPaidAmount >= newTotalAmount) {
                newStatus = 'paid';
            } else if (newPaidAmount > 0) {
                newStatus = 'partial';
            }

            await conn.execute(
                'UPDATE sales SET total_amount = ?, status = ? WHERE id = ?',
                [newTotalAmount, newStatus, saleId]
            );

            // Update debt if exists
            const [debts] = await conn.execute(
                'SELECT * FROM debts WHERE sale_id = ?',
                [saleId]
            );

            if (debts[0]) {
                const debt = debts[0];
                const newDebtCurrent = Math.max(0, parseFloat(debt.current_amount) + priceDiff);
                const newDebtOriginal = Math.max(0, parseFloat(debt.original_amount) + priceDiff);
                const debtStatus = newDebtCurrent <= 0 ? 'paid' : 'active';

                await conn.execute(
                    'UPDATE debts SET current_amount = ?, original_amount = ?, status = ? WHERE id = ?',
                    [newDebtCurrent, newDebtOriginal, debtStatus, debt.id]
                );
            }

            // Log audit trail
            const oldData = { sale_item_id: saleItemId, unit_price: oldUnitPrice };
            const newData = { sale_item_id: saleItemId, unit_price: newUnitPrice, reason };
            await AuditLog.log('sale_items', saleItemId, 'update', oldData, newData, user);

            return {
                oldUnitPrice,
                newUnitPrice: parseFloat(newUnitPrice),
                newTotalAmount,
                priceDiff
            };
        });
    }

    static async getItemPriceHistory(saleItemId) {
        const sql = `
            SELECT sph.*, si.product_id, p.name as product_name
            FROM sale_item_price_history sph
            JOIN sale_items si ON sph.sale_item_id = si.id
            JOIN products p ON si.product_id = p.id
            WHERE sph.sale_item_id = ?
            ORDER BY sph.changed_at DESC
        `;
        return await query(sql, [saleItemId]);
    }
}

module.exports = Sale;
