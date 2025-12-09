# TODO: Delete and Edit Functionality

This document outlines the remaining work needed to complete delete and edit functionality for all records.

## ✅ Completed

1. **Fixed Payment Display Issue**
   - Sales now correctly show remaining amounts after payments
   - Added `remaining_amount` calculation in `Sale.findById()` and `getAll()`

2. **Offline Library Support**
   - Created `download-offline-libs.sh` script
   - Updated paths in header.ejs and footer.ejs
   - See `OFFLINE_SETUP.md` for setup instructions

3. **Audit Logging System**
   - Created `audit_logs` table in database
   - Implemented `AuditLog` model with full functionality
   - Added audit logging to `Sale.delete()` and `StockIntake.delete()`

## 🔨 Remaining Work

### 1. Complete Delete Functionality

#### A. Add Delete Methods to Models

**StockTransfer Model** (`src/models/StockTransfer.js`):
```javascript
static async delete(id, user = null) {
    const AuditLog = require('./AuditLog');
    return await transaction(async (conn) => {
        // Get transfer data for audit
        const [transfers] = await conn.execute(
            'SELECT * FROM stock_transfers WHERE id = ?', [id]
        );
        if (!transfers[0]) throw new Error('Transfer not found');
        const transfer = transfers[0];

        // Get items to reverse inventory changes
        const [items] = await conn.execute(
            'SELECT * FROM stock_transfer_items WHERE stock_transfer_id = ?', [id]
        );

        // Reverse inventory changes
        for (const item of items) {
            // Add back to warehouse
            await conn.execute(
                `UPDATE warehouse_inventory SET quantity = quantity + ? WHERE product_id = ?`,
                [item.quantity, item.product_id]
            );
            // Deduct from seller
            await conn.execute(
                `UPDATE seller_inventory SET quantity = quantity - ?
                 WHERE seller_id = ? AND product_id = ?`,
                [item.quantity, transfer.seller_id, item.product_id]
            );
        }

        // Delete transfer
        await conn.execute('DELETE FROM stock_transfers WHERE id = ?', [id]);

        // Log audit
        await AuditLog.log('stock_transfers', id, 'delete', { ...transfer, items }, null, user);
        return true;
    });
}
```

**Payment Model** (if needed - create new file):
```javascript
// Note: Deleting payments is complex because it affects debt and sale status
// Consider if this should be allowed at all, or require special permissions
```

#### B. Add Delete Controllers

**SalesController** (`src/controllers/salesController.js`):
```javascript
static async delete(req, res) {
    try {
        await Sale.delete(req.params.id, req.user);
        res.json({ success: true, message: 'Savdo o\'chirildi' });
    } catch (error) {
        console.error('Delete sale error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}
```

**StockIntakeController** (`src/controllers/stockIntakeController.js`):
```javascript
static async delete(req, res) {
    try {
        await StockIntake.delete(req.params.id, req.user);
        res.json({ success: true, message: 'Qabul o\'chirildi' });
    } catch (error) {
        console.error('Delete intake error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}
```

**StockTransferController** (`src/controllers/stockTransferController.js`):
```javascript
static async delete(req, res) {
    try {
        await StockTransfer.delete(req.params.id, req.user);
        res.json({ success: true, message: 'O\'tkazma o\'chirildi' });
    } catch (error) {
        console.error('Delete transfer error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}
```

#### C. Add Delete Routes

**src/routes/sales.js**:
```javascript
router.delete('/:id', SalesController.delete);
```

**src/routes/stock-intake.js**:
```javascript
router.delete('/:id', StockIntakeController.delete);
```

**src/routes/stock-transfer.js**:
```javascript
router.delete('/:id', StockTransferController.delete);
```

#### D. Add Delete Buttons to UI

**Sales View** (`src/views/sales/view.ejs`):
Add after the back button:
```html
<button onclick="deleteSale(<%= sale.id %>)" class="btn btn-danger">O'chirish</button>

<script>
async function deleteSale(id) {
    const result = await Swal.fire({
        title: 'Ishonchingiz komilmi?',
        text: 'Bu savdoni o\'chirishni xohlaysizmi? Bu harakatni bekor qilib bo\'lmaydi!',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Ha, o\'chirish',
        cancelButtonText: 'Bekor qilish',
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6'
    });

    if (result.isConfirmed) {
        try {
            const response = await fetch(`/sales/${id}`, { method: 'DELETE' });
            const data = await response.json();
            if (data.success) {
                Swal.fire('O\'chirildi!', data.message, 'success')
                    .then(() => window.location.href = '/sales');
            } else {
                Swal.fire('Xato!', data.error, 'error');
            }
        } catch (error) {
            Swal.fire('Xato!', 'O\'chirishda xatolik yuz berdi', 'error');
        }
    }
}
</script>
```

**Sales List** (`src/views/sales/index.ejs`):
Add delete button in each row:
```html
<button onclick="deleteSale(<%= sale.id %>)" class="btn btn-sm btn-danger">O'chirish</button>
```

Apply similar patterns for:
- Stock Intake list and view pages
- Stock Transfer list and view pages

### 2. Implement Edit Functionality

For each entity type (Sales, Stock Intakes, Stock Transfers):

#### A. Add Update Methods to Models

Example for Sale:
```javascript
static async update(saleId, data, user = null) {
    const AuditLog = require('./AuditLog');

    return await transaction(async (conn) => {
        // Get old data for audit
        const [oldSales] = await conn.execute(
            'SELECT * FROM sales WHERE id = ?', [saleId]
        );
        const oldSale = oldSales[0];

        // Update sale (only certain fields should be editable)
        // Be careful about what can be edited - changing items affects inventory

        // Log audit
        await AuditLog.log('sales', saleId, 'update', oldSale, data, user);

        return saleId;
    });
}
```

#### B. Create Edit Forms

- Copy `create.ejs` to `edit.ejs` for each entity
- Pre-populate fields with existing data
- Change form action to use PUT/PATCH method
- Add hidden `_method` field for method override

#### C. Add Edit Controllers and Routes

Similar to create, but load existing data and call update method.

### 3. Create Audit Log Viewer

#### A. Create Controller (`src/controllers/auditLogController.js`)
```javascript
const AuditLog = require('../models/AuditLog');

class AuditLogController {
    static async index(req, res) {
        const { table_name, action, date_from, date_to } = req.query;
        const filters = {};
        if (table_name) filters.tableName = table_name;
        if (action) filters.action = action;
        if (date_from) filters.dateFrom = date_from;
        if (date_to) filters.dateTo = date_to;

        const logs = await AuditLog.getAll(filters, 200);
        res.render('audit-logs/index', { logs, filters });
    }
}
```

#### B. Create Views (`src/views/audit-logs/index.ejs`)
Show all audit logs in a table with:
- Filters for table name, action, date range
- Show old_data and new_data in expandable JSON format
- User who made the change
- Timestamp

### 4. Database Setup

**For existing databases**, run:
```sql
source database/add_audit_logs.sql;
```

**For new installations**, the table is already in `schema.sql`.

### 5. Offline Libraries Setup

On a machine with internet access:
```bash
bash download-offline-libs.sh
```

Then copy `src/public/vendor/` directory to your offline laptop.

See `OFFLINE_SETUP.md` for detailed instructions.

## Implementation Priority

1. **High Priority**:
   - Complete delete functionality for all entities
   - Add delete buttons to UI
   - Set up offline libraries

2. **Medium Priority**:
   - Implement edit functionality
   - Create audit log viewer

3. **Low Priority**:
   - Add permissions/roles for delete operations
   - Implement soft delete option
   - Add data export for audit logs

## Testing Checklist

- [ ] Test deleting a sale and verify inventory is restored
- [ ] Test deleting a stock intake and verify warehouse inventory decreases
- [ ] Test deleting a stock transfer and verify inventories are reversed
- [ ] Verify audit logs are created for all delete operations
- [ ] Test that deleting a sale also deletes related debts and payments
- [ ] Test offline mode with local libraries
- [ ] Test that payment display now shows correct amounts

## Security Considerations

- Only admins should be able to delete records
- Add confirmation dialogs for all delete operations
- Consider implementing soft delete (mark as deleted instead of removing)
- Audit logs should be append-only (no delete/edit)
- Consider adding a "restore" function using audit log data
