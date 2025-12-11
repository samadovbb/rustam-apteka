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
            await Seller.create({ full_name, phone, commission_percent }, req.user);
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
            await Seller.update(req.params.id, { full_name, phone, commission_percent }, req.user);
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
            await Seller.delete(req.params.id, req.user);
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
            // If no query, return all sellers
            if (!q || q.trim() === '') {
                const sellers = await Seller.getAll();
                return res.json(sellers);
            }

            const sellers = await Seller.search(q);
            res.json(sellers);
        } catch (error) {
            console.error('Seller search error:', error);
            res.status(500).json({ error: error.message });
        }
    }
    static async view(req, res) {
        try {
            const seller = await Seller.findById(req.params.id);
            if (!seller) {
                return res.status(404).render('error', {
                    title: 'Not Found',
                    message: 'Seller not found',
                    error: {}
                });
            }

            const debtors = await Seller.getDebtors(req.params.id);
            const sales = await Seller.getSalesHistory(req.params.id);
            const transfers = await Seller.getTransfers(req.params.id);
            const stats = await Seller.getSalesStats(req.params.id);
            const profitStats = await Seller.getProfitStats(req.params.id);
            const penaltyStats = await Seller.getPenaltyStats(req.params.id);
            const penalties = await Seller.getPenalties(req.params.id);

            res.render('sellers/view', {
                title: `${seller.full_name} - Details`,
                seller,
                debtors,
                sales,
                transfers,
                stats,
                profitStats,
                penaltyStats,
                penalties
            });
        } catch (error) {
            console.error('Seller view error:', error);
            res.status(500).render('error', { title: 'Error', message: error.message, error });
        }
    }

    static async calculatePenalties(req, res) {
        try {
            const { execSync } = require('child_process');
            const path = require('path');

            const scriptPath = path.join(__dirname, '../../scripts/calculate-seller-penalties.js');
            const output = execSync(`node "${scriptPath}"`, {
                encoding: 'utf-8',
                maxBuffer: 10 * 1024 * 1024 // 10MB buffer
            });

            res.json({
                success: true,
                message: 'Shtraflar muvaffaqiyatli hisoblandi',
                output: output
            });
        } catch (error) {
            console.error('Calculate penalties error:', error);
            res.status(500).json({
                success: false,
                error: error.message,
                output: error.stdout || error.stderr || ''
            });
        }
    }

    // API: Get all sellers
    static async getAllApi(req, res) {
        try {
            const sellers = await Seller.getAll();
            res.json(sellers);
        } catch (error) {
            console.error('Get all sellers API error:', error);
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = SellerController;
