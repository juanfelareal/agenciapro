/**
 * Creates the "REAL UGC" root folder in Google Drive
 * Run: node scripts/create-real-ugc-folder.cjs
 */

require('dotenv').config();
const { google } = require('googleapis');

const CLIENT_ID = process.env.GOOGLE_DRIVE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;

async function createRootFolder() {
  console.log('\n📁 Creating REAL UGC folder...\n');

  const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
  oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  try {
    // First check if folder already exists
    const searchResponse = await drive.files.list({
      q: "name='REAL UGC' and mimeType='application/vnd.google-apps.folder' and trashed=false",
      fields: 'files(id, name, webViewLink)',
      spaces: 'drive'
    });

    if (searchResponse.data.files && searchResponse.data.files.length > 0) {
      const folder = searchResponse.data.files[0];
      console.log('✅ Folder already exists!\n');
      console.log(`📂 Name: ${folder.name}`);
      console.log(`🔗 URL: ${folder.webViewLink}`);
      console.log(`🆔 ID: ${folder.id}`);
      console.log('\n👆 Add this to your .env:\n');
      console.log(`GOOGLE_DRIVE_ROOT_FOLDER_ID=${folder.id}\n`);
      return;
    }

    // Create new folder
    const folderMetadata = {
      name: 'REAL UGC',
      mimeType: 'application/vnd.google-apps.folder'
    };

    const createResponse = await drive.files.create({
      resource: folderMetadata,
      fields: 'id, name, webViewLink'
    });

    const newFolder = createResponse.data;

    console.log('✅ Folder created successfully!\n');
    console.log(`📂 Name: ${newFolder.name}`);
    console.log(`🔗 URL: https://drive.google.com/drive/folders/${newFolder.id}`);
    console.log(`🆔 ID: ${newFolder.id}`);
    console.log('\n👆 Add this to your .env:\n');
    console.log(`GOOGLE_DRIVE_ROOT_FOLDER_ID=${newFolder.id}\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createRootFolder();
