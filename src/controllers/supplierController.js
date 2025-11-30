const Supplier = require('../models/Supplier');

class SupplierController {
    static async index(req, res) {
        try {
            const suppliers = await Supplier.getAll();
            res.render('suppliers/index', {
                title: 'Suppliers - MegaDent POS',
                suppliers
            });
        } catch (error) {
            console.error('Suppliers index error:', error);
            res.status(500).render('error', { title: 'Error', message: error.message, error });
        }
    }

    static async create(req, res) {
        res.render('suppliers/create', {
            title: 'Add New Supplier',
            error: null
        });
    }

    static async store(req, res) {
        try {
            const { name, phone, email, address } = req.body;
            await Supplier.create({ name, phone, email, address });
            res.redirect('/suppliers');
        } catch (error) {
            console.error('Supplier create error:', error);
            res.render('suppliers/create', {
                title: 'Add New Supplier',
                error: error.message
            });
        }
    }

    static async edit(req, res) {
        try {
            const supplier = await Supplier.findById(req.params.id);
            if (!supplier) {
                return res.status(404).render('error', {
                    title: 'Not Found',
                    message: 'Supplier not found',
                    error: {}
                });
            }

            res.render('suppliers/edit', {
                title: 'Edit Supplier',
                supplier,
                error: null
            });
        } catch (error) {
            console.error('Supplier edit error:', error);
            res.status(500).render('error', { title: 'Error', message: error.message, error });
        }
    }

    static async update(req, res) {
        try {
            const { name, phone, email, address } = req.body;
            await Supplier.update(req.params.id, { name, phone, email, address });
            res.redirect('/suppliers');
        } catch (error) {
            console.error('Supplier update error:', error);
            const supplier = await Supplier.findById(req.params.id);
            res.render('suppliers/edit', {
                title: 'Edit Supplier',
                supplier,
                error: error.message
            });
        }
    }

    static async delete(req, res) {
        try {
            await Supplier.delete(req.params.id);
            res.redirect('/suppliers');
        } catch (error) {
            console.error('Supplier delete error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    static async view(req, res) {
        try {
            const supplier = await Supplier.findById(req.params.id);
            if (!supplier) {
                return res.status(404).render('error', {
                    title: 'Not Found',
                    message: 'Supplier not found',
                    error: {}
                });
            }

            const intakes = await Supplier.getStockIntakeHistory(req.params.id);
            const stats = await Supplier.getStats(req.params.id);
            const topProducts = await Supplier.getTopProducts(req.params.id);

            res.render('suppliers/view', {
                title: `${supplier.name} - Details`,
                supplier,
                intakes,
                stats,
                topProducts
            });
        } catch (error) {
            console.error('Supplier view error:', error);
            res.status(500).render('error', { title: 'Error', message: error.message, error });
        }
    }
}

module.exports = SupplierController;
