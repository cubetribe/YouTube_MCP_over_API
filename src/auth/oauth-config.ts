import crypto from 'crypto';

export interface OAuthConfigOptions {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export interface PKCEPair {
  verifier: string;
  challenge: string;
  method: 'S256';
}

export class OAuthConfigManager {
  private config: OAuthConfigOptions | null = null;
  private encryptionKey?: Buffer;
  private initialized = false;

  constructor() {
    // Lazy initialization - don't crash on startup if env vars missing
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      this.config = this.loadConfig();
      this.encryptionKey = this.initializeEncryption();
      this.initialized = true;
    }
  }

  getConfig(): OAuthConfigOptions {
    this.ensureInitialized();
    return { ...this.config! };
  }

  parseScopes(scopes?: string | string[]): string[] {
    // Allow parsing scopes without initialization if scopes provided
    if (!scopes) {
      this.ensureInitialized();
      return [...this.config!.scopes];
    }
    if (Array.isArray(scopes)) return scopes.map(scope => scope.trim()).filter(Boolean);
    return scopes.split(',').map(scope => scope.trim()).filter(Boolean);
  }

  generatePKCEPair(): PKCEPair {
    const verifier = crypto.randomBytes(96).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    return {
      verifier,
      challenge,
      method: 'S256',
    };
  }

  generateState(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  encryptionEnabled(): boolean {
    return Boolean(this.encryptionKey);
  }

  encrypt(data: string): string {
    if (!this.encryptionKey) {
      return data;
    }
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return JSON.stringify({
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      payload: encrypted.toString('base64'),
    });
  }

  decrypt(payload: string): string {
    if (!this.encryptionKey) {
      return payload;
    }
    const { iv, tag, payload: data } = JSON.parse(payload) as { iv: string; tag: string; payload: string };
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]);
    return decrypted.toString('utf8');
  }

  private loadConfig(): OAuthConfigOptions {
    const env = process.env;
    const clientId = env['YOUTUBE_CLIENT_ID'] || env['GOOGLE_CLIENT_ID'];
    const clientSecret = env['YOUTUBE_CLIENT_SECRET'] || env['GOOGLE_CLIENT_SECRET'];
    if (!clientId || !clientSecret) {
      throw new Error('OAuth not configured: Missing YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET environment variables');
    }

    const redirectUri = env['YOUTUBE_REDIRECT_URI'] || env['GOOGLE_REDIRECT_URI'] || 'http://localhost:3000/callback';
    const scopes = this.parseScopes(
      env['YOUTUBE_OAUTH_SCOPES'] || env['GOOGLE_OAUTH_SCOPES'] || [
        'https://www.googleapis.com/auth/youtube',
        'https://www.googleapis.com/auth/youtube.upload',
        'https://www.googleapis.com/auth/youtubepartner-channel-audit',
      ]
    );

    return {
      clientId,
      clientSecret,
      redirectUri,
      scopes,
    };
  }

  private initializeEncryption(): Buffer | undefined {
    const secret = process.env['OAUTH_ENCRYPTION_SECRET'];
    if (!secret) return undefined;
    return crypto.scryptSync(secret, 'youtube-mcp-salt', 32);
  }
}

export const oauthConfig = new OAuthConfigManager();
