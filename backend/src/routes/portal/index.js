import express from 'express';
import authRoutes from './auth.js';
import dashboardRoutes from './dashboard.js';
import projectsRoutes from './projects.js';
import tasksRoutes from './tasks.js';
import invoicesRoutes from './invoices.js';
import metricsRoutes from './metrics.js';
import notificationsRoutes from './notifications.js';
import formsRoutes from './forms.js';

const router = express.Router();

// Portal routes
router.use('/auth', authRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/projects', projectsRoutes);
router.use('/tasks', tasksRoutes);
router.use('/invoices', invoicesRoutes);
router.use('/metrics', metricsRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/forms', formsRoutes);

export default router;
