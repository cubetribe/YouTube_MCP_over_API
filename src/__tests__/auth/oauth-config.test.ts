import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OAuthConfigManager, type PKCEPair } from '../../auth/oauth-config.js';

describe('OAuthConfigManager', () => {
  let oauthConfig: OAuthConfigManager;
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment variables
    vi.resetModules();
    process.env = { ...originalEnv };
    oauthConfig = new OAuthConfigManager();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  describe('Configuration Loading', () => {
    it('should load config from environment variables', () => {
      process.env.YOUTUBE_CLIENT_ID = 'test-client-id';
      process.env.YOUTUBE_CLIENT_SECRET = 'test-client-secret';
      process.env.YOUTUBE_REDIRECT_URI = 'http://localhost:8080/callback';

      const config = oauthConfig.getConfig();

      expect(config.clientId).toBe('test-client-id');
      expect(config.clientSecret).toBe('test-client-secret');
      expect(config.redirectUri).toBe('http://localhost:8080/callback');
      expect(config.scopes).toEqual([
        'https://www.googleapis.com/auth/youtube',
        'https://www.googleapis.com/auth/youtube.upload',
        'https://www.googleapis.com/auth/youtubepartner-channel-audit',
      ]);
    });

    it('should use default redirect URI if not provided', () => {
      process.env.YOUTUBE_CLIENT_ID = 'test-client-id';
      process.env.YOUTUBE_CLIENT_SECRET = 'test-client-secret';

      const config = oauthConfig.getConfig();

      expect(config.redirectUri).toBe('http://localhost:3000/callback');
    });

    it('should throw error if required environment variables are missing', () => {
      expect(() => oauthConfig.getConfig()).toThrow(
        'OAuth not configured: Missing YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET environment variables'
      );
    });

    it('should support alternative environment variable names', () => {
      // Clear any existing YouTube env vars
      delete process.env.YOUTUBE_CLIENT_ID;
      delete process.env.YOUTUBE_CLIENT_SECRET;

      process.env.GOOGLE_CLIENT_ID = 'alt-client-id';
      process.env.GOOGLE_CLIENT_SECRET = 'alt-client-secret';

      // Create new instance to force re-initialization
      const newOauthConfig = new OAuthConfigManager();
      const config = newOauthConfig.getConfig();

      expect(config.clientId).toBe('alt-client-id');
      expect(config.clientSecret).toBe('alt-client-secret');
    });
  });

  describe('Scope Parsing', () => {
    beforeEach(() => {
      process.env.YOUTUBE_CLIENT_ID = 'test-client-id';
      process.env.YOUTUBE_CLIENT_SECRET = 'test-client-secret';
    });

    it('should parse string scopes with comma separation', () => {
      const scopes = oauthConfig.parseScopes('scope1,scope2,scope3');
      expect(scopes).toEqual(['scope1', 'scope2', 'scope3']);
    });

    it('should parse array scopes', () => {
      const scopes = oauthConfig.parseScopes(['scope1', 'scope2', 'scope3']);
      expect(scopes).toEqual(['scope1', 'scope2', 'scope3']);
    });

    it('should trim whitespace from scopes', () => {
      const scopes = oauthConfig.parseScopes('  scope1 , scope2  , scope3  ');
      expect(scopes).toEqual(['scope1', 'scope2', 'scope3']);
    });

    it('should filter empty scopes', () => {
      const scopes = oauthConfig.parseScopes(['scope1', '', 'scope2', '   ', 'scope3']);
      expect(scopes).toEqual(['scope1', 'scope2', 'scope3']);
    });

    it('should return default scopes if no scopes provided', () => {
      const scopes = oauthConfig.parseScopes();
      expect(scopes).toEqual([
        'https://www.googleapis.com/auth/youtube',
        'https://www.googleapis.com/auth/youtube.upload',
        'https://www.googleapis.com/auth/youtubepartner-channel-audit',
      ]);
    });
  });

  describe('PKCE Generation', () => {
    it('should generate valid PKCE pair', () => {
      const pkce: PKCEPair = oauthConfig.generatePKCEPair();

      expect(pkce.verifier).toBeDefined();
      expect(pkce.challenge).toBeDefined();
      expect(pkce.method).toBe('S256');
      expect(typeof pkce.verifier).toBe('string');
      expect(typeof pkce.challenge).toBe('string');
      expect(pkce.verifier.length).toBeGreaterThan(0);
      expect(pkce.challenge.length).toBeGreaterThan(0);
    });

    it('should generate unique PKCE pairs', () => {
      const pkce1 = oauthConfig.generatePKCEPair();
      const pkce2 = oauthConfig.generatePKCEPair();

      expect(pkce1.verifier).not.toBe(pkce2.verifier);
      expect(pkce1.challenge).not.toBe(pkce2.challenge);
    });

    it('should use base64url encoding for verifier and challenge', () => {
      const pkce = oauthConfig.generatePKCEPair();

      // Base64url should not contain +, /, or = characters
      expect(pkce.verifier).not.toMatch(/[+\/=]/);
      expect(pkce.challenge).not.toMatch(/[+\/=]/);
    });
  });

  describe('State Generation', () => {
    it('should generate random state strings', () => {
      const state1 = oauthConfig.generateState();
      const state2 = oauthConfig.generateState();

      expect(state1).toBeDefined();
      expect(state2).toBeDefined();
      expect(typeof state1).toBe('string');
      expect(typeof state2).toBe('string');
      expect(state1).not.toBe(state2);
      expect(state1.length).toBe(64); // 32 bytes * 2 (hex)
    });

    it('should generate hex-encoded state strings', () => {
      const state = oauthConfig.generateState();
      expect(state).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('Encryption', () => {
    it('should indicate encryption is disabled when no secret provided', () => {
      expect(oauthConfig.encryptionEnabled()).toBe(false);
    });

    it('should indicate encryption is enabled when secret provided', () => {
      process.env.OAUTH_ENCRYPTION_SECRET = 'test-secret';
      process.env.YOUTUBE_CLIENT_ID = 'test-client-id';
      process.env.YOUTUBE_CLIENT_SECRET = 'test-client-secret';

      const newConfig = new OAuthConfigManager();
      const config = newConfig.getConfig(); // Force initialization
      expect(newConfig.encryptionEnabled()).toBe(true);
    });

    it('should return original data when encryption is disabled', () => {
      const testData = 'test data';
      const encrypted = oauthConfig.encrypt(testData);
      const decrypted = oauthConfig.decrypt(encrypted);

      expect(encrypted).toBe(testData);
      expect(decrypted).toBe(testData);
    });

    it('should encrypt and decrypt data when encryption is enabled', () => {
      process.env.OAUTH_ENCRYPTION_SECRET = 'test-secret';
      process.env.YOUTUBE_CLIENT_ID = 'test-client-id';
      process.env.YOUTUBE_CLIENT_SECRET = 'test-client-secret';

      const newConfig = new OAuthConfigManager();
      newConfig.getConfig(); // Force initialization

      const testData = 'sensitive test data';
      const encrypted = newConfig.encrypt(testData);
      const decrypted = newConfig.decrypt(encrypted);

      expect(encrypted).not.toBe(testData);
      expect(decrypted).toBe(testData);

      // Encrypted data should be JSON with expected structure
      const parsed = JSON.parse(encrypted);
      expect(parsed).toHaveProperty('iv');
      expect(parsed).toHaveProperty('tag');
      expect(parsed).toHaveProperty('payload');
    });

    it('should produce different encrypted output for same input', () => {
      process.env.OAUTH_ENCRYPTION_SECRET = 'test-secret';
      process.env.YOUTUBE_CLIENT_ID = 'test-client-id';
      process.env.YOUTUBE_CLIENT_SECRET = 'test-client-secret';

      const newConfig = new OAuthConfigManager();
      newConfig.getConfig(); // Force initialization

      const testData = 'test data';
      const encrypted1 = newConfig.encrypt(testData);
      const encrypted2 = newConfig.encrypt(testData);

      expect(encrypted1).not.toBe(encrypted2);
      expect(newConfig.decrypt(encrypted1)).toBe(testData);
      expect(newConfig.decrypt(encrypted2)).toBe(testData);
    });
  });

  describe('Lazy Initialization', () => {
    it('should not throw during construction with missing env vars', () => {
      expect(() => new OAuthConfigManager()).not.toThrow();
    });

    it('should throw only when config is accessed with missing env vars', () => {
      const config = new OAuthConfigManager();
      expect(() => config.getConfig()).toThrow();
    });

    it('should allow scope parsing without full initialization', () => {
      const config = new OAuthConfigManager();
      expect(() => config.parseScopes(['scope1', 'scope2'])).not.toThrow();
    });
  });
});