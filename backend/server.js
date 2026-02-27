import dotenv from 'dotenv';
dotenv.config(); // Load env variables FIRST before any other imports

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import cron from 'node-cron';
import { initializeDatabase } from './src/config/database.js';
import { migrate as runMultiTenancyMigration } from './src/migrations/001-multi-tenancy.js';
import { processRecurringInvoices } from './src/utils/recurringInvoices.js';

// Import auth middleware
import { teamAuthMiddleware } from './src/middleware/teamAuth.js';

// Import routes
import authRoutes from './src/routes/auth.js';
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
import shopifyOAuthRoutes from './src/routes/shopify-oauth.js';
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
// Client Portal
import portalRoutes from './src/routes/portal/index.js';
import portalAdminRoutes from './src/routes/portal-admin.js';
// Note sharing (public links)
import noteShareRoutes from './src/routes/note-share.js';
// Real-time Collaboration
import { setupCollaboration } from './src/services/collaborationService.js';
// AI Insights
import { generateAllWeeklyInsights } from './src/services/insightService.js';
// Dashboard Share (public links for dashboards)
import dashboardShareRoutes from './src/routes/dashboard-share.js';
// CRM
import crmRoutes from './src/routes/crm.js';
import screenstudioRoutes from './src/routes/screenstudio.js';

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3000;

console.log('🚀 Starting AgenciaPro backend...');
console.log('📊 Environment:');
console.log('  - PORT:', PORT);
console.log('  - NODE_ENV:', process.env.NODE_ENV || 'not set');

// Middleware
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Health check - MUST BE BEFORE database init so Railway can check health
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'AgenciaPro API is running' });
});

// Configure Socket.io for real-time collaboration
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Setup collaboration service with Socket.io
setupCollaboration(io);

// Start server FIRST, then initialize database
// Listen on 0.0.0.0 so Railway's proxy can reach the app
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 AgenciaPro backend running on port ${PORT}`);
  console.log('✅ Server is listening with WebSocket support');
  console.log('✅ Real-time collaboration enabled');

  // Initialize database after server starts
  initializeDatabase()
    .then(async () => {
      console.log('✅ Database schema ready');
      // Run multi-tenancy migration (idempotent — safe to run multiple times)
      try {
        await runMultiTenancyMigration();
        console.log('✅ Multi-tenancy migration complete - Application fully operational');
      } catch (migrationError) {
        console.error('⚠️  Multi-tenancy migration skipped or failed:', migrationError.message);
        console.log('✅ Application operational (migration may have already run)');
      }
    })
    .catch((error) => {
      console.error('❌ Failed to initialize database:', error);
      // Don't exit - keep server running for debugging
    });
});

// Auth routes (public — no middleware)
app.use('/api/auth', authRoutes);

// Team routes (handles its own auth internally for legacy compat)
app.use('/api/team', teamRoutes);

// All internal routes — protected by teamAuthMiddleware
app.use('/api/clients', teamAuthMiddleware, clientRoutes);
app.use('/api/projects', teamAuthMiddleware, projectRoutes);
app.use('/api/tasks', teamAuthMiddleware, taskRoutes);
app.use('/api/invoices', teamAuthMiddleware, invoiceRoutes);
app.use('/api/expenses', teamAuthMiddleware, expenseRoutes);
app.use('/api/dashboard', teamAuthMiddleware, dashboardRoutes);
// Monday.com style routes
app.use('/api/board-columns', teamAuthMiddleware, boardColumnRoutes);
app.use('/api/task-dependencies', teamAuthMiddleware, taskDependencyRoutes);
app.use('/api/task-comments', teamAuthMiddleware, taskCommentRoutes);
app.use('/api/task-files', teamAuthMiddleware, taskFileRoutes);
app.use('/api/notifications', teamAuthMiddleware, notificationRoutes);
app.use('/api/commissions', teamAuthMiddleware, commissionRoutes);
// ClickUp-style routes
app.use('/api/subtasks', teamAuthMiddleware, subtaskRoutes);
app.use('/api/tags', teamAuthMiddleware, tagRoutes);
app.use('/api/search', teamAuthMiddleware, searchRoutes);
app.use('/api/automations', teamAuthMiddleware, automationRoutes);
app.use('/api/reports', teamAuthMiddleware, reportRoutes);
// Notes (Bloc de notas)
app.use('/api/notes', teamAuthMiddleware, noteRoutes);
app.use('/api/note-categories', teamAuthMiddleware, noteCategoryRoutes);
app.use('/api/note-folders', teamAuthMiddleware, noteFolderRoutes);
// Platform integrations (Facebook Ads & Shopify metrics)
app.use('/api/platform-credentials', teamAuthMiddleware, platformCredentialsRoutes);
app.use('/api/client-metrics', teamAuthMiddleware, clientMetricsRoutes);
// Facebook OAuth: callback must be public (redirect from Facebook has no auth token)
// The callback route uses state parameter for verification instead
app.use('/api/oauth/facebook', (req, res, next) => {
  if (req.path === '/callback') return next();
  teamAuthMiddleware(req, res, next);
}, facebookOAuthRoutes);
// Shopify OAuth: callback + callback-status must be public
// (callback: redirect from Shopify; callback-status: polling from frontend during OAuth)
app.use('/api/oauth/shopify', (req, res, next) => {
  if (req.path === '/callback' || req.path === '/callback-status') return next();
  teamAuthMiddleware(req, res, next);
}, shopifyOAuthRoutes);
// PDF Analysis (RUT extraction with Claude AI)
app.use('/api/pdf', teamAuthMiddleware, pdfAnalysisRoutes);
// SOPs (Standard Operating Procedures)
app.use('/api/sops', teamAuthMiddleware, sopsRoutes);
// Project Templates
app.use('/api/project-templates', teamAuthMiddleware, projectTemplatesRoutes);
// Time Tracking
app.use('/api/time-entries', teamAuthMiddleware, timeEntriesRoutes);
// Siigo Integration
app.use('/api/siigo', teamAuthMiddleware, siigoRoutes);
// Portal admin (internal — needs team auth)
app.use('/api/portal-admin', teamAuthMiddleware, portalAdminRoutes);
// Client Portal (public portal — uses its own clientAuthMiddleware)
app.use('/api/portal', portalRoutes);
// Note sharing (has both authenticated and public routes internally)
app.use('/api/note-share', noteShareRoutes);
// Dashboard share (has both authenticated and public routes internally)
app.use('/api/dashboard-share', dashboardShareRoutes);
// CRM (has both authenticated and webhook routes internally)
app.use('/api/crm', crmRoutes);
// Screen Studio video proxy (no auth needed — public share links)
app.use('/api/screenstudio', screenstudioRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
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

// Setup cron job for weekly AI insights
// Runs every Monday at 7:00 AM
cron.schedule('0 7 * * 1', async () => {
  console.log('⏰ Generating weekly AI insights...');
  try {
    await generateAllWeeklyInsights();
    console.log('✅ Weekly AI insights generated');
  } catch (error) {
    console.error('❌ Error generating insights:', error.message);
  }
}, {
  scheduled: true,
  timezone: "America/Bogota"
});

console.log('✅ Weekly AI insights cron job scheduled (Monday 7:00 AM Colombia time)');
