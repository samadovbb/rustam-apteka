# Audit Log Setup Instructions

## Issue Found
The audit logging system is not working because the `audit_logs` table doesn't exist in the database yet.

## Prerequisites
- MySQL/MariaDB server must be running
- Database connection configured in `.env` file

## Setup Steps

### 1. Start MySQL Server
```bash
# For systemd-based systems (Ubuntu, Debian, etc.)
sudo systemctl start mysql
# or
sudo systemctl start mariadb

# For older systems
sudo service mysql start
# or
sudo service mariadb start
```

### 2. Verify MySQL is Running
```bash
sudo systemctl status mysql
# or check process
ps aux | grep mysql
```

### 3. Create Database Configuration
If you don't have a `.env` file yet:
```bash
cp .env.example .env
```

Then edit `.env` with your database credentials:
```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=megadent_pos
DB_PORT=3306
```

### 4. Run the Migration

**Option A: Using MySQL Command Line**
```bash
mysql -u root -p megadent_pos < database/add_audit_logs.sql
```

**Option B: Using the Setup Script**
```bash
# After MySQL is running and .env is configured:
node scripts/setup-audit-logs.js
```

This script will:
- Check if the `audit_logs` table exists
- Create it if it doesn't exist
- Display the table structure
- Show any existing audit logs

### 5. Verify Installation
```bash
node scripts/setup-audit-logs.js
```

You should see output like:
```
✅ audit_logs table already exists.

📋 Table structure:
[table showing columns: id, table_name, record_id, action, old_data, new_data, user_id, user_login, created_at]

📊 Total audit logs in database: 0
```

## What Gets Logged

The audit log automatically tracks:
- **Sales**: Delete operations (shows full sale data before deletion)
- **Stock Intakes**: Delete operations (shows intake details before deletion)
- **Stock Transfers**: Delete operations (shows transfer details before deletion)
- **Payments**: Updates when payments are added to sales

Each log entry includes:
- Table name and record ID
- Action type (insert, update, delete)
- Old data (JSON) - data before the change
- New data (JSON) - data after the change
- User who performed the action
- Timestamp

## Testing the Audit Log

1. **Start the application:**
   ```bash
   npm start
   ```

2. **Login to the system**

3. **Perform a delete operation:**
   - Go to Sales → View a sale → Click Delete
   - Or go to Stock → Stock Intakes → Delete an intake
   - Or go to Stock → Stock Transfers → Delete a transfer

4. **Verify the log was created:**
   ```bash
   node scripts/setup-audit-logs.js
   ```

You should see the deleted record in the recent audit logs.

## Troubleshooting

### Error: "connect ECONNREFUSED 127.0.0.1:3306"
- **Cause**: MySQL server is not running
- **Solution**: Start MySQL using the commands in Step 1

### Error: "Access denied for user"
- **Cause**: Wrong database credentials in `.env`
- **Solution**: Update `.env` with correct credentials

### Error: "Unknown database 'megadent_pos'"
- **Cause**: Database doesn't exist
- **Solution**: Create it first:
  ```bash
  mysql -u root -p -e "CREATE DATABASE megadent_pos;"
  ```

### Error: "Table 'audit_logs' doesn't exist"
- **Cause**: Migration hasn't been run yet
- **Solution**: Run the migration (Step 4)

## Additional Notes

- The audit log system is designed to **never fail** the main operation. If logging fails, it will log an error to console but won't prevent the delete/update from completing.
- Logs are stored indefinitely by default. You can clean up old logs using:
  ```javascript
  const AuditLog = require('./src/models/AuditLog');
  await AuditLog.cleanup(90); // Delete logs older than 90 days
  ```
