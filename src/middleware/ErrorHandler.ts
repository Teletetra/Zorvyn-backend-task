import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
    public readonly statusCode: number;
    public readonly code: string;
    public readonly isOperational: boolean;

    constructor(message: string, statusCode: number, code: string, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = isOperational;
        Error.captureStackTrace(this, this.constructor);
    }
}

export class ValidationError extends AppError {
    constructor(message: string, public readonly details?: any) {
        super(message, 400, 'VALIDATION_ERROR');
    }
}

export class NotFoundError extends AppError {
    constructor(resource: string) {
        super(`${resource} not found`, 404, 'RESOURCE_NOT_FOUND');
    }
}

export class UnauthorizedError extends AppError {
    constructor(message = 'Authentication required') {
        super(message, 401, 'UNAUTHORIZED');
    }
}

export class ForbiddenError extends AppError {
    constructor(message = 'Insufficient permissions') {
        super(message, 403, 'FORBIDDEN');
    }
}

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error({
        type: 'ERROR',
        name: err.name,
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        path: req.path,
        method: req.method,
        ip: req.ip,
        timestamp: new Date().toISOString()
    });

    if (err instanceof AppError) {
        return res.status(err.statusCode).json({
            error: err.message,
            code: err.code,
            timestamp: new Date().toISOString(),
            ...(err instanceof ValidationError && err.details ? { details: err.details } : {})
        });
    }

    if (err.name === 'PrismaClientKnownRequestError') {
        if (err.code === 'P2002') {
            return res.status(409).json({
                error: 'Duplicate record',
                code: 'DUPLICATE_RECORD',
                timestamp: new Date().toISOString()
            });
        }
    }

    const isDevelopment = process.env.NODE_ENV === 'development';
    res.status(500).json({
        error: isDevelopment ? err.message : 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR',
        timestamp: new Date().toISOString(),
        ...(isDevelopment ? { stack: err.stack } : {})
    });
};

export const asyncHandler = (fn: Function) => {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};