import express from 'express';
import db from '../config/database.js';
import ZernioIntegration from '../integrations/zernio.js';

const router = express.Router();

// Helper to get Zernio instance
async function getZernioInstance() {
  const settings = await db.prepare(`
    SELECT * FROM zernio_settings
    WHERE is_active = 1
    ORDER BY id DESC LIMIT 1
  `).get();

  if (!settings || !settings.api_key) {
    return null;
  }

  return new ZernioIntegration(settings.api_key);
}

// Middleware to require Zernio connection
async function requireZernio(req, res, next) {
  try {
    const zernio = await getZernioInstance();
    if (!zernio) {
      return res.status(400).json({
        error: 'Zernio not configured',
        code: 'ZERNIO_NOT_CONFIGURED'
      });
    }
    req.zernio = zernio;
    next();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// ==================== SETTINGS ====================

// Get Zernio settings (without API key)
router.get('/settings', async (req, res) => {
  try {
    const settings = await db.prepare(`
      SELECT id, is_active, last_sync_at, last_error, created_at, updated_at,
             CASE WHEN api_key IS NOT NULL AND api_key != '' THEN 1 ELSE 0 END as is_configured
      FROM zernio_settings
      WHERE is_active = 1
      ORDER BY id DESC LIMIT 1
    `).get();

    res.json(settings || { is_configured: false });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save Zernio API key
router.post('/settings', async (req, res) => {
  try {
    const { api_key } = req.body;

    if (!api_key) {
      return res.status(400).json({ error: 'API key is required' });
    }

    // Test the API key first
    const zernio = new ZernioIntegration(api_key);
    const testResult = await zernio.testConnection();

    if (!testResult.success) {
      return res.status(400).json({
        error: `Invalid API key: ${testResult.error}`
      });
    }

    // Deactivate any existing settings
    await db.prepare('UPDATE zernio_settings SET is_active = 0').run();

    // Insert new settings
    const result = await db.prepare(`
      INSERT INTO zernio_settings (api_key, is_active, last_sync_at, created_at, updated_at)
      VALUES (?, 1, datetime('now'), datetime('now'), datetime('now'))
    `).run(api_key);

    res.json({
      success: true,
      message: 'Zernio API key saved and verified',
      settingsId: result.lastInsertRowid,
      accounts: testResult.accounts
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test Zernio connection
router.post('/test', async (req, res) => {
  try {
    const zernio = await getZernioInstance();
    if (!zernio) {
      return res.json({ success: false, error: 'Zernio not configured' });
    }

    const result = await zernio.testConnection();

    // Update last_sync_at and last_error
    if (result.success) {
      await db.prepare(`
        UPDATE zernio_settings SET last_sync_at = datetime('now'), last_error = NULL, updated_at = datetime('now')
        WHERE is_active = 1
      `).run();
    } else {
      await db.prepare(`
        UPDATE zernio_settings SET last_error = ?, updated_at = datetime('now')
        WHERE is_active = 1
      `).run(result.error);
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Disconnect Zernio
router.delete('/settings', async (req, res) => {
  try {
    await db.prepare('UPDATE zernio_settings SET is_active = 0, updated_at = datetime("now")').run();
    res.json({ success: true, message: 'Zernio disconnected' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== ACCOUNTS ====================

// List connected accounts
router.get('/accounts', requireZernio, async (req, res) => {
  try {
    const { platform } = req.query;
    const accounts = await req.zernio.listAccounts(platform);
    res.json(accounts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get account health
router.get('/accounts/health', requireZernio, async (req, res) => {
  try {
    const { accountId } = req.query;
    const health = await req.zernio.getAccountHealth(accountId);
    res.json(health);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get follower stats for an account
router.get('/accounts/:accountId/followers', requireZernio, async (req, res) => {
  try {
    const stats = await req.zernio.getFollowerStats(req.params.accountId);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== ANALYTICS ====================

// Get post analytics
router.get('/analytics/posts', requireZernio, async (req, res) => {
  try {
    const { accountId, postId, dateFrom, dateTo, platform } = req.query;
    const analytics = await req.zernio.getPostAnalytics(accountId, { postId, dateFrom, dateTo, platform });
    res.json(analytics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get follower analytics
router.get('/analytics/followers', requireZernio, async (req, res) => {
  try {
    const { accountId, dateFrom, dateTo } = req.query;
    const analytics = await req.zernio.getFollowerAnalytics(accountId, dateFrom, dateTo);
    res.json(analytics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get daily metrics
router.get('/analytics/daily', requireZernio, async (req, res) => {
  try {
    const { accountId, dateFrom, dateTo } = req.query;
    const metrics = await req.zernio.getDailyMetrics(accountId, dateFrom, dateTo);
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get best times to post
router.get('/analytics/best-times', requireZernio, async (req, res) => {
  try {
    const { accountId, platform } = req.query;
    const times = await req.zernio.getBestTimesToPost(accountId, platform);
    res.json(times);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Instagram insights
router.get('/analytics/instagram', requireZernio, async (req, res) => {
  try {
    const { accountId, dateFrom, dateTo } = req.query;
    const insights = await req.zernio.getInstagramInsights(accountId, dateFrom, dateTo);
    res.json(insights);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== POSTS ====================

// List posts
router.get('/posts', requireZernio, async (req, res) => {
  try {
    const { accountId, status, dateFrom, dateTo, limit } = req.query;
    const posts = await req.zernio.listPosts({ accountId, status, dateFrom, dateTo, limit });
    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get post queue
router.get('/posts/queue', requireZernio, async (req, res) => {
  try {
    const { accountId, limit } = req.query;
    const queue = await req.zernio.getPostQueue(accountId, limit);
    res.json(queue);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get a single post
router.get('/posts/:postId', requireZernio, async (req, res) => {
  try {
    const post = await req.zernio.getPost(req.params.postId);
    res.json(post);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a post
router.post('/posts', requireZernio, async (req, res) => {
  try {
    const post = await req.zernio.createPost(req.body);
    res.json(post);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update a post
router.put('/posts/:postId', requireZernio, async (req, res) => {
  try {
    const post = await req.zernio.updatePost(req.params.postId, req.body);
    res.json(post);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a post
router.delete('/posts/:postId', requireZernio, async (req, res) => {
  try {
    const result = await req.zernio.deletePost(req.params.postId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Publish a post now
router.post('/posts/:postId/publish', requireZernio, async (req, res) => {
  try {
    const result = await req.zernio.publishPostNow(req.params.postId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== COMMENTS ====================

// List posts with comments
router.get('/comments/posts', requireZernio, async (req, res) => {
  try {
    const { accountId, platform, minComments, sortBy, limit } = req.query;
    const posts = await req.zernio.listCommentedPosts({ accountId, platform, minComments, sortBy, limit });
    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get comments for a post
router.get('/posts/:postId/comments', requireZernio, async (req, res) => {
  try {
    const { accountId } = req.query;
    const comments = await req.zernio.getPostComments(req.params.postId, accountId);
    res.json(comments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reply to a comment
router.post('/comments/:commentId/reply', requireZernio, async (req, res) => {
  try {
    const { accountId, message } = req.body;
    const result = await req.zernio.replyToComment(req.params.commentId, accountId, message);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Like a comment
router.post('/comments/:commentId/like', requireZernio, async (req, res) => {
  try {
    const { accountId } = req.body;
    const result = await req.zernio.likeComment(req.params.commentId, accountId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Hide a comment
router.post('/comments/:commentId/hide', requireZernio, async (req, res) => {
  try {
    const { accountId } = req.body;
    const result = await req.zernio.hideComment(req.params.commentId, accountId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a comment
router.delete('/comments/:commentId', requireZernio, async (req, res) => {
  try {
    const { accountId } = req.query;
    const result = await req.zernio.deleteComment(req.params.commentId, accountId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== CONVERSATIONS (INBOX) ====================

// List conversations
router.get('/conversations', requireZernio, async (req, res) => {
  try {
    const { accountId, platform, limit } = req.query;
    const conversations = await req.zernio.listConversations({ accountId, platform, limit });
    res.json(conversations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get a conversation
router.get('/conversations/:conversationId', requireZernio, async (req, res) => {
  try {
    const conversation = await req.zernio.getConversation(req.params.conversationId);
    res.json(conversation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get messages in a conversation
router.get('/conversations/:conversationId/messages', requireZernio, async (req, res) => {
  try {
    const { limit } = req.query;
    const messages = await req.zernio.getConversationMessages(req.params.conversationId, limit);
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send a message
router.post('/conversations/:conversationId/messages', requireZernio, async (req, res) => {
  try {
    const { accountId, message } = req.body;
    const result = await req.zernio.sendMessage(req.params.conversationId, accountId, message);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update conversation status
router.patch('/conversations/:conversationId/status', requireZernio, async (req, res) => {
  try {
    const { status } = req.body;
    const result = await req.zernio.updateConversationStatus(req.params.conversationId, status);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== AUTOMATIONS ====================

// List automations
router.get('/automations', requireZernio, async (req, res) => {
  try {
    const { accountId, status } = req.query;
    const automations = await req.zernio.listAutomations({ accountId, status });
    res.json(automations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get an automation
router.get('/automations/:automationId', requireZernio, async (req, res) => {
  try {
    const automation = await req.zernio.getAutomation(req.params.automationId);
    res.json(automation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create an automation
router.post('/automations', requireZernio, async (req, res) => {
  try {
    const automation = await req.zernio.createAutomation(req.body);
    res.json(automation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update an automation
router.put('/automations/:automationId', requireZernio, async (req, res) => {
  try {
    const automation = await req.zernio.updateAutomation(req.params.automationId, req.body);
    res.json(automation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete an automation
router.delete('/automations/:automationId', requireZernio, async (req, res) => {
  try {
    const result = await req.zernio.deleteAutomation(req.params.automationId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get automation logs
router.get('/automations/:automationId/logs', requireZernio, async (req, res) => {
  try {
    const { limit } = req.query;
    const logs = await req.zernio.getAutomationLogs(req.params.automationId, limit);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== MEDIA ====================

// Upload media
router.post('/media', requireZernio, async (req, res) => {
  try {
    const { url, type, altText } = req.body;
    const media = await req.zernio.uploadMedia(url, type, altText);
    res.json(media);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List media
router.get('/media', requireZernio, async (req, res) => {
  try {
    const { type, limit } = req.query;
    const media = await req.zernio.listMedia({ type, limit });
    res.json(media);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete media
router.delete('/media/:mediaId', requireZernio, async (req, res) => {
  try {
    const result = await req.zernio.deleteMedia(req.params.mediaId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
