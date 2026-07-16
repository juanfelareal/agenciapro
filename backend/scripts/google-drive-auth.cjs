/**
 * Google Drive OAuth2 Authorization Script
 *
 * Run this ONCE to get the refresh token:
 * node scripts/google-drive-auth.js
 *
 * Then copy the refresh token to .env file
 */

require('dotenv').config();
const { google } = require('googleapis');
const http = require('http');
const url = require('url');
const open = require('open');

const CLIENT_ID = process.env.GOOGLE_DRIVE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3333/oauth2callback';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ Error: GOOGLE_DRIVE_CLIENT_ID and GOOGLE_DRIVE_CLIENT_SECRET must be set in .env');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const scopes = ['https://www.googleapis.com/auth/drive'];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: scopes,
  prompt: 'consent'
});

console.log('\n🔐 Google Drive Authorization\n');
console.log('Opening browser for authorization...\n');

// Create a simple server to receive the callback
const server = http.createServer(async (req, res) => {
  const queryParams = url.parse(req.url, true).query;

  if (queryParams.code) {
    try {
      const { tokens } = await oauth2Client.getToken(queryParams.code);

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
        <html>
          <head>
            <style>
              body { font-family: -apple-system, sans-serif; max-width: 600px; margin: 100px auto; text-align: center; }
              .success { color: #16a34a; font-size: 48px; }
              code { background: #f3f4f6; padding: 16px; border-radius: 8px; display: block; margin: 20px 0; word-break: break-all; font-size: 12px; }
              h1 { color: #17181A; }
            </style>
          </head>
          <body>
            <div class="success">✓</div>
            <h1>¡Autorización exitosa!</h1>
            <p>Copia este <strong>Refresh Token</strong> y agrégalo a tu archivo <code>.env</code>:</p>
            <code>GOOGLE_DRIVE_REFRESH_TOKEN=${tokens.refresh_token}</code>
            <p style="color: #6b7280; margin-top: 30px;">Ya puedes cerrar esta ventana.</p>
          </body>
        </html>
      `);

      console.log('\n✅ ¡Autorización exitosa!\n');
      console.log('📋 Refresh Token:\n');
      console.log(tokens.refresh_token);
      console.log('\n👆 Copia este token y agrégalo a tu .env:\n');
      console.log(`GOOGLE_DRIVE_REFRESH_TOKEN=${tokens.refresh_token}\n`);

      server.close();
      process.exit(0);
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Error getting tokens: ' + error.message);
      console.error('Error:', error.message);
      server.close();
      process.exit(1);
    }
  } else if (queryParams.error) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Authorization denied: ' + queryParams.error);
    console.error('Authorization denied:', queryParams.error);
    server.close();
    process.exit(1);
  }
});

server.listen(3333, async () => {
  console.log('Waiting for authorization...\n');

  // Try to open the browser
  try {
    await open(authUrl);
  } catch (e) {
    console.log('Could not open browser automatically.');
    console.log('Please open this URL manually:\n');
    console.log(authUrl);
  }
});
