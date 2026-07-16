/**
 * Google Drive Service for Orbit (AgenciaPro)
 *
 * Handles automatic folder creation for UGC creators
 * Structure: REAL UGC / [Cliente] / [Creador]_[Cliente]_[Fecha]
 *
 * Uses OAuth2 authentication with refresh token
 */

import { google } from 'googleapis';

class GoogleDriveService {
  constructor() {
    this.drive = null;
    this.initialized = false;
    this.rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID; // "REAL UGC" folder ID
  }

  /**
   * Initialize the Google Drive client with OAuth2 credentials
   */
  async initialize() {
    if (this.initialized) return true;

    try {
      const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
      const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;

      if (!clientId || !clientSecret) {
        console.warn('Google Drive OAuth credentials not configured');
        return false;
      }

      const oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        'http://localhost:3000/oauth2callback'
      );

      // If we have a refresh token, use it
      if (refreshToken) {
        oauth2Client.setCredentials({
          refresh_token: refreshToken
        });
      } else {
        console.warn('Google Drive refresh token not configured. Run authorization flow first.');
        return false;
      }

      this.drive = google.drive({ version: 'v3', auth: oauth2Client });
      this.oauth2Client = oauth2Client;
      this.initialized = true;
      console.log('Google Drive service initialized successfully');
      return true;
    } catch (error) {
      console.error('Error initializing Google Drive service:', error.message);
      return false;
    }
  }

  /**
   * Generate authorization URL for first-time setup
   */
  getAuthUrl() {
    const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('Google Drive OAuth credentials not configured');
    }

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      'http://localhost:3000/oauth2callback'
    );

    const scopes = ['https://www.googleapis.com/auth/drive'];

    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent' // Force to get refresh token
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async getTokensFromCode(code) {
    const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      'http://localhost:3000/oauth2callback'
    );

    const { tokens } = await oauth2Client.getToken(code);
    return tokens;
  }

  /**
   * Find or create a folder by name inside a parent folder
   */
  async findOrCreateFolder(folderName, parentFolderId) {
    if (!this.initialized) {
      const success = await this.initialize();
      if (!success) throw new Error('Google Drive service not initialized');
    }

    try {
      // Search for existing folder
      const query = `name='${folderName}' and '${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;

      const searchResponse = await this.drive.files.list({
        q: query,
        fields: 'files(id, name, webViewLink)',
        spaces: 'drive'
      });

      if (searchResponse.data.files && searchResponse.data.files.length > 0) {
        // Folder exists
        const folder = searchResponse.data.files[0];
        return {
          id: folder.id,
          name: folder.name,
          url: folder.webViewLink || `https://drive.google.com/drive/folders/${folder.id}`
        };
      }

      // Create new folder
      const folderMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolderId]
      };

      const createResponse = await this.drive.files.create({
        resource: folderMetadata,
        fields: 'id, name, webViewLink'
      });

      const newFolder = createResponse.data;

      // Make folder accessible to anyone with the link (for creators to upload)
      await this.drive.permissions.create({
        fileId: newFolder.id,
        requestBody: {
          role: 'writer',
          type: 'anyone'
        }
      });

      return {
        id: newFolder.id,
        name: newFolder.name,
        url: newFolder.webViewLink || `https://drive.google.com/drive/folders/${newFolder.id}`
      };
    } catch (error) {
      console.error('Error finding/creating folder:', error.message);
      throw error;
    }
  }

  /**
   * Create the folder structure for a UGC creator assignment
   * Structure: REAL UGC / [Cliente] / [Creador]_[Cliente]_[Fecha]
   */
  async createCreatorFolder(clientName, creatorName, date = null) {
    if (!this.rootFolderId) {
      throw new Error('GOOGLE_DRIVE_ROOT_FOLDER_ID not configured');
    }

    if (!this.initialized) {
      const success = await this.initialize();
      if (!success) throw new Error('Google Drive service not initialized');
    }

    try {
      // Format date
      const dateStr = date || new Date().toLocaleDateString('es-CO', {
        month: 'short',
        year: 'numeric'
      }).replace(' ', '').replace('.', '');

      // Clean names for folder naming
      const cleanClientName = this.sanitizeFolderName(clientName);
      const cleanCreatorName = this.sanitizeFolderName(creatorName);

      // Step 1: Find or create client folder inside REAL UGC
      const clientFolder = await this.findOrCreateFolder(cleanClientName, this.rootFolderId);
      console.log(`Client folder: ${clientFolder.name} (${clientFolder.id})`);

      // Step 2: Create creator subfolder inside client folder
      const creatorFolderName = `${cleanCreatorName}_${cleanClientName}_${dateStr}`;
      const creatorFolder = await this.findOrCreateFolder(creatorFolderName, clientFolder.id);
      console.log(`Creator folder: ${creatorFolder.name} (${creatorFolder.id})`);

      return {
        clientFolder,
        creatorFolder,
        success: true
      };
    } catch (error) {
      console.error('Error creating creator folder structure:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Sanitize folder name (remove special characters)
   */
  sanitizeFolderName(name) {
    return name
      .trim()
      .replace(/[<>:"/\\|?*]/g, '') // Remove invalid characters
      .replace(/\s+/g, ' '); // Normalize spaces
  }

  /**
   * Get folder info by ID
   */
  async getFolderInfo(folderId) {
    if (!this.initialized) {
      const success = await this.initialize();
      if (!success) throw new Error('Google Drive service not initialized');
    }

    try {
      const response = await this.drive.files.get({
        fileId: folderId,
        fields: 'id, name, webViewLink, parents'
      });

      return {
        id: response.data.id,
        name: response.data.name,
        url: response.data.webViewLink || `https://drive.google.com/drive/folders/${response.data.id}`,
        parents: response.data.parents
      };
    } catch (error) {
      console.error('Error getting folder info:', error.message);
      throw error;
    }
  }

  /**
   * List folders inside a parent folder
   */
  async listFolders(parentFolderId) {
    if (!this.initialized) {
      const success = await this.initialize();
      if (!success) throw new Error('Google Drive service not initialized');
    }

    try {
      const query = `'${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;

      const response = await this.drive.files.list({
        q: query,
        fields: 'files(id, name, webViewLink)',
        orderBy: 'name',
        spaces: 'drive'
      });

      return response.data.files.map(file => ({
        id: file.id,
        name: file.name,
        url: file.webViewLink || `https://drive.google.com/drive/folders/${file.id}`
      }));
    } catch (error) {
      console.error('Error listing folders:', error.message);
      throw error;
    }
  }

  /**
   * Check if service is configured and ready
   */
  isConfigured() {
    return !!(
      process.env.GOOGLE_DRIVE_CLIENT_ID &&
      process.env.GOOGLE_DRIVE_CLIENT_SECRET &&
      process.env.GOOGLE_DRIVE_REFRESH_TOKEN &&
      process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID
    );
  }
}

// Export singleton instance
const googleDriveService = new GoogleDriveService();
export default googleDriveService;
