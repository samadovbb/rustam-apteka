const Sale = require('../models/Sale');
const Customer = require('../models/Customer');
const Seller = require('../models/Seller');

class SalesController {
    static async index(req, res) {
        try {
            const sales = await Sale.getAll();
            res.render('sales/index', {
                title: 'Sales - MegaDent POS',
                sales
            });
        } catch (error) {
            console.error('Sales index error:', error);
            res.status(500).render('error', { title: 'Error', message: error.message, error });
        }
    }

    static async create(req, res) {
        try {
            const sellers = await Seller.getAll();

            res.render('sales/create', {
                title: 'New Sale',
                sellers,
                error: null
            });
        } catch (error) {
            console.error('Sale create error:', error);
            res.status(500).render('error', { title: 'Error', message: error.message, error });
        }
    }

    static async store(req, res) {
        try {
            const {
                customer_phone,
                customer_name,
                customer_address,
                seller_id,
                items,
                initial_payment,
                payment_method,
                debt_markup_type,
                debt_markup_value,
                debt_grace_months,
                sale_date
            } = req.body;

            // Find or create customer
            let customer = await Customer.findByPhone(customer_phone);
            if (!customer) {
                const customerId = await Customer.create({
                    full_name: customer_name,
                    phone: customer_phone,
                    address: customer_address
                }, req.user);
                customer = await Customer.findById(customerId);
            }

            // Parse items
            const parsedItems = typeof items === 'string' ? JSON.parse(items) : items;

            if (!parsedItems || parsedItems.length === 0) {
                throw new Error('At least one product is required');
            }

            // Prepare debt configuration if applicable
            let debtConfig = null;
            if (debt_markup_type && debt_markup_value) {
                debtConfig = {
                    markup_type: debt_markup_type,
                    markup_value: parseFloat(debt_markup_value),
                    grace_period_months: parseInt(debt_grace_months) || 0
                };
            }

            const saleId = await Sale.create(
                customer.id,
                seller_id,
                parsedItems,
                parseFloat(initial_payment) || 0,
                payment_method || 'cash',
                debtConfig,
                sale_date || null,
                req.user
            );

            res.redirect(`/sales/${saleId}`);
        } catch (error) {
            console.error('Sale store error:', error);
            const sellers = await Seller.getAll();

            res.render('sales/create', {
                title: 'New Sale',
                sellers,
                error: error.message
            });
        }
    }

    static async view(req, res) {
        try {
            const sale = await Sale.findById(req.params.id);
            const items = await Sale.getItems(req.params.id);
            const payments = await Sale.getPayments(req.params.id);
            const profit = await Sale.calculateProfit(req.params.id);

            if (!sale) {
                return res.status(404).render('error', {
                    title: 'Not Found',
                    message: 'Sale not found',
                    error: {}
                });
            }

            res.render('sales/view', {
                title: `Sale #${sale.id}`,
                sale,
                items,
                payments,
                profit
            });
        } catch (error) {
            console.error('Sale view error:', error);
            res.status(500).render('error', { title: 'Error', message: error.message, error });
        }
    }

    static async addPayment(req, res) {
        try {
            const { amount, payment_method, payment_date } = req.body;
            await Sale.addPayment(
                req.params.id,
                parseFloat(amount),
                payment_method || 'cash',
                payment_date || null,
                req.user
            );

            res.redirect(`/sales/${req.params.id}`);
        } catch (error) {
            console.error('Add payment error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    // API: Get seller inventory
    static async getSellerInventory(req, res) {
        try {
            const inventory = await Seller.getInventory(req.params.seller_id);
            res.json(inventory);
        } catch (error) {
            console.error('Get seller inventory error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    // API: Get latest sale date
    // static async getLatestDate(req, res) {
    //     try {
    //         const result = await Sale.getLatestDate();
    //         const date = result ? new Date(result).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    //         res.json({ date });
    //     } catch (error) {
    //         console.error('Get latest sale date error:', error);
    //         res.json({ date: new Date().toISOString().split('T')[0] });
    //     }
    // }
    // API: Get latest sale date
    static async getLatestDate(req, res) {
        try {
            const result = await Sale.getLatestDate();
            let date;
            if (result) {
                const dateObj = new Date(result);
                const year = dateObj.getFullYear();
                const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                const day = String(dateObj.getDate()).padStart(2, '0');
                date = `${year}-${month}-${day}`;
            } else {
                const today = new Date();
                const year = today.getFullYear();
                const month = String(today.getMonth() + 1).padStart(2, '0');
                const day = String(today.getDate()).padStart(2, '0');
                date = `${year}-${month}-${day}`;
            }
            res.json({ date });
        } catch (error) {
            console.error('Get latest sale date error:', error);
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            res.json({ date: `${year}-${month}-${day}` });
        }
    }
    // Update sale date
    static async updateSaleDate(req, res) {
        try {
            const { sale_date } = req.body;
            if (!sale_date) {
                return res.status(400).json({ success: false, error: 'Sana kiritilishi kerak' });
            }

            await Sale.updateSaleDate(req.params.id, sale_date, req.user);
            res.json({ success: true, message: 'Savdo sanasi muvaffaqiyatli yangilandi' });
        } catch (error) {
            console.error('Update sale date error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // Update payment date
    static async updatePaymentDate(req, res) {
        try {
            const { payment_date } = req.body;
            if (!payment_date) {
                return res.status(400).json({ success: false, error: 'Sana kiritilishi kerak' });
            }

            await Sale.updatePaymentDate(req.params.payment_id, payment_date, req.user);
            res.json({ success: true, message: 'To\'lov sanasi muvaffaqiyatli yangilandi' });
        } catch (error) {
            console.error('Update payment date error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // Delete a sale
    static async delete(req, res) {
        try {
            await Sale.delete(req.params.id, req.user);
            res.json({ success: true, message: 'Savdo muvaffaqiyatli o\'chirildi' });
        } catch (error) {
            console.error('Delete sale error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
}

module.exports = SalesController;
