const StockIntake = require('../models/StockIntake');
const Supplier = require('../models/Supplier');
const Product = require('../models/Product');

class StockIntakeController {
    static async index(req, res) {
        try {
            const intakes = await StockIntake.getAll();
            res.render('stock/intake-list', {
                title: 'Stock Intakes - MegaDent POS',
                intakes
            });
        } catch (error) {
            console.error('Stock intakes index error:', error);
            res.status(500).render('error', { title: 'Error', message: error.message, error });
        }
    }

    static async create(req, res) {
        try {
            const suppliers = await Supplier.getAll();
            const products = await Product.getAll();

            res.render('stock/intake-form', {
                title: 'New Stock Intake',
                suppliers,
                products,
                error: null
            });
        } catch (error) {
            console.error('Stock intake create error:', error);
            res.status(500).render('error', { title: 'Error', message: error.message, error });
        }
    }

    static async store(req, res) {
        try {
            const { supplier_id, notes, items } = req.body;

            // Parse items if it's a JSON string
            const parsedItems = typeof items === 'string' ? JSON.parse(items) : items;

            if (!parsedItems || parsedItems.length === 0) {
                throw new Error('At least one product is required');
            }

            await StockIntake.create(supplier_id, parsedItems, notes);
            res.redirect('/stock-intake');
        } catch (error) {
            console.error('Stock intake store error:', error);
            const suppliers = await Supplier.getAll();
            const products = await Product.getAll();

            res.render('stock/intake-form', {
                title: 'New Stock Intake',
                suppliers,
                products,
                error: error.message
            });
        }
    }

    static async view(req, res) {
        try {
            const intake = await StockIntake.findById(req.params.id);
            const items = await StockIntake.getItems(req.params.id);

            if (!intake) {
                return res.status(404).render('error', {
                    title: 'Not Found',
                    message: 'Stock intake not found',
                    error: {}
                });
            }

            res.render('stock/intake-view', {
                title: `Stock Intake #${intake.id}`,
                intake,
                items
            });
        } catch (error) {
            console.error('Stock intake view error:', error);
            res.status(500).render('error', { title: 'Error', message: error.message, error });
        }
    }
}

module.exports = StockIntakeController;
