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
            const { supplier_id, notes, items, intake_date } = req.body;

            // Parse items if it's a JSON string
            const parsedItems = typeof items === 'string' ? JSON.parse(items) : items;

            if (!parsedItems || parsedItems.length === 0) {
                throw new Error('At least one product is required');
            }

            // Process items and create new products if needed
            const processedItems = [];
            for (const item of parsedItems) {
                let productId = item.product_id;

                // If no product_id but has product_name, create new product
                if (!productId && item.product_name) {
                    // Generate a barcode if not provided (using timestamp + random)
                    const barcode = item.barcode || `AUTO-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

                    // Create the new product
                    productId = await Product.create({
                        name: item.product_name,
                        barcode: barcode,
                        warranty_months: 0,
                        purchase_price: item.purchase_price || 0,
                        sell_price: item.sell_price || item.purchase_price || 0
                    }, req.user);
                } else if (productId && item.sell_price) {
                    // Update sell price if provided for existing product
                    const product = await Product.findById(productId);
                    if (product && product.sell_price != item.sell_price) {
                        await Product.updatePrices(productId, item.purchase_price, item.sell_price, req.user);
                    }
                }

                // Add processed item
                processedItems.push({
                    product_id: productId,
                    quantity: item.quantity,
                    purchase_price: item.purchase_price
                });
            }

            await StockIntake.create(supplier_id, processedItems, notes, intake_date || null, req.user);
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

    static async getLatestDate(req, res) {
        try {
            const result = await StockIntake.getLatestDate();
            res.json({ date: result || new Date().toISOString().split('T')[0] });
        } catch (error) {
            console.error('Get latest intake date error:', error);
            res.json({ date: new Date().toISOString().split('T')[0] });
        }
    }

    // Delete a stock intake
    static async delete(req, res) {
        try {
            await StockIntake.delete(req.params.id, req.user);
            res.json({ success: true, message: 'Qabul muvaffaqiyatli o\'chirildi' });
        } catch (error) {
            console.error('Delete stock intake error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
}

module.exports = StockIntakeController;
