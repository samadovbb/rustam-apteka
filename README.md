# MegaDent POS System

A complete Point of Sale (POS) web system for MegaDent dental equipment store built with Node.js, Express, MySQL, and EJS templates.

## 🚀 Features

### Core Features
- ✅ **JWT Authentication** - Secure admin authentication system
- ✅ **Product Management** - Full CRUD operations for products
- ✅ **Supplier Management** - Track and manage suppliers
- ✅ **Seller Management** - Manage sellers with commission tracking
- ✅ **Customer Management** - Customer database with phone-based lookup
- ✅ **Stock Intake** - Record product arrivals from suppliers
- ✅ **Stock Transfer** - Transfer inventory to sellers with custom pricing
- ✅ **Sales System** - Complete sales process with partial payments
- ✅ **Debt Management** - Track debts with automatic markup calculation
- ✅ **Automated Debt Markup** - Monthly cron job for debt interest/markup
- ✅ **Front-end Validation** - HTML5 + JavaScript validation on all forms
- ✅ **Responsive Dashboard** - Modern, clean UI design

### Business Logic
1. **Stock Intake from Suppliers**
   - Select existing products or create new ones
   - View last purchase/sell prices
   - Update pricing during intake
   - Auto-update warehouse inventory

2. **Stock Transfer to Sellers**
   - Transfer products from warehouse to sellers
   - Set custom selling price per seller
   - Track seller-specific inventory

3. **Sales Process**
   - Customer phone-based search with autocomplete
   - Auto-populate customer details
   - Create new customers on-the-fly
   - Partial payment support
   - Automatic debt creation

4. **Debt & Markup System**
   - Fixed markup (monthly fixed amount)
   - Percent markup (monthly interest rate)
   - Grace period support
   - Automatic markup calculation via cron job
   - Detailed markup logs

## 📋 Prerequisites

- Node.js (v14 or higher)
- MySQL (v5.7 or higher)
- npm or yarn package manager

## ⚙️ Installation & Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd rustam-apteka
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=megadent_pos
DB_PORT=3306

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRES_IN=24h

# Admin Default Credentials
ADMIN_LOGIN=admin
ADMIN_PASSWORD=admin123

# Debt Markup Cron Schedule (0 0 1 * * = 1st day of each month at midnight)
DEBT_CRON_SCHEDULE=0 0 1 * *
```

### 4. Setup Database

Run the database setup script:

```bash
npm run db:setup
```

This will:
- Create the `megadent_pos` database
- Create all required tables with proper relationships
- Insert sample data (products, suppliers, sellers, customers)
- Create default admin user (admin/admin123)

### 5. Start the Application

**Development mode with auto-restart:**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

The application will be available at: `http://localhost:3000`

## 📁 Project Structure

```
rustam-apteka/
├── database/
│   └── schema.sql              # Complete database schema
├── src/
│   ├── config/
│   │   ├── database.js         # Database connection
│   │   └── database-setup.js   # Database setup script
│   ├── controllers/            # Request handlers
│   │   ├── authController.js
│   │   ├── dashboardController.js
│   │   ├── productController.js
│   │   ├── supplierController.js
│   │   ├── sellerController.js
│   │   ├── customerController.js
│   │   ├── stockIntakeController.js
│   │   ├── stockTransferController.js
│   │   ├── salesController.js
│   │   └── debtController.js
│   ├── middleware/
│   │   └── auth.js             # JWT authentication middleware
│   ├── models/                 # Data models
│   │   ├── Admin.js
│   │   ├── Product.js
│   │   ├── Supplier.js
│   │   ├── Seller.js
│   │   ├── Customer.js
│   │   ├── StockIntake.js
│   │   ├── StockTransfer.js
│   │   ├── Sale.js
│   │   └── Debt.js
│   ├── routes/                 # Route definitions
│   │   ├── auth.js
│   │   ├── dashboard.js
│   │   ├── products.js
│   │   ├── suppliers.js
│   │   ├── sellers.js
│   │   ├── customers.js
│   │   ├── stock-intake.js
│   │   ├── stock-transfer.js
│   │   ├── sales.js
│   │   └── debts.js
│   ├── cron/
│   │   └── debt-markup.js      # Monthly debt markup cron job
│   ├── public/
│   │   ├── css/
│   │   │   └── style.css       # Application styles
│   │   └── js/
│   │       ├── validation.js   # Client-side validation
│   │       └── app.js          # Client-side logic
│   ├── views/                  # EJS templates
│   │   ├── partials/
│   │   │   ├── header.ejs
│   │   │   ├── footer.ejs
│   │   │   └── sidebar.ejs
│   │   ├── products/
│   │   │   ├── index.ejs
│   │   │   ├── create.ejs
│   │   │   └── edit.ejs
│   │   ├── login.ejs
│   │   ├── dashboard.ejs
│   │   └── error.ejs
│   └── server.js               # Application entry point
├── .env.example                # Environment template
├── .gitignore
├── package.json
└── README.md
```

## 🗄️ Database Schema

### Core Tables

1. **admins** - Admin users with JWT authentication
2. **products** - Product catalog with pricing
3. **suppliers** - Supplier information
4. **sellers** - Seller/salesperson data
5. **customers** - Customer database

### Inventory Tables

6. **warehouse_inventory** - Main warehouse stock
7. **seller_inventory** - Seller-specific inventory with custom pricing

### Transaction Tables

8. **stock_intakes** - Supplier deliveries
9. **stock_intake_items** - Products in each delivery
10. **stock_transfers** - Transfers to sellers
11. **stock_transfer_items** - Products in each transfer
12. **sales** - Sales transactions
13. **sale_items** - Products in each sale
14. **payments** - Payment records

### Debt Management Tables

15. **debts** - Active customer debts
16. **debt_payments** - Debt payment tracking
17. **debt_fixed_markup_logs** - Fixed markup calculation logs
18. **debt_percent_markup_logs** - Percentage markup calculation logs

All tables include `created_at` and `updated_at` timestamp fields.

## 🔐 Default Credentials

**Admin Login:**
- Username: `admin`
- Password: `admin123`

⚠️ **IMPORTANT:** Change these credentials in production!

## 🎯 Usage Guide

### 1. Login
- Navigate to `http://localhost:3000`
- Enter admin credentials
- You'll be redirected to the dashboard

### 2. Add Products
- Go to Products → Add New Product
- Fill in product details (name, barcode, warranty, prices)
- All fields have front-end validation

### 3. Stock Intake
- Go to Stock Intake → New Stock Intake
- Select supplier
- Add products with quantities and purchase prices
- Products can be selected by name or barcode
- Warehouse inventory is automatically updated

### 4. Transfer to Sellers
- Go to Stock Transfer → New Transfer
- Select seller
- Choose products from warehouse
- Set selling price for each product (per seller)
- Seller inventory is updated automatically

### 5. Make a Sale
- Go to Sales → New Sale
- Enter customer phone number
- If customer exists, details auto-populate
- If not, create new customer
- Select seller
- Add products from seller's inventory
- Enter initial payment (can be 0 for full debt)
- Configure debt terms if needed (markup type, grace period)
- System validates selling price isn't below seller's price

### 6. Manage Debts
- Go to Debts to view all active debts
- View debt details including markup logs
- Apply manual markup if needed
- Track customer payments

### 7. Debt Markup Cron Job
- Runs automatically on 1st day of each month
- Processes all active debts past grace period
- Applies fixed or percent markup
- Logs all calculations
- Can be triggered manually for testing

## 🔧 API Endpoints

### Authentication
- `POST /login` - Admin login
- `POST /api/auth/login` - API login (returns JSON)
- `GET /logout` - Logout

### Products API
- `GET /products/api/search?q=query` - Search products
- `GET /products/api/barcode/:barcode` - Get product by barcode

### Customers API
- `GET /customers/api/search?q=query` - Search customers
- `GET /customers/api/phone/:phone` - Get customer by phone

### Sales API
- `GET /sales/api/seller/:seller_id/inventory` - Get seller inventory

## 📝 Front-end Validation

All forms include comprehensive client-side validation:

### Validation Rules
- `required` - Field is mandatory
- `email` - Valid email format
- `phone` - Valid phone number (+998XXXXXXXXX)
- `number` - Numeric value
- `positiveNumber` - Positive number
- `min:value` - Minimum value
- `max:value` - Maximum value
- `minLength:length` - Minimum string length
- `maxLength:length` - Maximum string length

### Usage Example
```html
<input
    type="text"
    name="phone"
    data-validate="required|phone"
    class="form-control"
>
```

## 🔄 Cron Job Configuration

The debt markup cron job runs based on `DEBT_CRON_SCHEDULE` in `.env`.

**Default:** `0 0 1 * *` (1st day of each month at midnight)

**Format:** Cron expression
- `0 0 1 * *` - Monthly on 1st at midnight
- `0 0 * * *` - Daily at midnight
- `0 */6 * * *` - Every 6 hours

**Manual Trigger:**
```javascript
const { triggerManualMarkup } = require('./src/cron/debt-markup');
await triggerManualMarkup();
```

## 🎨 Template Extension

To add more views, follow the existing pattern:

### Example: Adding Suppliers CRUD Templates

Create files in `src/views/suppliers/`:

**index.ejs** - List view
```ejs
<%- include('../partials/header') %>
<div class="main-wrapper">
    <%- include('../partials/sidebar') %>
    <main class="main-content">
        <!-- Your content -->
    </main>
</div>
<%- include('../partials/footer') %>
```

**create.ejs** - Create form with validation
**edit.ejs** - Edit form with validation

Same pattern applies to all other modules.

## 🔒 Security Features

- ✅ JWT token-based authentication
- ✅ HTTP-only cookies for token storage
- ✅ Password hashing with bcrypt (10 rounds)
- ✅ SQL injection protection (parameterized queries)
- ✅ XSS protection via EJS escaping
- ✅ Input validation (client-side and server-side)
- ✅ CSRF protection ready (add csrf middleware if needed)

## 🐛 Troubleshooting

### Database Connection Failed
- Check MySQL is running
- Verify credentials in `.env`
- Ensure database user has proper permissions

### Port Already in Use
- Change `PORT` in `.env`
- Or stop the process using port 3000

### Login Not Working
- Ensure database is properly set up
- Check admin user exists in `admins` table
- Verify JWT_SECRET is set in `.env`

### Cron Job Not Running
- Check `DEBT_CRON_SCHEDULE` format
- Verify server time and timezone
- Check logs for errors

## 📚 Technology Stack

- **Backend:** Node.js, Express.js
- **Database:** MySQL with mysql2 driver
- **Authentication:** JWT (jsonwebtoken)
- **Template Engine:** EJS
- **Password Hashing:** bcryptjs
- **Validation:** express-validator + custom JS
- **Cron Jobs:** node-cron
- **Development:** nodemon

## 🚧 Future Enhancements

Potential improvements for production:
- Add user roles (admin, manager, seller)
- Implement reports and analytics
- Add export functionality (PDF, Excel)
- Implement barcode scanning
- Add email/SMS notifications
- Implement backup system
- Add more charts and visualizations
- Multi-language support
- Mobile app version

## 📄 License

ISC License

## 👨‍💻 Support

For issues or questions:
- Create an issue in the repository
- Contact the development team

---

**Built with ❤️ for MegaDent**
