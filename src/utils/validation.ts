import { z } from 'zod';

const validCategories = ['Rent', 'Groceries', 'Salary', 'Utilities', 'Entertainment', 'Transport', 'Healthcare', 'Education', 'Savings', 'Other'];
const MAX_AMOUNT = 1_000_000;
const MIN_AMOUNT = 0.01;

export const createTransactionSchema = z.object({
    amount: z.number()
        .positive(`Amount must be greater than ${MIN_AMOUNT}`)
        .max(MAX_AMOUNT, `Amount cannot exceed ${MAX_AMOUNT}`)
        .transform(val => Number(val.toFixed(2))),
    type: z.enum(['INCOME', 'EXPENSE'], {
        errorMap: () => ({ message: 'Type must be either INCOME or EXPENSE' })
    }),

    category: z.string()
        .min(1, 'Category is required')
        .max(50, 'Category cannot exceed 50 characters')
        .refine(cat => validCategories.includes(cat), {
            message: `Category must be one of: ${validCategories.join(', ')}`
        }),

    date: z.union([
        z.string().datetime(),
        z.date()
    ]).transform(val => new Date(val))
        .refine(date => date <= new Date(), {
            message: 'Transaction date cannot be in the future'
        })
        .refine(date => date >= new Date('2000-01-01'), {
            message: 'Transaction date cannot be before year 2000'
        }),

    description: z.string()
        .max(500, 'Description cannot exceed 500 characters')
        .optional()
        .transform(val => val?.trim() || undefined)
}).strict();
export const transactionFiltersSchema = z.object({
    startDate: z.string().datetime().optional()
        .transform(val => val ? new Date(val) : undefined),

    endDate: z.string().datetime().optional()
        .transform(val => val ? new Date(val) : undefined),

    category: z.string().optional()
        .refine(cat => !cat || validCategories.includes(cat), {
            message: `Invalid category. Must be one of: ${validCategories.join(', ')}`
        }),

    type: z.enum(['INCOME', 'EXPENSE']).optional(),

    minAmount: z.number().positive().optional()
        .transform(val => Number(val.toFixed(2))),

    maxAmount: z.number().positive().optional()
        .transform(val => Number(val.toFixed(2))),

    limit: z.number().int().min(1).max(100).default(50),

    offset: z.number().int().min(0).default(0),

    sortBy: z.enum(['date', 'amount', 'category']).default('date'),

    sortOrder: z.enum(['asc', 'desc']).default('desc')
}).refine(data => {
    if (data.minAmount && data.maxAmount && data.minAmount > data.maxAmount) {
        return false;
    }
    return true;
}, {
    message: 'minAmount cannot be greater than maxAmount',
    path: ['minAmount']
});

export const formatValidationErrors = (error: z.ZodError) => {
    return error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code
    }));
};

export const validate = (schema: z.ZodSchema) => {
    return async (req: any, res: any, next: any) => {
        try {
            const dataToValidate = req.method === 'GET' ? req.query : req.body;
            const validated = await schema.parseAsync(dataToValidate);
            if (req.method === 'GET') {
                req.validatedQuery = validated;
            } else {
                req.validatedBody = validated;
            }

            next();
        } catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({
                    error: 'Validation Failed',
                    details: formatValidationErrors(error),
                    timestamp: new Date().toISOString()
                });
            }
            next(error);
        }
    };
};