const { query } = require('../config/database');

class AuditLog {
    /**
     * Log an action (insert, update, delete)
     * @param {string} tableName - Name of the table
     * @param {number} recordId - ID of the affected record
     * @param {string} action - Type of action: 'insert', 'update', or 'delete'
     * @param {object|null} oldData - Old data (for update and delete)
     * @param {object|null} newData - New data (for insert and update)
     * @param {object|null} user - User object with id and login
     */
    static async log(tableName, recordId, action, oldData = null, newData = null, user = null) {
        try {
            const sql = `
                INSERT INTO audit_logs
                (table_name, record_id, action, old_data, new_data, user_id, user_login)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;

            const values = [
                tableName,
                recordId,
                action,
                oldData ? JSON.stringify(oldData) : null,
                newData ? JSON.stringify(newData) : null,
                user?.id || null,
                user?.login || null
            ];

            await query(sql, values);
        } catch (error) {
            // Log the error but don't fail the operation
            console.error('Audit log error:', error);
        }
    }

    /**
     * Get audit logs for a specific record
     * @param {string} tableName
     * @param {number} recordId
     * @param {number} limit
     */
    static async getByRecord(tableName, recordId, limit = 50) {
        const sql = `
            SELECT * FROM audit_logs
            WHERE table_name = ? AND record_id = ?
            ORDER BY created_at DESC
            LIMIT ${parseInt(limit)}
        `;
        return await query(sql, [tableName, recordId]);
    }

    /**
     * Get all audit logs with filters
     * @param {object} filters - Filter options
     * @param {number} limit
     */
    static async getAll(filters = {}, limit = 100) {
        let sql = 'SELECT * FROM audit_logs WHERE 1=1';
        const params = [];

        if (filters.tableName) {
            sql += ' AND table_name = ?';
            params.push(filters.tableName);
        }

        if (filters.action) {
            sql += ' AND action = ?';
            params.push(filters.action);
        }

        if (filters.userId) {
            sql += ' AND user_id = ?';
            params.push(filters.userId);
        }

        if (filters.dateFrom) {
            sql += ' AND created_at >= ?';
            params.push(filters.dateFrom);
        }

        if (filters.dateTo) {
            sql += ' AND created_at <= ?';
            params.push(filters.dateTo);
        }

        sql += ` ORDER BY created_at DESC LIMIT ${parseInt(limit)}`;

        return await query(sql, params);
    }

    /**
     * Get audit statistics
     */
    static async getStatistics() {
        const sql = `
            SELECT
                table_name,
                action,
                COUNT(*) as count
            FROM audit_logs
            GROUP BY table_name, action
            ORDER BY table_name, action
        `;
        return await query(sql);
    }

    /**
     * Delete old audit logs (cleanup)
     * @param {number} daysOld - Delete logs older than this many days
     */
    static async cleanup(daysOld = 90) {
        const sql = `
            DELETE FROM audit_logs
            WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
        `;
        const result = await query(sql, [daysOld]);
        return result.affectedRows;
    }
}

module.exports = AuditLog;
