import { Router } from 'express';
import { pool } from '../db.js';
import { getDashboardSummary } from '../services/dashboardService.js';

export const dashboardRouter = Router();

dashboardRouter.get('/summary', async (req, res, next) => {
  try {
    const summary = await getDashboardSummary(pool);
    res.json(summary);
  } catch (err) {
    next(err);
  }
});
