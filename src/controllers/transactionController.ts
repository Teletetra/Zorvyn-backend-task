import { PrismaClient } from '@prisma/client';
import { TransactionFilters } from '../types';
import { EventEmitter } from 'events';

const prisma = new PrismaClient();

const transactionEvents = new EventEmitter();

class BusinessRulesEngine {
    async checkDailyLimit(userId: string, amount: number, type: string): Promise<boolean> {
        if (type !== 'EXPENSE') return true;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todayExpenses = await prisma.transaction.aggregate({
            where: {
                userId,
                type: 'EXPENSE',
                date: { gte: today }
            },
            _sum: { amount: true }
        });

        const dailyTotal = (todayExpenses._sum.amount || 0) + amount;
        const DAILY_LIMIT = 10000
        if (dailyTotal > DAILY_LIMIT) {
            throw new Error(`Daily expense limit of $${DAILY_LIMIT} exceeded`);
        }

        return true;
    }
    async checkCategorySpending(userId: string, category: string, amount: number): Promise<boolean> {
        const monthlyStart = new Date();
        monthlyStart.setDate(1);
        monthlyStart.setHours(0, 0, 0, 0);

        const monthlyTransactions = await prisma.transaction.aggregate({
            where: {
                userId,
                type: 'EXPENSE',
                date: { gte: monthlyStart }
            },
            _sum: { amount: true }
        });

        const categoryTransactions = await prisma.transaction.aggregate({
            where: {
                userId,
                type: 'EXPENSE',
                category,
                date: { gte: monthlyStart }
            },
            _sum: { amount: true }
        });

        const totalMonthlyExpenses = monthlyTransactions._sum.amount || 0;
        const newCategoryTotal = (categoryTransactions._sum.amount || 0) + amount;
        const MAX_CATEGORY_PERCENTAGE = 0.5
        if (totalMonthlyExpenses > 0 && (newCategoryTotal / totalMonthlyExpenses) > MAX_CATEGORY_PERCENTAGE) {
            throw new Error(`Cannot allocate more than ${MAX_CATEGORY_PERCENTAGE * 100}% of monthly expenses to ${category}`);
        }

        return true;
    }
}

const businessRules = new BusinessRulesEngine();

export class TransactionService {
    async createTransaction(userId: string, data: any) {
        await businessRules.checkDailyLimit(userId, data.amount, data.type);
        if (data.type === 'EXPENSE') {
            await businessRules.checkCategorySpending(userId, data.category, data.amount);
        }

        const result = await prisma.$transaction(async (tx) => {
            const transaction = await tx.transaction.create({
                data: {
                    ...data,
                    userId,
                    date: new Date(data.date)
                }
            });

            transactionEvents.emit('transaction.created', {
                userId,
                transaction,
                timestamp: new Date()
            });

            return transaction;
        });

        return result;
    }

    async getTransactions(userId: string, filters: TransactionFilters) {
        const where: any = { userId };

        if (filters.startDate || filters.endDate) {
            where.date = {};
            if (filters.startDate) where.date.gte = filters.startDate;
            if (filters.endDate) where.date.lte = filters.endDate;
        }

        if (filters.category) where.category = filters.category;
        if (filters.type) where.type = filters.type;

        if (filters.minAmount || filters.maxAmount) {
            where.amount = {};
            if (filters.minAmount) where.amount.gte = filters.minAmount;
            if (filters.maxAmount) where.amount.lte = filters.maxAmount;
        }
        const total = await prisma.transaction.count({ where });

        const transactions = await prisma.transaction.findMany({
            where,
            orderBy: { [filters.sortBy]: filters.sortOrder },
            skip: filters.offset,
            take: filters.limit
        });

        return {
            data: transactions,
            pagination: {
                total,
                limit: filters.limit,
                offset: filters.offset,
                hasMore: filters.offset + filters.limit < total
            }
        };
    }
    async bulkCreateTransactions(userId: string, transactions: any[]) {
        const results = await prisma.$transaction(
            transactions.map(tx =>
                prisma.transaction.create({
                    data: { ...tx, userId, date: new Date(tx.date) }
                })
            )
        );

        return results;
    }
    async getSpendingInsights(userId: string) {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const transactions = await prisma.transaction.findMany({
            where: {
                userId,
                date: { gte: thirtyDaysAgo },
                type: 'EXPENSE'
            }
        });

        const categorySpending = new Map();
        transactions.forEach(t => {
            const current = categorySpending.get(t.category) || 0;
            categorySpending.set(t.category, current + t.amount);
        });

        const topCategories = Array.from(categorySpending.entries())
            .map(([category, total]) => ({ category, total }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 5);

        const averageDailySpending = transactions.reduce((sum, t) => sum + t.amount, 0) / 30;

        return {
            topSpendingCategories: topCategories,
            averageDailySpending,
            totalSpending: transactions.reduce((sum, t) => sum + t.amount, 0),
            transactionCount: transactions.length
        };
    }
}