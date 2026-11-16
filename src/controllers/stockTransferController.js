const StockTransfer = require('../models/StockTransfer');
const Seller = require('../models/Seller');
const Product = require('../models/Product');

class StockTransferController {
    static parseFilters(queryParams = {}) {
        const text = (value) => (typeof value === 'string' ? value.trim() : '');
        return {
            seller_id: text(queryParams.seller_id),
            date_from: text(queryParams.date_from),
            date_to: text(queryParams.date_to),
            product: text(queryParams.product)
        };
    }

    static async exportToExcel(req, res) {
        try {
            const ExcelJS = require('exceljs');
            const filters = StockTransferController.parseFilters(req.query);
            const rows = await StockTransfer.getExportRows(filters);

            const formatDate = (value) => new Date(value).toLocaleDateString('ru-RU');
            const filterDate = (value) => (value ? value.split('-').reverse().join('.') : null);

            let sellerName = 'Barchasi';
            if (filters.seller_id) {
                const seller = await Seller.findById(filters.seller_id);
                sellerName = seller ? seller.full_name : sellerName;
            }

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet("O'tkazmalar");

            worksheet.columns = [
                { width: 6 }, { width: 12 }, { width: 14 }, { width: 28 }, { width: 42 },
                { width: 22 }, { width: 10 }, { width: 14 }, { width: 16 }, { width: 30 }
            ];

            worksheet.mergeCells('A1:J1');
            worksheet.getCell('A1').value = "SOTUVCHILARGA O'TKAZMALAR HISOBOTI";
            worksheet.getCell('A1').font = { size: 16, bold: true };
            worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };

            worksheet.addRow([]);
            worksheet.addRow(['', 'Sotuvchi:', sellerName]);
            worksheet.addRow(['', 'Davr:', `${filterDate(filters.date_from) || '...'} — ${filterDate(filters.date_to) || '...'}`]);
            if (filters.product) {
                worksheet.addRow(['', 'Mahsulot:', filters.product]);
            }
            worksheet.addRow([]);

            const headerRow = worksheet.addRow([
                '№', "O'tkazma", 'Sana', 'Sotuvchi', 'Mahsulot',
                'Shtrix kod', 'Miqdor', 'Narx', 'Summa', 'Izoh'
            ]);
            headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            headerRow.eachCell((cell) => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            });

            let totalQuantity = 0;
            let totalAmount = 0;
            rows.forEach((row, index) => {
                const quantity = parseInt(row.quantity) || 0;
                const price = parseFloat(row.seller_price) || 0;
                const subtotal = parseFloat(row.subtotal) || 0;
                totalQuantity += quantity;
                totalAmount += subtotal;

                const excelRow = worksheet.addRow([
                    index + 1, `#${row.id}`, formatDate(row.transfer_date), row.seller_name,
                    row.product_name, row.barcode, quantity, price, subtotal, row.notes || ''
                ]);
                excelRow.getCell(8).numFmt = '#,##0.00';
                excelRow.getCell(9).numFmt = '#,##0.00';
            });

            const totalRow = worksheet.addRow(['', '', '', '', 'JAMI:', '', totalQuantity, '', totalAmount, '']);
            totalRow.font = { bold: true };
            totalRow.getCell(9).numFmt = '#,##0.00';

            const fileDate = new Date().toISOString().split('T')[0];
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=otkazmalar_${fileDate}.xlsx`);

            await workbook.xlsx.write(res);
            res.end();
        } catch (error) {
            console.error('Stock transfers export error:', error);
            res.status(500).send('Excel eksportida xatolik: ' + error.message);
        }
    }

    static async index(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const pageSize = parseInt(req.query.pageSize) || 50;

            const filters = StockTransferController.parseFilters(req.query);

            const [transfers, totalRecords, summary, sellers] = await Promise.all([
                StockTransfer.getAll(page, pageSize, filters),
                StockTransfer.getCount(filters),
                StockTransfer.getSummary(filters),
                Seller.getAll()
            ]);

            const totalPages = Math.ceil(totalRecords / pageSize);
            const startRecord = totalRecords > 0 ? (page - 1) * pageSize + 1 : 0;
            const endRecord = Math.min(page * pageSize, totalRecords);

            res.render('stock/transfer-list', {
                title: 'Stock Transfers - MegaDent POS',
                transfers,
                sellers,
                filters,
                summary,
                exportQuery: new URLSearchParams(
                    Object.entries(filters).filter(([, value]) => value)
                ).toString(),
                currentPage: page,
                pageSize: pageSize,
                totalRecords: totalRecords,
                totalPages: totalPages,
                startRecord: startRecord,
                endRecord: endRecord
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

            await StockTransfer.create(seller_id, parsedItems, notes, transfer_date || null, req.user);
            res.redirect(req.cookies['last_stock-transfer_url'] || '/stock-transfer');
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

    // Delete a stock transfer
    static async delete(req, res) {
        try {
            await StockTransfer.delete(req.params.id, req.user);
            res.json({ success: true, message: 'O\'tkazma muvaffaqiyatli o\'chirildi' });
        } catch (error) {
            console.error('Delete stock transfer error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
}

module.exports = StockTransferController;
