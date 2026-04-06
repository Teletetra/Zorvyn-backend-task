// src/controllers/userController.ts
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { UserService } from '../services/transactionService';

const userService = new UserService();

export class UserController {
    async createUser(req: AuthRequest, res: Response) {
        try {
            const user = await userService.createUser(req.body);
            res.status(201).json(user);
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    }

    async listUsers(req: AuthRequest, res: Response) {
        try {
            const users = await userService.getUsers();
            res.json(users);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    async updateUserStatus(req: AuthRequest, res: Response) {
        try {
            const { status } = req.body;
            if (!['ACTIVE', 'INACTIVE'].includes(status)) {
                return res.status(400).json({ error: 'Invalid status' });
            }

            const user = await userService.updateUserStatus(req.params.id, status);
            res.json(user);
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    }

    async updateUserRole(req: AuthRequest, res: Response) {
        try {
            const { role } = req.body;
            if (!['VIEWER', 'ANALYST', 'ADMIN'].includes(role)) {
                return res.status(400).json({ error: 'Invalid role' });
            }

            const user = await userService.updateUserRole(req.params.id, role);
            res.json(user);
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    }
}