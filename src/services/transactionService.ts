// src/services/transactionService.ts
import pool from '../config/db';
import { TransactionFilters } from '../types';

export class TransactionService {
    async createTransaction(userId: string, data: any) {
        const { amount, type, category, date, description } = data;
        const result = await pool.query(
            `INSERT INTO transactions (amount, type, category, date, description, user_id)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [amount, type, category, new Date(date), description, userId]
        );
        return this.mapToCamelCase(result.rows[0]);
    }

    async getTransactions(userId: string, filters: TransactionFilters) {
        let query = 'SELECT * FROM transactions WHERE user_id = $1';
        const values: any[] = [userId];
        let paramIndex = 2;

        if (filters.startDate) {
            query += ` AND date >= $${paramIndex++}`;
            values.push(new Date(filters.startDate));
        }
        if (filters.endDate) {
            query += ` AND date <= $${paramIndex++}`;
            values.push(new Date(filters.endDate));
        }
        if (filters.category) {
            query += ` AND category = $${paramIndex++}`;
            values.push(filters.category);
        }
        if (filters.type) {
            query += ` AND type = $${paramIndex++}`;
            values.push(filters.type);
        }

        query += ' ORDER BY date DESC';
        
        const limit = filters.limit || 50;
        const offset = filters.offset || 0;
        query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        values.push(limit, offset);

        const result = await pool.query(query, values);
        return result.rows.map(this.mapToCamelCase);
    }

    async getTransactionById(id: string, userId: string) {
        const result = await pool.query(
            'SELECT * FROM transactions WHERE id = $1 AND user_id = $2',
            [id, userId]
        );
        return result.rows[0] ? this.mapToCamelCase(result.rows[0]) : null;
    }

    async updateTransaction(id: string, userId: string, data: any) {
        // First check if exists
        const exists = await this.getTransactionById(id, userId);
        if (!exists) throw new Error('Transaction not found');

        const updates: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (data.amount !== undefined) {
            updates.push(`amount = $${paramIndex++}`);
            values.push(data.amount);
        }
        if (data.type !== undefined) {
            updates.push(`type = $${paramIndex++}`);
            values.push(data.type);
        }
        if (data.category !== undefined) {
            updates.push(`category = $${paramIndex++}`);
            values.push(data.category);
        }
        if (data.date !== undefined) {
            updates.push(`date = $${paramIndex++}`);
            values.push(new Date(data.date));
        }
        if (data.description !== undefined) {
            updates.push(`description = $${paramIndex++}`);
            values.push(data.description);
        }

        if (updates.length === 0) return exists;

        values.push(id);
        const query = `UPDATE transactions SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
        
        const result = await pool.query(query, values);
        return this.mapToCamelCase(result.rows[0]);
    }

    async deleteTransaction(id: string, userId: string) {
        const exists = await this.getTransactionById(id, userId);
        if (!exists) throw new Error('Transaction not found');

        const result = await pool.query(
            'DELETE FROM transactions WHERE id = $1 RETURNING *',
            [id]
        );
        return this.mapToCamelCase(result.rows[0]);
    }
    
    private mapToCamelCase(row: any) {
        if (!row) return row;
        return {
            id: row.id,
            amount: parseFloat(row.amount),
            type: row.type,
            category: row.category,
            date: row.date,
            description: row.description,
            userId: row.user_id,
            createdAt: row.created_at
        };
    }
}

export class DashboardService {
    async getDashboardSummary(userId: string) {
        const result = await pool.query(
            'SELECT * FROM transactions WHERE user_id = $1 ORDER BY date DESC',
            [userId]
        );
        
        // Map everything to camel case correctly
        const tsHelper = new TransactionService();
        const transactions = result.rows.map(row => tsHelper['mapToCamelCase'](row));

        const totalIncome = transactions
            .filter(t => t.type === 'INCOME')
            .reduce((sum, t) => sum + t.amount, 0);

        const totalExpenses = transactions
            .filter(t => t.type === 'EXPENSE')
            .reduce((sum, t) => sum + t.amount, 0);

        const categoryTotals = this.calculateCategoryTotals(transactions);
        const monthlyTrends = this.calculateMonthlyTrends(transactions);
        const recentTransactions = transactions.slice(0, 10);

        return {
            totalIncome,
            totalExpenses,
            netBalance: totalIncome - totalExpenses,
            categoryTotals,
            recentTransactions,
            monthlyTrends
        };
    }

    private calculateCategoryTotals(transactions: any[]) {
        const categoryMap = new Map();

        transactions.forEach(t => {
            const key = `${t.category}-${t.type}`;
            const current = categoryMap.get(key) || { category: t.category, type: t.type, total: 0 };
            current.total += parseFloat(t.amount || 0);
            categoryMap.set(key, current);
        });

        return Array.from(categoryMap.values());
    }

    private calculateMonthlyTrends(transactions: any[]) {
        const monthlyMap = new Map();

        transactions.forEach(t => {
            const dateObj = t.date instanceof Date ? t.date : new Date(t.date);
            const month = dateObj.toISOString().slice(0, 7);
            if (!monthlyMap.has(month)) {
                monthlyMap.set(month, { income: 0, expenses: 0 });
            }

            const data = monthlyMap.get(month);
            if (t.type === 'INCOME') {
                data.income += parseFloat(t.amount || 0);
            } else {
                data.expenses += parseFloat(t.amount || 0);
            }
        });

        return Array.from(monthlyMap.entries())
            .map(([month, data]) => ({ month, ...data }))
            .sort((a, b) => a.month.localeCompare(b.month));
    }
}

export class UserService {
    async createUser(data: any) {
        const { email, name, role, status } = data;
        const result = await pool.query(
            `INSERT INTO users (email, name, role, status)
             VALUES ($1, $2, $3, $4) RETURNING id, email, name, role, status, created_at as "createdAt"`,
            [email, name, role || 'VIEWER', status || 'ACTIVE']
        );
        return result.rows[0];
    }

    async getUsers() {
        const result = await pool.query(
            'SELECT id, email, name, role, status, created_at as "createdAt" FROM users'
        );
        return result.rows;
    }

    async updateUserStatus(userId: string, status: 'ACTIVE' | 'INACTIVE') {
        const result = await pool.query(
            `UPDATE users SET status = $1 WHERE id = $2 
             RETURNING id, email, name, role, status, created_at as "createdAt"`,
            [status, userId]
        );
        return result.rows[0];
    }

    async updateUserRole(userId: string, role: 'VIEWER' | 'ANALYST' | 'ADMIN') {
        const result = await pool.query(
            `UPDATE users SET role = $1 WHERE id = $2 
             RETURNING id, email, name, role, status, created_at as "createdAt"`,
            [role, userId]
        );
        return result.rows[0];
    }
}