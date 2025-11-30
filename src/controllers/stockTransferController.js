const StockTransfer = require('../models/StockTransfer');
const Seller = require('../models/Seller');
const Product = require('../models/Product');

class StockTransferController {
    static async index(req, res) {
        try {
            const transfers = await StockTransfer.getAll();
            res.render('stock/transfer-list', {
                title: 'Stock Transfers - MegaDent POS',
                transfers
            });
        } catch (error) {
            console.error('Stock transfers index error:', error);
            res.status(500).render('error', { title: 'Error', message: error.message, error });
        }
    }

    static async create(req, res) {
        try {
            const sellers = await Seller.getAll();
            const warehouseStock = await Product.getAllWarehouseStock();

            res.render('stock/transfer-form', {
                title: 'New Stock Transfer',
                sellers,
                warehouseStock,
                error: null
            });
        } catch (error) {
            console.error('Stock transfer create error:', error);
            res.status(500).render('error', { title: 'Error', message: error.message, error });
        }
    }

    static async store(req, res) {
        try {
            const { seller_id, notes, items, transfer_date } = req.body;

            const parsedItems = typeof items === 'string' ? JSON.parse(items) : items;

            if (!parsedItems || parsedItems.length === 0) {
                throw new Error('At least one product is required');
            }

            await StockTransfer.create(seller_id, parsedItems, notes, transfer_date || null);
            res.redirect('/stock-transfer');
        } catch (error) {
            console.error('Stock transfer store error:', error);
            const sellers = await Seller.getAll();
            const warehouseStock = await Product.getAllWarehouseStock();

            res.render('stock/transfer-form', {
                title: 'New Stock Transfer',
                sellers,
                warehouseStock,
                error: error.message
            });
        }
    }

    static async view(req, res) {
        try {
            const transfer = await StockTransfer.findById(req.params.id);
            const items = await StockTransfer.getItems(req.params.id);

            if (!transfer) {
                return res.status(404).render('error', {
                    title: 'Not Found',
                    message: 'Stock transfer not found',
                    error: {}
                });
            }

            res.render('stock/transfer-view', {
                title: `Stock Transfer #${transfer.id}`,
                transfer,
                items
            });
        } catch (error) {
            console.error('Stock transfer view error:', error);
            res.status(500).render('error', { title: 'Error', message: error.message, error });
        }
    }

    static async getLatestDate(req, res) {
        try {
            const result = await StockTransfer.getLatestDate();
            res.json({ date: result || new Date().toISOString().split('T')[0] });
        } catch (error) {
            console.error('Get latest transfer date error:', error);
            res.json({ date: new Date().toISOString().split('T')[0] });
        }
    }
}

module.exports = StockTransferController;
