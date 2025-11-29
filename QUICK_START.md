# MegaDent POS - Quick Start Guide

## ⚡ Quick Setup (5 Minutes)

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Configure Database
Edit `.env` file and update the database credentials:
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=megadent_pos
```

**Note:** A `.env` file has already been created for you with default values!

### Step 3: Setup Database
```bash
npm run db:setup
```

This will:
- Create the `megadent_pos` database
- Create all tables
- Insert sample data
- Create admin user

### Step 4: Start the Application
```bash
npm run dev
```

### Step 5: Login
Open browser and go to: **http://localhost:3000**

**Login Credentials:**
- Username: `admin`
- Password: `admin123`

---

## 🔧 Troubleshooting

### Issue: "Invalid credentials" when logging in

**Solution 1: Reset Admin Password**
```bash
npm run reset-admin
```

**Solution 2: Manual Database Fix**
If you have MySQL access, run:
```bash
mysql -u root -p < database/fix-admin-password.sql
```

**Solution 3: Recreate Database**
```bash
# Drop the database and recreate it
mysql -u root -p -e "DROP DATABASE IF EXISTS megadent_pos;"
npm run db:setup
```

### Issue: Database connection failed

**Check MySQL is running:**
```bash
# On Linux/Mac
sudo systemctl status mysql
# Or
mysql.server status

# On Windows (run as admin)
net start MySQL80
```

**Verify credentials:**
- Make sure the username, password, and host in `.env` are correct
- Test connection: `mysql -u root -p`

### Issue: Port 3000 already in use

**Change the port in `.env`:**
```env
PORT=3001
```

---

## 📝 Default Admin Password Hash

The default password `admin123` has been pre-hashed using bcrypt (10 rounds).

**Hash:** `$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi`

This hash is already included in:
- `database/schema.sql` (line 309)
- `database/fix-admin-password.sql`

---

## 🎯 After Login

1. **Dashboard** - View statistics and recent activity
2. **Products** - Add dental equipment products
3. **Suppliers** - Manage supplier information
4. **Sellers** - Add sales representatives
5. **Customers** - Customer database
6. **Stock Intake** - Record arrivals from suppliers
7. **Stock Transfer** - Transfer inventory to sellers
8. **Sales** - Process customer sales
9. **Debts** - Track customer debts and payments

---

## 📚 Sample Data Included

The database setup includes sample data:
- 2 Suppliers
- 5 Products (dental chairs, lights, x-ray systems, etc.)
- 3 Sellers
- 3 Customers

You can test the system immediately after setup!

---

## 🔐 Security Note

**IMPORTANT:** Change the default admin password after first login!

In production:
1. Update `ADMIN_PASSWORD` in `.env`
2. Run `npm run reset-admin`
3. Update `JWT_SECRET` in `.env` to a strong random string

---

## ✅ System Check

After setup, verify:
- [ ] Can access http://localhost:3000
- [ ] Can login with admin/admin123
- [ ] Dashboard shows sample data
- [ ] Can view products list
- [ ] No errors in console

If all checks pass, you're ready to use the system! 🎉

---

## 📖 Full Documentation

See [README.md](README.md) for complete documentation including:
- Detailed feature descriptions
- Database schema
- API endpoints
- Development guide
- Cron job configuration
