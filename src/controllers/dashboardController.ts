// src/controllers/dashboardController.ts
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { DashboardService } from '../services/transactionService';

const dashboardService = new DashboardService();

export class DashboardController {
    async getSummary(req: AuthRequest, res: Response) {
        try {
            const summary = await dashboardService.getDashboardSummary(req.user!.id);
            res.json(summary);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }
}