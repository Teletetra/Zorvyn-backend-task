// src/routes/index.ts
import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { validate, createTransactionSchema, updateTransactionSchema, createUserSchema } from '../utils/validation';
import { TransactionController } from '../controllers/transactionController';
import { DashboardController } from '../controllers/dashboardController';
import { UserController } from '../controllers/userController';

const router = Router();
const transactionController = new TransactionController();
const dashboardController = new DashboardController();
const userController = new UserController();

// Apply authentication to all routes
router.use(authenticate);

// Dashboard routes (accessible by VIEWER, ANALYST, ADMIN)
router.get('/dashboard/summary',
    requireRole(['VIEWER', 'ANALYST', 'ADMIN']),
    dashboardController.getSummary
);

// Transaction routes
router.post('/transactions',
    requireRole(['ANALYST', 'ADMIN']),
    validate(createTransactionSchema),
    transactionController.create
);

router.get('/transactions',
    requireRole(['VIEWER', 'ANALYST', 'ADMIN']),
    transactionController.list
);

router.get('/transactions/:id',
    requireRole(['VIEWER', 'ANALYST', 'ADMIN']),
    transactionController.getOne
);

router.put('/transactions/:id',
    requireRole(['ANALYST', 'ADMIN']),
    validate(updateTransactionSchema),
    transactionController.update
);

router.delete('/transactions/:id',
    requireRole(['ADMIN']),
    transactionController.delete
);

// User management routes (ADMIN only)
router.post('/users',
    requireRole(['ADMIN']),
    validate(createUserSchema),
    userController.createUser
);

router.get('/users',
    requireRole(['ADMIN']),
    userController.listUsers
);

router.patch('/users/:id/status',
    requireRole(['ADMIN']),
    userController.updateUserStatus
);

router.patch('/users/:id/role',
    requireRole(['ADMIN']),
    userController.updateUserRole
);

export default router;