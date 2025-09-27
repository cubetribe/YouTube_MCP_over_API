import { beforeEach, describe, expect, it, vi } from 'vitest';
import { google } from 'googleapis';
import { OAuthService, type AuthorizationUrlResult } from '../../auth/oauth-service.js';
import { oauthConfig } from '../../auth/oauth-config.js';
import { tokenStorage } from '../../auth/token-storage.js';
import type { StoredToken, StoredAuthState } from '../../auth/token-storage.js';

// Mock dependencies
vi.mock('googleapis');
vi.mock('../../auth/oauth-config.js');
vi.mock('../../auth/token-storage.js');

describe('OAuthService', () => {
  let oauthService: OAuthService;
  const mockGoogle = vi.mocked(google);
  const mockOAuthConfig = vi.mocked(oauthConfig);
  const mockTokenStorage = vi.mocked(tokenStorage);

  const mockOAuth2Client = {
    generateAuthUrl: vi.fn(),
    getToken: vi.fn(),
    setCredentials: vi.fn(),
    refreshAccessToken: vi.fn(),
  };

  const mockConfig = {
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    redirectUri: 'http://localhost:3000/callback',
    scopes: ['https://www.googleapis.com/auth/youtube'],
  };

  const mockPKCE = {
    verifier: 'test-verifier',
    challenge: 'test-challenge',
    method: 'S256' as const,
  };

  const mockState = 'test-state-123';

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mocks
    mockGoogle.auth.OAuth2 = vi.fn(() => mockOAuth2Client) as any;
    mockOAuthConfig.getConfig.mockReturnValue(mockConfig);
    mockOAuthConfig.parseScopes.mockReturnValue(mockConfig.scopes);
    mockOAuthConfig.generatePKCEPair.mockReturnValue(mockPKCE);
    mockOAuthConfig.generateState.mockReturnValue(mockState);

    oauthService = new OAuthService();
  });

  describe('Client Initialization', () => {
    it('should lazily initialize OAuth2 client', () => {
      expect(mockGoogle.auth.OAuth2).not.toHaveBeenCalled();

      // Client should be created on first use
      oauthService.generateAuthorizationUrl();

      expect(mockGoogle.auth.OAuth2).toHaveBeenCalledWith(
        mockConfig.clientId,
        mockConfig.clientSecret,
        mockConfig.redirectUri
      );
    });

    it('should reuse existing client instance', () => {
      oauthService.generateAuthorizationUrl();
      oauthService.generateAuthorizationUrl();

      expect(mockGoogle.auth.OAuth2).toHaveBeenCalledTimes(1);
    });
  });

  describe('Authorization URL Generation', () => {
    beforeEach(() => {
      mockOAuth2Client.generateAuthUrl.mockReturnValue('https://auth.google.com/oauth?...');
      mockTokenStorage.saveAuthState.mockResolvedValue(undefined);
    });

    it('should generate authorization URL with correct parameters', async () => {
      const result: AuthorizationUrlResult = await oauthService.generateAuthorizationUrl();

      expect(mockOAuth2Client.generateAuthUrl).toHaveBeenCalledWith({
        access_type: 'offline',
        scope: mockConfig.scopes,
        prompt: 'consent',
        state: mockState,
        code_challenge: mockPKCE.challenge,
        code_challenge_method: 'S256',
      });

      expect(result).toEqual({
        url: 'https://auth.google.com/oauth?...',
        state: mockState,
        verifier: mockPKCE.verifier,
        scopes: mockConfig.scopes,
      });
    });

    it('should use custom scopes when provided', async () => {
      const customScopes = ['custom-scope-1', 'custom-scope-2'];
      mockOAuthConfig.parseScopes.mockReturnValue(customScopes);

      const result = await oauthService.generateAuthorizationUrl(customScopes);

      expect(mockOAuthConfig.parseScopes).toHaveBeenCalledWith(customScopes);
      expect(mockOAuth2Client.generateAuthUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: customScopes,
        })
      );
      expect(result.scopes).toEqual(customScopes);
    });

    it('should save auth state for later verification', async () => {
      await oauthService.generateAuthorizationUrl();

      expect(mockTokenStorage.saveAuthState).toHaveBeenCalledWith({
        state: mockState,
        verifier: mockPKCE.verifier,
        createdAt: expect.any(Number),
        redirectUri: mockConfig.redirectUri,
        scopes: mockConfig.scopes,
      });
    });
  });

  describe('Authorization Completion', () => {
    const mockCode = 'auth-code-123';
    const mockStoredState: StoredAuthState = {
      state: mockState,
      verifier: mockPKCE.verifier,
      createdAt: Date.now(),
      redirectUri: mockConfig.redirectUri,
      scopes: mockConfig.scopes,
    };

    const mockTokenResponse = {
      tokens: {
        access_token: 'access-token-123',
        refresh_token: 'refresh-token-123',
        scope: 'https://www.googleapis.com/auth/youtube',
        token_type: 'Bearer',
        expiry_date: Date.now() + 3600000,
      },
    };

    beforeEach(() => {
      mockTokenStorage.consumeAuthState.mockResolvedValue(mockStoredState);
      mockOAuth2Client.getToken.mockResolvedValue(mockTokenResponse);
      mockTokenStorage.saveTokens.mockResolvedValue(undefined);
    });

    it('should complete authorization with valid code and state', async () => {
      const result: StoredToken = await oauthService.completeAuthorization(mockCode, mockState);

      expect(mockTokenStorage.consumeAuthState).toHaveBeenCalledWith(mockState);
      expect(mockOAuth2Client.getToken).toHaveBeenCalledWith({
        code: mockCode,
        codeVerifier: mockPKCE.verifier,
        redirect_uri: mockConfig.redirectUri,
      });

      expect(result).toEqual({
        accessToken: mockTokenResponse.tokens.access_token,
        refreshToken: mockTokenResponse.tokens.refresh_token,
        scope: mockTokenResponse.tokens.scope,
        tokenType: mockTokenResponse.tokens.token_type,
        expiryDate: mockTokenResponse.tokens.expiry_date,
        createdAt: expect.any(Number),
      });

      expect(mockTokenStorage.saveTokens).toHaveBeenCalledWith(result);
    });

    it('should throw error for invalid or expired state', async () => {
      mockTokenStorage.consumeAuthState.mockResolvedValue(null);

      await expect(oauthService.completeAuthorization(mockCode, 'invalid-state')).rejects.toThrow(
        'State token invalid or expired.'
      );
    });

    it('should throw error when no access token returned', async () => {
      const invalidTokenResponse = {
        tokens: {
          refresh_token: 'refresh-token-123',
        },
      };
      mockOAuth2Client.getToken.mockResolvedValue(invalidTokenResponse);

      await expect(oauthService.completeAuthorization(mockCode, mockState)).rejects.toThrow(
        'Google OAuth did not return an access token'
      );
    });
  });

  describe('Authorized Client Retrieval', () => {
    const mockStoredToken: StoredToken = {
      accessToken: 'access-token-123',
      refreshToken: 'refresh-token-123',
      scope: 'https://www.googleapis.com/auth/youtube',
      tokenType: 'Bearer',
      expiryDate: Date.now() + 3600000,
      createdAt: Date.now(),
    };

    it('should return authorized client with valid tokens', async () => {
      mockTokenStorage.getTokens.mockResolvedValue(mockStoredToken);

      const client = await oauthService.getAuthorizedClient();

      expect(mockTokenStorage.getTokens).toHaveBeenCalled();
      expect(mockOAuth2Client.setCredentials).toHaveBeenCalledWith({
        access_token: mockStoredToken.accessToken,
        refresh_token: mockStoredToken.refreshToken,
        scope: mockStoredToken.scope,
        token_type: mockStoredToken.tokenType,
        expiry_date: mockStoredToken.expiryDate,
      });
      expect(client).toBe(mockOAuth2Client);
    });

    it('should throw error when no tokens stored', async () => {
      mockTokenStorage.getTokens.mockResolvedValue(null);

      await expect(oauthService.getAuthorizedClient()).rejects.toThrow(
        'OAuth credentials not found. Run start_oauth_flow first.'
      );
    });

    it('should refresh tokens when near expiry', async () => {
      const nearExpiryToken: StoredToken = {
        ...mockStoredToken,
        expiryDate: Date.now() + 30000, // 30 seconds from now
      };
      mockTokenStorage.getTokens.mockResolvedValue(nearExpiryToken);

      // Mock refresh method
      const refreshSpy = vi.spyOn(oauthService, 'refreshTokens').mockResolvedValue(mockStoredToken);

      await oauthService.getAuthorizedClient();

      expect(refreshSpy).toHaveBeenCalled();
    });

    it('should not refresh tokens when not near expiry', async () => {
      const validToken: StoredToken = {
        ...mockStoredToken,
        expiryDate: Date.now() + 3600000, // 1 hour from now
      };
      mockTokenStorage.getTokens.mockResolvedValue(validToken);

      const refreshSpy = vi.spyOn(oauthService, 'refreshTokens').mockResolvedValue(mockStoredToken);

      await oauthService.getAuthorizedClient();

      expect(refreshSpy).not.toHaveBeenCalled();
    });
  });

  describe('Token Refresh', () => {
    const mockStoredToken: StoredToken = {
      accessToken: 'old-access-token',
      refreshToken: 'refresh-token-123',
      scope: 'https://www.googleapis.com/auth/youtube',
      tokenType: 'Bearer',
      expiryDate: Date.now() - 1000,
      createdAt: Date.now() - 3600000,
    };

    const mockRefreshedCredentials = {
      credentials: {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        scope: 'https://www.googleapis.com/auth/youtube',
        token_type: 'Bearer',
        expiry_date: Date.now() + 3600000,
      },
    };

    beforeEach(() => {
      mockTokenStorage.getTokens.mockResolvedValue(mockStoredToken);
      mockOAuth2Client.refreshAccessToken.mockResolvedValue(mockRefreshedCredentials);
      mockTokenStorage.saveTokens.mockResolvedValue(undefined);
    });

    it('should refresh tokens successfully', async () => {
      const result = await oauthService.refreshTokens();

      expect(mockOAuth2Client.refreshAccessToken).toHaveBeenCalled();
      expect(result).toEqual({
        accessToken: mockRefreshedCredentials.credentials.access_token,
        refreshToken: mockRefreshedCredentials.credentials.refresh_token,
        scope: mockRefreshedCredentials.credentials.scope,
        tokenType: mockRefreshedCredentials.credentials.token_type,
        expiryDate: mockRefreshedCredentials.credentials.expiry_date,
        createdAt: expect.any(Number),
      });
      expect(mockTokenStorage.saveTokens).toHaveBeenCalledWith(result);
    });

    it('should fallback to stored values when refresh returns partial data', async () => {
      const partialRefresh = {
        credentials: {
          access_token: 'new-access-token',
          // Missing other fields
        },
      };
      mockOAuth2Client.refreshAccessToken.mockResolvedValue(partialRefresh);

      const result = await oauthService.refreshTokens();

      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBe(mockStoredToken.refreshToken);
      expect(result.scope).toBe(mockStoredToken.scope);
      expect(result.tokenType).toBe(mockStoredToken.tokenType);
      expect(result.expiryDate).toBe(mockStoredToken.expiryDate);
    });

    it('should handle refresh errors gracefully', async () => {
      mockOAuth2Client.refreshAccessToken.mockRejectedValue(new Error('Refresh failed'));

      await expect(oauthService.refreshTokens()).rejects.toThrow('Refresh failed');
    });
  });

  describe('Error Handling', () => {
    it('should handle OAuth2 client creation errors', () => {
      mockOAuthConfig.getConfig.mockImplementation(() => {
        throw new Error('Config error');
      });

      expect(() => oauthService.generateAuthorizationUrl()).rejects.toThrow('Config error');
    });

    it('should handle token storage errors during auth completion', async () => {
      mockTokenStorage.consumeAuthState.mockResolvedValue({
        state: mockState,
        verifier: mockPKCE.verifier,
        createdAt: Date.now(),
        redirectUri: mockConfig.redirectUri,
        scopes: mockConfig.scopes,
      });
      mockOAuth2Client.getToken.mockResolvedValue({
        tokens: { access_token: 'test-token' },
      });
      mockTokenStorage.saveTokens.mockRejectedValue(new Error('Storage error'));

      await expect(oauthService.completeAuthorization('code', mockState)).rejects.toThrow(
        'Storage error'
      );
    });
  });
});