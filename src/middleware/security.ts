import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';

export const securityHeaders = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    },
    frameguard: {
        action: 'deny'
    },
    noSniff: true,
    referrerPolicy: {
        policy: 'strict-origin-when-cross-origin'
    }
});

export const globalRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: {
        error: 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: 15 * 60
    },
    standardHeaders: true,
    legacyHeaders: false,
});

export const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    skipSuccessfulRequests: true,
    message: {
        error: 'Too many authentication attempts',
        code: 'AUTH_RATE_LIMIT_EXCEEDED',
        retryAfter: 15 * 60
    }
});

export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
    const sanitizeObject = (obj: any) => {
        if (!obj) return obj;

        Object.keys(obj).forEach(key => {
            if (typeof obj[key] === 'string') {
                obj[key] = obj[key]
                    .replace(/<[^>]*>/g, '')
                    .replace(/javascript:/gi, '')
                    .trim();
            } else if (typeof obj[key] === 'object') {
                sanitizeObject(obj[key]);
            }
        });
    };

    if (req.body) sanitizeObject(req.body);
    if (req.query) sanitizeObject(req.query);
    if (req.params) sanitizeObject(req.params);

    next();
};
export const corsOptions = {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3001'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-User-Id'],
    exposedHeaders: ['X-Total-Count', 'X-Rate-Limit-Remaining'],
    credentials: true,
    maxAge: 86400
};