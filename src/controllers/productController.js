const Product = require('../models/Product');

class ProductController {
    // List all products
    static async index(req, res) {
        try {
            const products = await Product.getAll();
            res.render('products/index', {
                title: 'Products - MegaDent POS',
                products
            });
        } catch (error) {
            console.error('Products index error:', error);
            res.status(500).render('error', { title: 'Error', message: error.message, error });
        }
    }

    // Show create form
    static async create(req, res) {
        res.render('products/create', {
            title: 'Add New Product',
            error: null
        });
    }

    // Store new product
    static async store(req, res) {
        try {
            const { name, barcode, warranty_months, purchase_price, sell_price } = req.body;

            // Check if barcode already exists
            const existing = await Product.findByBarcode(barcode);
            if (existing) {
                return res.render('products/create', {
                    title: 'Add New Product',
                    error: 'Barcode already exists'
                });
            }

            await Product.create({
                name,
                barcode,
                warranty_months: parseInt(warranty_months) || 0,
                purchase_price: parseFloat(purchase_price) || 0,
                sell_price: parseFloat(sell_price) || 0
            });

            res.redirect('/products');
        } catch (error) {
            console.error('Product create error:', error);
            res.render('products/create', {
                title: 'Add New Product',
                error: error.message
            });
        }
    }

    // Show edit form
    static async edit(req, res) {
        try {
            const product = await Product.findById(req.params.id);
            if (!product) {
                return res.status(404).render('error', {
                    title: 'Not Found',
                    message: 'Product not found',
                    error: {}
                });
            }

            res.render('products/edit', {
                title: 'Edit Product',
                product,
                error: null
            });
        } catch (error) {
            console.error('Product edit error:', error);
            res.status(500).render('error', { title: 'Error', message: error.message, error });
        }
    }

    // Update product
    static async update(req, res) {
        try {
            const { name, barcode, warranty_months, purchase_price, sell_price } = req.body;
            const id = req.params.id;

            // Check if barcode exists for another product
            const existing = await Product.findByBarcode(barcode);
            if (existing && existing.id != id) {
                const product = await Product.findById(id);
                return res.render('products/edit', {
                    title: 'Edit Product',
                    product,
                    error: 'Barcode already exists for another product'
                });
            }

            await Product.update(id, {
                name,
                barcode,
                warranty_months: parseInt(warranty_months) || 0,
                purchase_price: parseFloat(purchase_price) || 0,
                sell_price: parseFloat(sell_price) || 0
            });

            res.redirect('/products');
        } catch (error) {
            console.error('Product update error:', error);
            const product = await Product.findById(req.params.id);
            res.render('products/edit', {
                title: 'Edit Product',
                product,
                error: error.message
            });
        }
    }

    // Delete product
    static async delete(req, res) {
        try {
            await Product.delete(req.params.id);
            res.redirect('/products');
        } catch (error) {
            console.error('Product delete error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    // API: Search products
    static async search(req, res) {
        try {
            const { q } = req.query;
            if (!q) {
                return res.json([]);
            }

            const products = await Product.search(q);
            res.json(products);
        } catch (error) {
            console.error('Product search error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    // API: Get product by barcode
    static async getByBarcode(req, res) {
        try {
            const product = await Product.findByBarcode(req.params.barcode);
            if (!product) {
                return res.status(404).json({ error: 'Product not found' });
            }
            res.json(product);
        } catch (error) {
            console.error('Get product by barcode error:', error);
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = ProductController;
