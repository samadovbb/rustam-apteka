const Customer = require('../models/Customer');

class CustomerController {
    static async index(req, res) {
        try {
            const customers = await Customer.getAll();
            res.render('customers/index', {
                title: 'Customers - MegaDent POS',
                customers
            });
        } catch (error) {
            console.error('Customers index error:', error);
            res.status(500).render('error', { title: 'Error', message: error.message, error });
        }
    }

    static async create(req, res) {
        res.render('customers/create', {
            title: 'Add New Customer',
            error: null
        });
    }

    static async store(req, res) {
        try {
            const { full_name, phone, address } = req.body;

            // Check if phone already exists
            const existing = await Customer.findByPhone(phone);
            if (existing) {
                return res.render('customers/create', {
                    title: 'Add New Customer',
                    error: 'Phone number already exists'
                });
            }

            await Customer.create({ full_name, phone, address }, req.user);
            res.redirect('/customers');
        } catch (error) {
            console.error('Customer create error:', error);
            res.render('customers/create', {
                title: 'Add New Customer',
                error: error.message
            });
        }
    }

    static async edit(req, res) {
        try {
            const customer = await Customer.findById(req.params.id);
            if (!customer) {
                return res.status(404).render('error', {
                    title: 'Not Found',
                    message: 'Customer not found',
                    error: {}
                });
            }

            res.render('customers/edit', {
                title: 'Edit Customer',
                customer,
                error: null
            });
        } catch (error) {
            console.error('Customer edit error:', error);
            res.status(500).render('error', { title: 'Error', message: error.message, error });
        }
    }

    static async update(req, res) {
        try {
            const { full_name, phone, address } = req.body;
            const id = req.params.id;

            // Check if phone exists for another customer
            const existing = await Customer.findByPhone(phone);
            if (existing && existing.id != id) {
                const customer = await Customer.findById(id);
                return res.render('customers/edit', {
                    title: 'Edit Customer',
                    customer,
                    error: 'Phone number already exists for another customer'
                });
            }

            await Customer.update(id, { full_name, phone, address }, req.user);
            res.redirect('/customers');
        } catch (error) {
            console.error('Customer update error:', error);
            const customer = await Customer.findById(req.params.id);
            res.render('customers/edit', {
                title: 'Edit Customer',
                customer,
                error: error.message
            });
        }
    }

    static async delete(req, res) {
        try {
            await Customer.delete(req.params.id, req.user);
            res.redirect('/customers');
        } catch (error) {
            console.error('Customer delete error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    // API: Search customers
    static async search(req, res) {
        try {
            const { q } = req.query;
            if (!q) {
                return res.json([]);
            }

            const customers = await Customer.search(q);
            res.json(customers);
        } catch (error) {
            console.error('Customer search error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    // API: Get customer by phone
    static async getByPhone(req, res) {
        try {
            const customer = await Customer.findByPhone(req.params.phone);
            if (!customer) {
                return res.status(404).json({ error: 'Customer not found' });
            }

            // Get customer debt info
            const totalDebt = await Customer.getTotalDebt(customer.id);
            res.json({ ...customer, total_debt: totalDebt });
        } catch (error) {
            console.error('Get customer by phone error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    // View customer details with debts and sales
    static async view(req, res) {
        try {
            const customer = await Customer.findById(req.params.id);
            if (!customer) {
                return res.status(404).render('error', {
                    title: 'Not Found',
                    message: 'Customer not found',
                    error: {}
                });
            }

            const debts = await Customer.getActiveDebts(req.params.id);
            const sales = await Customer.getPurchaseHistory(req.params.id);
            const totalDebt = await Customer.getTotalDebt(req.params.id);

            res.render('customers/view', {
                title: `${customer.full_name} - Details`,
                customer,
                debts,
                sales,
                totalDebt
            });
        } catch (error) {
            console.error('Customer view error:', error);
            res.status(500).render('error', { title: 'Error', message: error.message, error });
        }
    }
}

module.exports = CustomerController;
