import axios from 'axios';

const ZERNIO_API_URL = 'https://zernio.com/api/v1';

/**
 * Zernio Integration
 * Connects to Zernio API for social media management
 * Supports Instagram, TikTok, Facebook, LinkedIn, Twitter, and more
 */
class ZernioIntegration {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.client = axios.create({
      baseURL: ZERNIO_API_URL,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Test connection to Zernio API
   * @returns {Promise<{success: boolean, accounts?: Array, error?: string}>}
   */
  async testConnection() {
    try {
      const response = await this.client.get('/accounts');

      if (response.data && Array.isArray(response.data)) {
        return {
          success: true,
          accounts: response.data,
          accountCount: response.data.length
        };
      }

      return { success: false, error: 'No se pudo obtener información de las cuentas' };
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message;
      return { success: false, error: errorMessage };
    }
  }

  // ==================== ACCOUNTS ====================

  /**
   * List all connected social media accounts
   * @param {string} platform - Optional filter by platform
   * @returns {Promise<Array>}
   */
  async listAccounts(platform = null) {
    try {
      const params = platform ? { platform } : {};
      const response = await this.client.get('/accounts', { params });
      return response.data || [];
    } catch (error) {
      console.error('Error listing Zernio accounts:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get follower stats for an account
   * @param {string} accountId
   * @returns {Promise<Object>}
   */
  async getFollowerStats(accountId) {
    try {
      const response = await this.client.get(`/accounts/${accountId}/followers`);
      return response.data;
    } catch (error) {
      console.error('Error getting follower stats:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get account health/connection status
   * @param {string} accountId - Optional specific account
   * @returns {Promise<Object>}
   */
  async getAccountHealth(accountId = null) {
    try {
      const url = accountId ? `/accounts/${accountId}/health` : '/accounts/health';
      const response = await this.client.get(url);
      return response.data;
    } catch (error) {
      console.error('Error getting account health:', error.response?.data || error.message);
      throw error;
    }
  }

  // ==================== ANALYTICS ====================

  /**
   * Get post analytics
   * @param {string} accountId
   * @param {Object} options - { postId, dateFrom, dateTo, platform }
   * @returns {Promise<Object>}
   */
  async getPostAnalytics(accountId, options = {}) {
    try {
      const params = {
        accountId,
        ...options
      };
      const response = await this.client.get('/analytics/posts', { params });
      return response.data;
    } catch (error) {
      console.error('Error getting post analytics:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get follower growth analytics
   * @param {string} accountId
   * @param {string} dateFrom
   * @param {string} dateTo
   * @returns {Promise<Object>}
   */
  async getFollowerAnalytics(accountId, dateFrom, dateTo) {
    try {
      const response = await this.client.get('/analytics/followers', {
        params: { accountId, dateFrom, dateTo }
      });
      return response.data;
    } catch (error) {
      console.error('Error getting follower analytics:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get daily metrics
   * @param {string} accountId
   * @param {string} dateFrom
   * @param {string} dateTo
   * @returns {Promise<Object>}
   */
  async getDailyMetrics(accountId, dateFrom, dateTo) {
    try {
      const response = await this.client.get('/analytics/daily', {
        params: { accountId, dateFrom, dateTo }
      });
      return response.data;
    } catch (error) {
      console.error('Error getting daily metrics:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get best times to post
   * @param {string} accountId
   * @param {string} platform
   * @returns {Promise<Object>}
   */
  async getBestTimesToPost(accountId, platform) {
    try {
      const response = await this.client.get('/analytics/best-times', {
        params: { accountId, platform }
      });
      return response.data;
    } catch (error) {
      console.error('Error getting best times to post:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get Instagram-specific insights
   * @param {string} accountId
   * @param {string} dateFrom
   * @param {string} dateTo
   * @returns {Promise<Object>}
   */
  async getInstagramInsights(accountId, dateFrom, dateTo) {
    try {
      const response = await this.client.get('/analytics/instagram', {
        params: { accountId, dateFrom, dateTo }
      });
      return response.data;
    } catch (error) {
      console.error('Error getting Instagram insights:', error.response?.data || error.message);
      throw error;
    }
  }

  // ==================== POSTS ====================

  /**
   * List posts
   * @param {Object} options - { accountId, status, dateFrom, dateTo, limit }
   * @returns {Promise<Array>}
   */
  async listPosts(options = {}) {
    try {
      const response = await this.client.get('/posts', { params: options });
      return response.data || [];
    } catch (error) {
      console.error('Error listing posts:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get post queue (scheduled posts)
   * @param {string} accountId
   * @param {number} limit
   * @returns {Promise<Array>}
   */
  async getPostQueue(accountId, limit = 20) {
    try {
      const response = await this.client.get('/posts/queue', {
        params: { accountId, limit }
      });
      return response.data || [];
    } catch (error) {
      console.error('Error getting post queue:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get a single post
   * @param {string} postId
   * @returns {Promise<Object>}
   */
  async getPost(postId) {
    try {
      const response = await this.client.get(`/posts/${postId}`);
      return response.data;
    } catch (error) {
      console.error('Error getting post:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Create a new post
   * @param {Object} postData - { content, platforms, mediaItems, scheduledFor, isDraft, etc. }
   * @returns {Promise<Object>}
   */
  async createPost(postData) {
    try {
      const response = await this.client.post('/posts', postData);
      return response.data;
    } catch (error) {
      console.error('Error creating post:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Update a post
   * @param {string} postId
   * @param {Object} postData
   * @returns {Promise<Object>}
   */
  async updatePost(postId, postData) {
    try {
      const response = await this.client.put(`/posts/${postId}`, postData);
      return response.data;
    } catch (error) {
      console.error('Error updating post:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Delete a post
   * @param {string} postId
   * @returns {Promise<Object>}
   */
  async deletePost(postId) {
    try {
      const response = await this.client.delete(`/posts/${postId}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting post:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Publish a post immediately
   * @param {string} postId
   * @returns {Promise<Object>}
   */
  async publishPostNow(postId) {
    try {
      const response = await this.client.post(`/posts/${postId}/publish`);
      return response.data;
    } catch (error) {
      console.error('Error publishing post:', error.response?.data || error.message);
      throw error;
    }
  }

  // ==================== COMMENTS ====================

  /**
   * List posts with comments
   * @param {Object} options - { accountId, platform, minComments, sortBy, limit }
   * @returns {Promise<Array>}
   */
  async listCommentedPosts(options = {}) {
    try {
      const response = await this.client.get('/comments/posts', { params: options });
      return response.data || [];
    } catch (error) {
      console.error('Error listing commented posts:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get comments for a specific post
   * @param {string} postId
   * @param {string} accountId
   * @returns {Promise<Array>}
   */
  async getPostComments(postId, accountId) {
    try {
      const response = await this.client.get(`/posts/${postId}/comments`, {
        params: { accountId }
      });
      return response.data || [];
    } catch (error) {
      console.error('Error getting post comments:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Reply to a comment
   * @param {string} commentId
   * @param {string} accountId
   * @param {string} message
   * @returns {Promise<Object>}
   */
  async replyToComment(commentId, accountId, message) {
    try {
      const response = await this.client.post(`/comments/${commentId}/reply`, {
        accountId,
        message
      });
      return response.data;
    } catch (error) {
      console.error('Error replying to comment:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Like a comment
   * @param {string} commentId
   * @param {string} accountId
   * @returns {Promise<Object>}
   */
  async likeComment(commentId, accountId) {
    try {
      const response = await this.client.post(`/comments/${commentId}/like`, { accountId });
      return response.data;
    } catch (error) {
      console.error('Error liking comment:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Hide a comment
   * @param {string} commentId
   * @param {string} accountId
   * @returns {Promise<Object>}
   */
  async hideComment(commentId, accountId) {
    try {
      const response = await this.client.post(`/comments/${commentId}/hide`, { accountId });
      return response.data;
    } catch (error) {
      console.error('Error hiding comment:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Delete a comment
   * @param {string} commentId
   * @param {string} accountId
   * @returns {Promise<Object>}
   */
  async deleteComment(commentId, accountId) {
    try {
      const response = await this.client.delete(`/comments/${commentId}`, {
        params: { accountId }
      });
      return response.data;
    } catch (error) {
      console.error('Error deleting comment:', error.response?.data || error.message);
      throw error;
    }
  }

  // ==================== CONVERSATIONS (INBOX) ====================

  /**
   * List DM conversations
   * @param {Object} options - { accountId, platform, limit }
   * @returns {Promise<Array>}
   */
  async listConversations(options = {}) {
    try {
      const response = await this.client.get('/conversations', { params: options });
      return response.data || [];
    } catch (error) {
      console.error('Error listing conversations:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get a conversation
   * @param {string} conversationId
   * @returns {Promise<Object>}
   */
  async getConversation(conversationId) {
    try {
      const response = await this.client.get(`/conversations/${conversationId}`);
      return response.data;
    } catch (error) {
      console.error('Error getting conversation:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get messages in a conversation
   * @param {string} conversationId
   * @param {number} limit
   * @returns {Promise<Array>}
   */
  async getConversationMessages(conversationId, limit = 50) {
    try {
      const response = await this.client.get(`/conversations/${conversationId}/messages`, {
        params: { limit }
      });
      return response.data || [];
    } catch (error) {
      console.error('Error getting conversation messages:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Send a message in a conversation
   * @param {string} conversationId
   * @param {string} accountId
   * @param {string} message
   * @returns {Promise<Object>}
   */
  async sendMessage(conversationId, accountId, message) {
    try {
      const response = await this.client.post(`/conversations/${conversationId}/messages`, {
        accountId,
        message
      });
      return response.data;
    } catch (error) {
      console.error('Error sending message:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Update conversation status (read, archived, etc.)
   * @param {string} conversationId
   * @param {string} status - 'read', 'unread', 'archived', 'unarchived'
   * @returns {Promise<Object>}
   */
  async updateConversationStatus(conversationId, status) {
    try {
      const response = await this.client.patch(`/conversations/${conversationId}/status`, { status });
      return response.data;
    } catch (error) {
      console.error('Error updating conversation status:', error.response?.data || error.message);
      throw error;
    }
  }

  // ==================== AUTOMATIONS ====================

  /**
   * List automations
   * @param {Object} options - { accountId, status }
   * @returns {Promise<Array>}
   */
  async listAutomations(options = {}) {
    try {
      const response = await this.client.get('/automations', { params: options });
      return response.data || [];
    } catch (error) {
      console.error('Error listing automations:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get automation details
   * @param {string} automationId
   * @returns {Promise<Object>}
   */
  async getAutomation(automationId) {
    try {
      const response = await this.client.get(`/automations/${automationId}`);
      return response.data;
    } catch (error) {
      console.error('Error getting automation:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Create an automation
   * @param {Object} automationData - { accountId, name, triggerKeywords, replyMessage, isActive }
   * @returns {Promise<Object>}
   */
  async createAutomation(automationData) {
    try {
      const response = await this.client.post('/automations', automationData);
      return response.data;
    } catch (error) {
      console.error('Error creating automation:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Update an automation
   * @param {string} automationId
   * @param {Object} automationData
   * @returns {Promise<Object>}
   */
  async updateAutomation(automationId, automationData) {
    try {
      const response = await this.client.put(`/automations/${automationId}`, automationData);
      return response.data;
    } catch (error) {
      console.error('Error updating automation:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Delete an automation
   * @param {string} automationId
   * @returns {Promise<Object>}
   */
  async deleteAutomation(automationId) {
    try {
      const response = await this.client.delete(`/automations/${automationId}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting automation:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get automation logs
   * @param {string} automationId
   * @param {number} limit
   * @returns {Promise<Array>}
   */
  async getAutomationLogs(automationId, limit = 50) {
    try {
      const response = await this.client.get(`/automations/${automationId}/logs`, {
        params: { limit }
      });
      return response.data || [];
    } catch (error) {
      console.error('Error getting automation logs:', error.response?.data || error.message);
      throw error;
    }
  }

  // ==================== MEDIA ====================

  /**
   * Upload media for posts
   * @param {string} url - Public URL of the media
   * @param {string} type - 'image' or 'video'
   * @param {string} altText - Optional alt text
   * @returns {Promise<Object>}
   */
  async uploadMedia(url, type, altText = '') {
    try {
      const response = await this.client.post('/media', { url, type, altText });
      return response.data;
    } catch (error) {
      console.error('Error uploading media:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * List uploaded media
   * @param {Object} options - { type, limit }
   * @returns {Promise<Array>}
   */
  async listMedia(options = {}) {
    try {
      const response = await this.client.get('/media', { params: options });
      return response.data || [];
    } catch (error) {
      console.error('Error listing media:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Delete media
   * @param {string} mediaId
   * @returns {Promise<Object>}
   */
  async deleteMedia(mediaId) {
    try {
      const response = await this.client.delete(`/media/${mediaId}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting media:', error.response?.data || error.message);
      throw error;
    }
  }
}

export default ZernioIntegration;
