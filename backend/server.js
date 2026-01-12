import dotenv from 'dotenv';
dotenv.config(); // Load env variables FIRST before any other imports

import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { initializeDatabase } from './src/config/database.js';
import { processRecurringInvoices } from './src/utils/recurringInvoices.js';

// Import routes
import clientRoutes from './src/routes/clients.js';
import projectRoutes from './src/routes/projects.js';
import taskRoutes from './src/routes/tasks.js';
import teamRoutes from './src/routes/team.js';
import invoiceRoutes from './src/routes/invoices.js';
import expenseRoutes from './src/routes/expenses.js';
import dashboardRoutes from './src/routes/dashboard.js';
// Monday.com style routes
import boardColumnRoutes from './src/routes/board-columns.js';
import taskDependencyRoutes from './src/routes/task-dependencies.js';
import taskCommentRoutes from './src/routes/task-comments.js';
import taskFileRoutes from './src/routes/task-files.js';
import notificationRoutes from './src/routes/notifications.js';
import commissionRoutes from './src/routes/commissions.js';
// ClickUp-style features
import subtaskRoutes from './src/routes/subtasks.js';
import tagRoutes from './src/routes/tags.js';
import searchRoutes from './src/routes/search.js';
import automationRoutes from './src/routes/automations.js';
import reportRoutes from './src/routes/reports.js';
import noteRoutes from './src/routes/notes.js';
import noteCategoryRoutes from './src/routes/note-categories.js';
import noteFolderRoutes from './src/routes/note-folders.js';
import { checkDueDateAutomations } from './src/services/automationEngine.js';
// Platform integrations (Facebook Ads & Shopify)
import platformCredentialsRoutes from './src/routes/platform-credentials.js';
import clientMetricsRoutes from './src/routes/client-metrics.js';
import facebookOAuthRoutes from './src/routes/facebook-oauth.js';
import { syncAllClientsForDate } from './src/services/metricsSyncService.js';
// PDF Analysis (RUT extraction with Claude AI)
import pdfAnalysisRoutes from './src/routes/pdf-analysis.js';
// SOPs (Standard Operating Procedures)
import sopsRoutes from './src/routes/sops.js';
// Project Templates
import projectTemplatesRoutes from './src/routes/projectTemplates.js';
// Time Tracking
import timeEntriesRoutes from './src/routes/time-entries.js';
// Siigo Integration
import siigoRoutes from './src/routes/siigo.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database
initializeDatabase();

// Routes
app.use('/api/clients', clientRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/dashboard', dashboardRoutes);
// Monday.com style routes
app.use('/api/board-columns', boardColumnRoutes);
app.use('/api/task-dependencies', taskDependencyRoutes);
app.use('/api/task-comments', taskCommentRoutes);
app.use('/api/task-files', taskFileRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/commissions', commissionRoutes);
// ClickUp-style routes
app.use('/api/subtasks', subtaskRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/automations', automationRoutes);
app.use('/api/reports', reportRoutes);
// Notes (Bloc de notas)
app.use('/api/notes', noteRoutes);
app.use('/api/note-categories', noteCategoryRoutes);
app.use('/api/note-folders', noteFolderRoutes);
// Platform integrations (Facebook Ads & Shopify metrics)
app.use('/api/platform-credentials', platformCredentialsRoutes);
app.use('/api/client-metrics', clientMetricsRoutes);
app.use('/api/oauth/facebook', facebookOAuthRoutes);
// PDF Analysis (RUT extraction with Claude AI)
app.use('/api/pdf', pdfAnalysisRoutes);
// SOPs (Standard Operating Procedures)
app.use('/api/sops', sopsRoutes);
// Project Templates
app.use('/api/project-templates', projectTemplatesRoutes);
// Time Tracking
app.use('/api/time-entries', timeEntriesRoutes);
// Siigo Integration
app.use('/api/siigo', siigoRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'AgenciaPro API is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 AgenciaPro backend running on http://localhost:${PORT}`);
});

// Setup cron job for recurring invoices
// Runs every day at 00:01 AM (1 minute past midnight)
cron.schedule('1 0 * * *', () => {
  console.log('⏰ Running daily recurring invoices cron job...');
  processRecurringInvoices();
}, {
  scheduled: true,
  timezone: "America/Bogota" // Colombian timezone
});

console.log('✅ Recurring invoices cron job scheduled (daily at 00:01 AM Colombia time)');

// Setup cron job for due date approaching automations
// Runs every day at 8:00 AM
cron.schedule('0 8 * * *', () => {
  console.log('⏰ Running due date automations check...');
  checkDueDateAutomations();
}, {
  scheduled: true,
  timezone: "America/Bogota"
});

console.log('✅ Due date automations cron job scheduled (daily at 8:00 AM Colombia time)');

// Setup cron job for metrics sync (Facebook Ads & Shopify)
// Runs every day at 2:00 AM to sync yesterday's metrics
cron.schedule('0 2 * * *', async () => {
  console.log('⏰ Running daily metrics sync (Facebook Ads & Shopify)...');
  try {
    await syncAllClientsForDate();
    console.log('✅ Daily metrics sync completed');
  } catch (error) {
    console.error('❌ Error in metrics sync:', error.message);
  }
}, {
  scheduled: true,
  timezone: "America/Bogota"
});

console.log('✅ Metrics sync cron job scheduled (daily at 2:00 AM Colombia time)');
