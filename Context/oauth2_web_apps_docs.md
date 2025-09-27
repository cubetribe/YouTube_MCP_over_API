# OAuth 2.0 for Web Applications (2025)

## Overview

OAuth 2.0 is the industry-standard protocol for authorization, allowing applications to obtain limited access to user accounts on HTTP services. This guide covers implementing OAuth 2.0 for web server applications accessing Google APIs.

**Last Updated:** September 2025  
**OAuth Version:** 2.1 (backward compatible with 2.0)  
**Official Documentation:** https://developers.google.com/identity/protocols/oauth2

## Key Concepts

### What is OAuth 2.0?

OAuth 2.0 enables applications to access user data without requiring users to share their passwords. Instead of credentials, applications receive access tokens that grant specific permissions for limited time periods.

### Benefits

- **Security:** No password sharing between applications
- **Granular Permissions:** Scope-based access control
- **Token Expiration:** Time-limited access reduces security risks
- **Revocable Access:** Users can revoke permissions at any time

## OAuth 2.0 Flows for Web Applications

### Authorization Code Flow (Recommended)

The most secure flow for web server applications:

1. **User Authorization:** Redirect user to Google's authorization server
2. **Authorization Grant:** User grants permission, receives authorization code
3. **Token Exchange:** Server exchanges code for access token
4. **API Access:** Use access token to make API requests
5. **Token Refresh:** Use refresh token to get new access tokens

### Flow Diagram

```
User → Your App → Google Auth → User Consent → Auth Code → Your Server
                                                            ↓
API Requests ← Access Token ← Token Exchange ← Your Server
```

## Google Cloud Console Setup

### 1. Create OAuth 2.0 Credentials

1. **Navigate to Credentials:**
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Select your project
   - Navigate to "APIs & Services" > "Credentials"

2. **Create OAuth Client ID:**
   - Click "CREATE CREDENTIALS" > "OAuth client ID"
   - Choose "Web application"
   - Configure authorized origins and redirect URIs

3. **Download Credentials:**
   - Download `client_secret.json`
   - Store securely (never commit to version control)

### 2. Configure Authorized URIs

#### Authorized JavaScript Origins
```
https://yourdomain.com
https://subdomain.yourdomain.com
http://localhost:3000  // For development only
```

#### Authorized Redirect URIs
```
https://yourdomain.com/oauth/callback
https://yourdomain.com/auth/google/callback
http://localhost:3000/callback  // For development only
```

**Important URI Rules:**
- Must use HTTPS (except localhost)
- Cannot be raw IP addresses (except localhost)
- Cannot use URL shorteners
- Cannot contain userinfo components

## Implementation Guide

### Step 1: Authorization Request

Redirect users to Google's authorization endpoint:

```javascript
// Generate authorization URL
const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
  client_id: process.env.GOOGLE_CLIENT_ID,
  redirect_uri: 'https://yourdomain.com/oauth/callback',
  response_type: 'code',
  scope: 'https://www.googleapis.com/auth/youtube',
  access_type: 'offline',  // Essential for refresh tokens
  prompt: 'consent',       // Forces consent screen
  state: generateRandomState() // CSRF protection
}).toString()}`;

// Redirect user
res.redirect(authUrl);
```

### Step 2: Handle Authorization Response

Process the callback with authorization code:

```javascript
app.get('/oauth/callback', async (req, res) => {
  const { code, state, error } = req.query;
  
  // Validate state parameter (CSRF protection)
  if (!validateState(state)) {
    return res.status(400).send('Invalid state parameter');
  }
  
  if (error) {
    return res.status(400).send(`Authorization error: ${error}`);
  }
  
  try {
    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);
    
    // Store tokens securely
    await storeUserTokens(userId, tokens);
    
    res.redirect('/dashboard');
  } catch (error) {
    res.status(500).send('Token exchange failed');
  }
});
```

### Step 3: Token Exchange

Exchange authorization code for access and refresh tokens:

```javascript
async function exchangeCodeForTokens(code) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: 'https://yourdomain.com/oauth/callback'
    })
  });
  
  if (!response.ok) {
    throw new Error('Token exchange failed');
  }
  
  return await response.json();
}
```

### Step 4: Token Management

Implement automatic token refresh:

```javascript
class TokenManager {
  async getValidAccessToken(userId) {
    const tokens = await this.getUserTokens(userId);
    
    // Check if token is expired
    if (this.isTokenExpired(tokens)) {
      tokens = await this.refreshAccessToken(tokens);
      await this.storeUserTokens(userId, tokens);
    }
    
    return tokens.access_token;
  }
  
  async refreshAccessToken(tokens) {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token: tokens.refresh_token,
        grant_type: 'refresh_token'
      })
    });
    
    if (!response.ok) {
      throw new Error('Token refresh failed');
    }
    
    const newTokens = await response.json();
    
    // Preserve refresh token if not provided in response
    if (!newTokens.refresh_token) {
      newTokens.refresh_token = tokens.refresh_token;
    }
    
    return newTokens;
  }
  
  isTokenExpired(tokens) {
    if (!tokens.expires_at) return true;
    
    const now = Math.floor(Date.now() / 1000);
    const bufferTime = 300; // 5-minute buffer
    
    return now >= (tokens.expires_at - bufferTime);
  }
}
```

## Scopes and Permissions

### YouTube API Scopes

```javascript
const scopes = [
  'https://www.googleapis.com/auth/youtube',              // Full access
  'https://www.googleapis.com/auth/youtube.readonly',     // Read-only
  'https://www.googleapis.com/auth/youtube.upload',       // Upload only
  'https://www.googleapis.com/auth/youtube.channel-memberships.creator' // Memberships
];
```

### Incremental Authorization

Request additional scopes as needed:

```javascript
// Initial authorization with basic scope
const basicAuthUrl = generateAuthUrl(['https://www.googleapis.com/auth/youtube.readonly']);

// Later, request additional scope
const extendedAuthUrl = generateAuthUrl([
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/youtube.upload'
], { include_granted_scopes: true });
```

## Security Best Practices

### State Parameter (CSRF Protection)

Always use a state parameter to prevent CSRF attacks:

```javascript
function generateState() {
  return crypto.randomBytes(32).toString('hex');
}

function validateState(receivedState, storedState) {
  return crypto.timingSafeEqual(
    Buffer.from(receivedState),
    Buffer.from(storedState)
  );
}
```

### Secure Token Storage

```javascript
// Use encrypted storage for tokens
const encryptedTokens = encrypt(JSON.stringify(tokens), secretKey);
await db.users.update(userId, { encrypted_tokens: encryptedTokens });

// Decrypt when retrieving
const tokens = JSON.parse(decrypt(encryptedTokens, secretKey));
```

### PKCE (Proof Key for Code Exchange)

For enhanced security, implement PKCE:

```javascript
function generateCodeVerifier() {
  return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier) {
  return crypto.createHash('sha256')
    .update(verifier)
    .digest('base64url');
}

// In authorization URL
const codeVerifier = generateCodeVerifier();
const codeChallenge = generateCodeChallenge(codeVerifier);

const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
  // ... other parameters
  code_challenge: codeChallenge,
  code_challenge_method: 'S256'
}).toString()}`;

// In token exchange
const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    // ... other parameters
    code_verifier: codeVerifier
  })
});
```

## Complete Implementation Example

### Express.js Application

```javascript
const express = require('express');
const session = require('express-session');
const crypto = require('crypto');

const app = express();

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// Configuration
const GOOGLE_CONFIG = {
  client_id: process.env.GOOGLE_CLIENT_ID,
  client_secret: process.env.GOOGLE_CLIENT_SECRET,
  redirect_uri: process.env.GOOGLE_REDIRECT_URI,
  scope: 'https://www.googleapis.com/auth/youtube'
};

// Initiate OAuth flow
app.get('/auth/google', (req, res) => {
  const state = crypto.randomBytes(32).toString('hex');
  req.session.oauthState = state;
  
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
    client_id: GOOGLE_CONFIG.client_id,
    redirect_uri: GOOGLE_CONFIG.redirect_uri,
    response_type: 'code',
    scope: GOOGLE_CONFIG.scope,
    access_type: 'offline',
    prompt: 'consent',
    state: state
  }).toString()}`;
  
  res.redirect(authUrl);
});

// Handle OAuth callback
app.get('/auth/google/callback', async (req, res) => {
  const { code, state, error } = req.query;
  
  // Validate state
  if (state !== req.session.oauthState) {
    return res.status(400).send('Invalid state parameter');
  }
  
  if (error) {
    return res.status(400).send(`OAuth error: ${error}`);
  }
  
  try {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CONFIG.client_id,
        client_secret: GOOGLE_CONFIG.client_secret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: GOOGLE_CONFIG.redirect_uri
      })
    });
    
    if (!tokenResponse.ok) {
      throw new Error('Token exchange failed');
    }
    
    const tokens = await tokenResponse.json();
    
    // Store tokens in session (use database in production)
    req.session.googleTokens = tokens;
    
    res.redirect('/dashboard');
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).send('Authentication failed');
  }
});

// Protected route example
app.get('/dashboard', requireAuth, async (req, res) => {
  try {
    const accessToken = await getValidAccessToken(req.session.googleTokens);
    
    // Make API request
    const response = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).send('API request failed');
  }
});

// Middleware to check authentication
function requireAuth(req, res, next) {
  if (!req.session.googleTokens) {
    return res.redirect('/auth/google');
  }
  next();
}

// Token validation and refresh
async function getValidAccessToken(tokens) {
  // Check if token is still valid
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = tokens.expires_at || (tokens.created_at + tokens.expires_in);
  
  if (now < expiresAt - 300) { // 5-minute buffer
    return tokens.access_token;
  }
  
  // Refresh token
  const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CONFIG.client_id,
      client_secret: GOOGLE_CONFIG.client_secret,
      refresh_token: tokens.refresh_token,
      grant_type: 'refresh_token'
    })
  });
  
  if (!refreshResponse.ok) {
    throw new Error('Token refresh failed');
  }
  
  const newTokens = await refreshResponse.json();
  
  // Update stored tokens
  Object.assign(tokens, newTokens);
  tokens.created_at = Math.floor(Date.now() / 1000);
  tokens.expires_at = tokens.created_at + tokens.expires_in;
  
  return tokens.access_token;
}

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

## Error Handling

### Common OAuth Errors

| Error Code | Description | Solution |
|------------|-------------|----------|
| `access_denied` | User denied access | Handle gracefully, allow retry |
| `invalid_client` | Invalid client credentials | Check client ID/secret |
| `invalid_grant` | Invalid/expired authorization code | Restart auth flow |
| `invalid_request` | Malformed request | Validate all parameters |
| `unauthorized_client` | Client not authorized | Check OAuth client config |

### Error Response Handling

```javascript
async function handleOAuthError(error, req, res) {
  console.error('OAuth Error:', error);
  
  switch (error) {
    case 'access_denied':
      res.redirect('/?error=access_denied&message=Authorization was denied');
      break;
      
    case 'invalid_client':
      res.status(500).send('OAuth configuration error');
      break;
      
    case 'invalid_grant':
      // Clear stored tokens and restart flow
      req.session.googleTokens = null;
      res.redirect('/auth/google');
      break;
      
    default:
      res.status(500).send('OAuth error occurred');
  }
}
```

## Testing and Development

### Local Development Setup

```bash
# Install dependencies
npm install express express-session dotenv

# Environment variables (.env)
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
SESSION_SECRET=your-random-session-secret
NODE_ENV=development
```

### OAuth Playground

Use [Google OAuth 2.0 Playground](https://developers.google.com/oauthplayground/) to:
- Test authorization flows
- Examine token responses
- Debug scope issues
- Understand API responses

## Production Considerations

### App Verification

For production applications:

1. **Domain Verification:** Verify ownership of authorized domains
2. **App Review:** Submit for Google's app verification process
3. **Privacy Policy:** Required for apps requesting user data
4. **Terms of Service:** Clear terms for your application

### Publishing Status

- **Testing:** 7-day refresh token expiration (max 100 users)
- **In Production:** Long-lived refresh tokens (unlimited users)

### Security Checklist

- [ ] Use HTTPS for all OAuth endpoints
- [ ] Implement CSRF protection with state parameter
- [ ] Encrypt stored refresh tokens
- [ ] Use PKCE for enhanced security
- [ ] Validate all redirect URIs
- [ ] Implement proper session management
- [ ] Monitor for suspicious activity
- [ ] Regular security audits

## Migration from Less Secure Apps

As of March 14, 2025, Google requires OAuth 2.0 for all third-party access:

### Migration Steps

1. **Update Authentication:** Replace password-based auth with OAuth 2.0
2. **Update Applications:** Modify apps to use access tokens
3. **Test Thoroughly:** Ensure all functionality works with OAuth
4. **User Communication:** Notify users of required re-authorization

### Legacy Protocol Support

No longer supported:
- Basic authentication (username/password)
- Google Sync
- Less secure app access

## Resources and Tools

### Official Google Resources

- **OAuth 2.0 Documentation:** https://developers.google.com/identity/protocols/oauth2
- **OAuth 2.0 Playground:** https://developers.google.com/oauthplayground/
- **Client Libraries:** Available for multiple languages
- **Verification Process:** https://support.google.com/cloud/answer/9110914

### Client Libraries

```bash
# Node.js
npm install google-auth-library googleapis

# Python
pip install google-auth google-auth-oauthlib google-auth-httplib2

# Java
# Add to pom.xml
<dependency>
  <groupId>com.google.auth</groupId>
  <artifactId>google-auth-library-oauth2-http</artifactId>
</dependency>
```

### Example Using Google Auth Library (Node.js)

```javascript
const { OAuth2Client } = require('google-auth-library');

const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Generate auth URL
const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: ['https://www.googleapis.com/auth/youtube'],
  prompt: 'consent'
});

// Exchange code for tokens
const { tokens } = await oauth2Client.getToken(code);
oauth2Client.setCredentials(tokens);

// Use with Google APIs
const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
```

---

*This documentation covers OAuth 2.0 implementation for web applications as of September 2025. Always refer to the official Google documentation for the most current information and security recommendations.*