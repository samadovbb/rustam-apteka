const Seller = require('../models/Seller');

class SellerController {
    static async index(req, res) {
        try {
            const sellers = await Seller.getAll();
            res.render('sellers/index', {
                title: 'Sellers - MegaDent POS',
                sellers
            });
        } catch (error) {
            console.error('Sellers index error:', error);
            res.status(500).render('error', { title: 'Error', message: error.message, error });
        }
    }

    static async create(req, res) {
        res.render('sellers/create', {
            title: 'Add New Seller',
            error: null
        });
    }

    static async store(req, res) {
        try {
            const { full_name, phone, commission_percent } = req.body;
            await Seller.create({ full_name, phone, commission_percent });
            res.redirect('/sellers');
        } catch (error) {
            console.error('Seller create error:', error);
            res.render('sellers/create', {
                title: 'Add New Seller',
                error: error.message
            });
        }
    }

    static async edit(req, res) {
        try {
            const seller = await Seller.findById(req.params.id);
            if (!seller) {
                return res.status(404).render('error', {
                    title: 'Not Found',
                    message: 'Seller not found',
                    error: {}
                });
            }

            res.render('sellers/edit', {
                title: 'Edit Seller',
                seller,
                error: null
            });
        } catch (error) {
            console.error('Seller edit error:', error);
            res.status(500).render('error', { title: 'Error', message: error.message, error });
        }
    }

    static async update(req, res) {
        try {
            const { full_name, phone, commission_percent } = req.body;
            await Seller.update(req.params.id, { full_name, phone, commission_percent });
            res.redirect('/sellers');
        } catch (error) {
            console.error('Seller update error:', error);
            const seller = await Seller.findById(req.params.id);
            res.render('sellers/edit', {
                title: 'Edit Seller',
                seller,
                error: error.message
            });
        }
    }

    static async delete(req, res) {
        try {
            await Seller.delete(req.params.id);
            res.redirect('/sellers');
        } catch (error) {
            console.error('Seller delete error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    static async inventory(req, res) {
        try {
            const seller = await Seller.findById(req.params.id);
            const inventory = await Seller.getInventory(req.params.id);

            res.render('sellers/inventory', {
                title: `${seller.full_name} - Inventory`,
                seller,
                inventory
            });
        } catch (error) {
            console.error('Seller inventory error:', error);
            res.status(500).render('error', { title: 'Error', message: error.message, error });
        }
    }

    // API: Search sellers
    static async search(req, res) {
        try {
            const { q } = req.query;
            if (!q) {
                return res.json([]);
            }

            const sellers = await Seller.search(q);
            res.json(sellers);
        } catch (error) {
            console.error('Seller search error:', error);
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = SellerController;
