import { Request, Response, NextFunction } from 'express';

export interface AuthRequest extends Request {
    user?: {
        id: string;
        email: string;
        role: 'VIEWER' | 'ANALYST' | 'ADMIN';
        status: 'ACTIVE' | 'INACTIVE';
        permissions?: string[];
    };
    requestId: string;
}

class AuditLogger {
    async log(event: {
        action: string;
        userId: string;
        resource: string;
        details?: any;
        ip?: string;
        userAgent?: string;
        success: boolean;
    }) {
        console.log(JSON.stringify({
            timestamp: new Date().toISOString(),
            ...event,
            type: 'AUDIT_LOG'
        }));
    }
}

const auditLogger = new AuditLogger();

const rolePermissions = {
    VIEWER: ['read:transactions', 'read:dashboard'],
    ANALYST: ['read:transactions', 'read:dashboard', 'create:transactions', 'update:transactions'],
    ADMIN: ['read:transactions', 'read:dashboard', 'create:transactions', 'update:transactions', 'delete:transactions', 'manage:users']
}
const generatePermissions = (role: string): string[] => {
    return rolePermissions[role as keyof typeof rolePermissions] || [];
}
const requestCounts = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 100
const RATE_WINDOW = 60000

const checkRateLimit = (userId: string): boolean => {
    const now = Date.now();
    const userLimit = requestCounts.get(userId);

    if (!userLimit || now > userLimit.resetTime) {
        requestCounts.set(userId, { count: 1, resetTime: now + RATE_WINDOW });
        return true;
    }

    if (userLimit.count >= RATE_LIMIT) {
        return false;
    }

    userLimit.count++;
    return true;
}
const mockUsers = new Map([
    ['viewer-1', {
        id: 'viewer-1',
        email: 'sarah.johnson@example.com',
        name: 'Sarah Johnson',
        role: 'VIEWER',
        status: 'ACTIVE',
        department: 'Sales',
        lastLogin: new Date('2024-01-15')
    }],
    ['analyst-1', {
        id: 'analyst-1',
        email: 'mike.chen@example.com',
        name: 'Mike Chen',
        role: 'ANALYST',
        status: 'ACTIVE',
        department: 'Finance',
        lastLogin: new Date('2024-01-16')
    }],
    ['admin-1', {
        id: 'admin-1',
        email: 'jessica.williams@example.com',
        name: 'Jessica Williams',
        role: 'ADMIN',
        status: 'ACTIVE',
        department: 'IT',
        lastLogin: new Date('2024-01-16')
    }],
    ['inactive-user', {
        id: 'inactive-user',
        email: 'inactive@example.com',
        name: 'Inactive User',
        role: 'VIEWER',
        status: 'INACTIVE',
        department: 'Unknown',
        lastLogin: new Date('2023-12-01')
    }]
]);

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
    req.requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const token = req.headers['authorization']?.replace('Bearer ', '') ||
        req.headers['x-api-key'] as string ||
        req.headers['x-user-id'] as string;

    if (!token) {
        await auditLogger.log({
            action: 'AUTH_FAILURE',
            userId: 'unknown',
            resource: req.path,
            details: { reason: 'No authentication token provided' },
            ip: req.ip,
            userAgent: req.get('user-agent'),
            success: false
        });

        return res.status(401).json({
            error: 'Authentication required',
            code: 'MISSING_CREDENTIALS',
            requestId: req.requestId,
            timestamp: new Date().toISOString()
        });
    }
    if (!checkRateLimit(token)) {
        return res.status(429).json({
            error: 'Too many requests',
            code: 'RATE_LIMIT_EXCEEDED',
            requestId: req.requestId,
            retryAfter: 60,
            timestamp: new Date().toISOString()
        });
    }

    const user = mockUsers.get(token);

    if (!user) {
        await auditLogger.log({
            action: 'AUTH_FAILURE',
            userId: token,
            resource: req.path,
            details: { reason: 'Invalid user' },
            ip: req.ip,
            userAgent: req.get('user-agent'),
            success: false
        });

        return res.status(401).json({
            error: 'Invalid credentials',
            code: 'INVALID_CREDENTIALS',
            requestId: req.requestId,
            timestamp: new Date().toISOString()
        });
    }

    if (user.status !== 'ACTIVE') {
        await auditLogger.log({
            action: 'AUTH_FAILURE',
            userId: user.id,
            resource: req.path,
            details: { reason: 'Account inactive', status: user.status },
            ip: req.ip,
            userAgent: req.get('user-agent'),
            success: false
        });

        return res.status(403).json({
            error: 'Account is inactive',
            code: 'ACCOUNT_INACTIVE',
            requestId: req.requestId,
            timestamp: new Date().toISOString()
        });
    }
    req.user = {
        ...user,
        permissions: generatePermissions(user.role)
    };
    if (process.env.NODE_ENV === 'development') {
        await auditLogger.log({
            action: 'AUTH_SUCCESS',
            userId: user.id,
            resource: req.path,
            details: { role: user.role },
            ip: req.ip,
            userAgent: req.get('user-agent'),
            success: true
        });
    }

    next();
};
export const requirePermission = (permission: string) => {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Authentication required',
                requestId: req.requestId
            });
        }

        if (!req.user.permissions?.includes(permission)) {
            await auditLogger.log({
                action: 'PERMISSION_DENIED',
                userId: req.user.id,
                resource: req.path,
                details: {
                    requiredPermission: permission,
                    userRole: req.user.role,
                    userPermissions: req.user.permissions
                },
                ip: req.ip,
                userAgent: req.get('user-agent'),
                success: false
            });

            return res.status(403).json({
                error: 'Insufficient permissions',
                code: 'PERMISSION_DENIED',
                requiredPermission: permission,
                requestId: req.requestId,
                timestamp: new Date().toISOString()
            });
        }

        next()
    }
}
export const requireOwnership = (resourceType: string, getResourceUserId: (req: AuthRequest) => Promise<string | null>) => {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        } if (req.user.role === 'ADMIN') {
            return next();
        }

        const resourceUserId = await getResourceUserId(req);

        if (!resourceUserId) {
            return res.status(404).json({ error: `${resourceType} not found` });
        }

        if (resourceUserId !== req.user.id) {
            await auditLogger.log({
                action: 'OWNERSHIP_VIOLATION',
                userId: req.user.id,
                resource: `${resourceType}:${req.params.id}`,
                details: { attemptedAccessTo: resourceUserId },
                ip: req.ip,
                userAgent: req.get('user-agent'),
                success: false
            });

            return res.status(403).json({
                error: 'You can only access your own resources',
                code: 'ACCESS_DENIED',
                requestId: req.requestId
            });
        }

        next();
    };
};