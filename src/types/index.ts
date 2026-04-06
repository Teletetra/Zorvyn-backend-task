// src/types/index.ts
export interface User {
    id: string;
    email: string;
    name: string;
    role: 'VIEWER' | 'ANALYST' | 'ADMIN';
    status: 'ACTIVE' | 'INACTIVE';
}

export interface Transaction {
    id: string;
    amount: number;
    type: 'INCOME' | 'EXPENSE';
    category: string;
    date: Date;
    description?: string;
    userId: string;
}

export interface DashboardSummary {
    totalIncome: number;
    totalExpenses: number;
    netBalance: number;
    categoryTotals: CategoryTotal[];
    recentTransactions: Transaction[];
    monthlyTrends: MonthlyTrend[];
}

export interface CategoryTotal {
    category: string;
    total: number;
    type: 'INCOME' | 'EXPENSE';
}

export interface MonthlyTrend {
    month: string;
    income: number;
    expenses: number;
}