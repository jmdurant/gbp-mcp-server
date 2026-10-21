#!/usr/bin/env node
/** Local Google OAuth enrollment; tokens are never printed. */
import { config } from 'dotenv';
import { google } from 'googleapis';
import express from 'express';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import open from 'open';
import { OAuthAttempt, createOAuthCallback } from './src/utils/oauthAttempt.js';
import { writePrivateTokenFile } from './src/utils/privateTokenFile.js';

config();
const PORT = 3000;
const TOKENS_FILE = join(dirname(fileURLToPath(import.meta.url)), '.tokens.json');
const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET,
    `http://localhost:${PORT}/auth/callback`
);
const scopes = [
    'https://www.googleapis.com/auth/business.manage',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
];
const attempt = new OAuthAttempt();
const app = express();
app.get('/auth/callback', createOAuthCallback({
    client, attempt,
    save: tokens => writePrivateTokenFile(TOKENS_FILE, JSON.stringify(tokens, null, 2)),
    completed: () => {
        console.log('Authentication successful. Tokens saved locally.');
        setTimeout(() => server.close(() => process.exit(0)), 2000);
    }
}));
// Preserve the registered localhost redirect URI while preventing LAN exposure.
const server = app.listen(PORT, '127.0.0.1', () => {
    const authUrl = client.generateAuthUrl({
        access_type: 'offline', scope: scopes, prompt: 'consent',
        state: attempt.state, code_challenge: attempt.challenge,
        code_challenge_method: 'S256'
    });
    console.log(`OAuth helper listening on http://localhost:${PORT}`);
    console.log('If the browser does not open, visit:\n' + authUrl);
    open(authUrl).catch(() => console.log('Open the authorization URL above manually.'));
});
server.on('error', error => {
    console.error(error.code === 'EADDRINUSE' ? 'OAuth port 3000 is already in use.' : 'OAuth listener failed.');
    process.exit(1);
});
server.setTimeout(30_000);
// Bound the helper lifetime; expired attempts require an explicit restart.
setTimeout(() => server.close(() => process.exit(1)), 300_000).unref();
