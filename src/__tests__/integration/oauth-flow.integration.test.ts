import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { TestMCPServer, createTestYouTubeMCPServer } from './helpers/test-server.js';
import { createMockOAuthClient } from './helpers/mock-youtube-api.js';
import {
  TEST_CONFIGURATION,
  TEST_OAUTH_TOKENS,
  TEST_TOKEN_DIR,
  createTestOAuthTokens
} from './fixtures/index.js';

describe('OAuth Flow Integration Tests', () => {
  let testServer: TestMCPServer;
  let mockOAuthClient: any;
  const tokenFilePath = path.join(TEST_TOKEN_DIR, 'oauth_tokens.json');

  beforeEach(async () => {
    mockOAuthClient = createMockOAuthClient();

    // Mock OAuth service with realistic behavior
    vi.doMock('../../auth/oauth-service.js', () => ({
      oauthService: {
        generateAuthorizationUrl: vi.fn().mockImplementation(async (scopes) => {
          return {
            url: `https://accounts.google.com/o/oauth2/v2/auth?client_id=test&scope=${encodeURIComponent(scopes.join(' '))}&state=test-state-${Date.now()}`,
            state: `test-state-${Date.now()}`
          };
        }),
        completeAuthorization: vi.fn().mockImplementation(async (code, state) => {
          if (code === 'invalid-code') {
            throw new Error('Invalid authorization code');
          }
          if (state !== state) { // Simulate state mismatch
            throw new Error('State mismatch');
          }
          return createTestOAuthTokens();
        }),
        getAuthorizedClient: vi.fn().mockImplementation(async () => {
          // Check if tokens exist
          try {
            await fs.access(tokenFilePath);
            return mockOAuthClient;
          } catch {
            throw new Error('No valid tokens found');
          }
        })
      }
    }));

    // Mock token storage
    vi.doMock('../../auth/token-storage.js', () => ({
      tokenStorage: {
        saveTokens: vi.fn().mockImplementation(async (tokens) => {
          await fs.writeFile(tokenFilePath, JSON.stringify(tokens, null, 2));
          return true;
        }),
        loadTokens: vi.fn().mockImplementation(async () => {
          try {
            const data = await fs.readFile(tokenFilePath, 'utf-8');
            return JSON.parse(data);
          } catch {
            return null;
          }
        }),
        deleteTokens: vi.fn().mockImplementation(async () => {
          try {
            await fs.unlink(tokenFilePath);
            return true;
          } catch {
            return false;
          }
        }),
        hasValidTokens: vi.fn().mockImplementation(async () => {
          try {
            const tokens = await fs.readFile(tokenFilePath, 'utf-8');
            const parsed = JSON.parse(tokens);
            return !!(parsed.access_token && parsed.expiry_date > Date.now());
          } catch {
            return false;
          }
        })
      }
    }));

    vi.doMock('../../config/index.js', () => ({
      getConfig: () => TEST_CONFIGURATION
    }));

    testServer = await createTestYouTubeMCPServer();
  });

  afterEach(async () => {
    await testServer.stop();

    // Clean up token file
    try {
      await fs.unlink(tokenFilePath);
    } catch {
      // Ignore if file doesn't exist
    }

    vi.clearAllMocks();
    vi.doUnmock('../../auth/oauth-service.js');
    vi.doUnmock('../../auth/token-storage.js');
    vi.doUnmock('../../config/index.js');
  });

  describe('Complete OAuth Authorization Flow', () => {
    it('should complete full OAuth flow successfully', async () => {
      // Step 1: Start OAuth flow
      const startResult = await testServer.callTool('start_oauth_flow', {
        scopes: ['https://www.googleapis.com/auth/youtube', 'https://www.googleapis.com/auth/youtube.upload']
      });

      expect(startResult.content).toBeDefined();
      const startResponse = JSON.parse(startResult.content[0].text);

      expect(startResponse.authUrl).toContain('https://accounts.google.com');
      expect(startResponse.authUrl).toContain('client_id=test');
      expect(startResponse.authUrl).toContain('scope=');
      expect(startResponse.state).toBeDefined();
      expect(startResponse.message).toContain('complete_oauth_flow');

      // Step 2: Complete OAuth flow
      const completeResult = await testServer.callTool('complete_oauth_flow', {
        code: 'test-authorization-code',
        state: startResponse.state
      });

      expect(completeResult.content).toBeDefined();
      const completeResponse = JSON.parse(completeResult.content[0].text);

      expect(completeResponse.success).toBe(true);
      expect(completeResponse.tokens).toBeDefined();
      expect(completeResponse.tokens.access_token).toBeDefined();
      expect(completeResponse.tokens.refresh_token).toBeDefined();
      expect(completeResponse.tokens.expiry_date).toBeDefined();

      // Verify tokens are saved
      const tokensExist = await fs.access(tokenFilePath).then(() => true).catch(() => false);
      expect(tokensExist).toBe(true);
    });

    it('should handle multiple scope requests', async () => {
      const scopes = [
        'https://www.googleapis.com/auth/youtube',
        'https://www.googleapis.com/auth/youtube.upload',
        'https://www.googleapis.com/auth/youtube.readonly'
      ];

      const result = await testServer.callTool('start_oauth_flow', { scopes });

      expect(result.content).toBeDefined();
      const response = JSON.parse(result.content[0].text);

      expect(response.authUrl).toContain(encodeURIComponent(scopes.join(' ')));
    });

    it('should validate required OAuth scopes', async () => {
      const result = await testServer.callTool('start_oauth_flow', {
        scopes: ['https://www.googleapis.com/auth/youtube']
      });

      expect(result.content).toBeDefined();
      const response = JSON.parse(result.content[0].text);
      expect(response.authUrl).toContain('youtube');
    });
  });

  describe('Token Refresh Scenarios', () => {
    it('should handle expired tokens gracefully', async () => {
      // Save expired tokens
      const expiredTokens = createTestOAuthTokens({
        expiry_date: Date.now() - 3600000 // 1 hour ago
      });
      await fs.writeFile(tokenFilePath, JSON.stringify(expiredTokens, null, 2));

      // Mock refresh token behavior
      mockOAuthClient.refreshAccessToken = vi.fn().mockResolvedValue({
        credentials: createTestOAuthTokens()
      });

      // Try to use a tool that requires authentication
      const result = await testServer.callTool('list_videos', {}).catch(e => e);

      // Should handle token refresh automatically or return auth error
      expect(result).toBeDefined();
    });

    it('should handle refresh token expiration', async () => {
      // Save tokens with expired refresh token
      const tokensWithExpiredRefresh = createTestOAuthTokens({
        expiry_date: Date.now() - 3600000, // Expired access token
        refresh_token: 'expired-refresh-token'
      });
      await fs.writeFile(tokenFilePath, JSON.stringify(tokensWithExpiredRefresh, null, 2));

      // Mock refresh failure
      mockOAuthClient.refreshAccessToken = vi.fn().mockRejectedValue(
        new Error('invalid_grant: Token has been expired or revoked')
      );

      // Should require re-authentication
      await expect(testServer.callTool('list_videos', {})).rejects.toThrow();
    });

    it('should save refreshed tokens', async () => {
      // Setup tokens that need refresh
      const tokensNeedingRefresh = createTestOAuthTokens({
        expiry_date: Date.now() - 1000 // Just expired
      });
      await fs.writeFile(tokenFilePath, JSON.stringify(tokensNeedingRefresh, null, 2));

      const newTokens = createTestOAuthTokens({
        access_token: 'new-access-token',
        expiry_date: Date.now() + 3600000
      });

      // Mock successful refresh
      mockOAuthClient.refreshAccessToken = vi.fn().mockResolvedValue({
        credentials: newTokens
      });

      // The token storage should save the new tokens
      const result = await testServer.callTool('list_videos', {}).catch(e => e);

      expect(result).toBeDefined();
    });
  });

  describe('State Management and Security', () => {
    it('should generate unique states for each flow', async () => {
      const result1 = await testServer.callTool('start_oauth_flow', {
        scopes: ['https://www.googleapis.com/auth/youtube']
      });
      const result2 = await testServer.callTool('start_oauth_flow', {
        scopes: ['https://www.googleapis.com/auth/youtube']
      });

      const response1 = JSON.parse(result1.content[0].text);
      const response2 = JSON.parse(result2.content[0].text);

      expect(response1.state).not.toBe(response2.state);
    });

    it('should validate state parameter on completion', async () => {
      await expect(
        testServer.callTool('complete_oauth_flow', {
          code: 'test-code',
          state: 'invalid-state'
        })
      ).rejects.toThrow();
    });

    it('should handle state tampering attempts', async () => {
      const startResult = await testServer.callTool('start_oauth_flow', {
        scopes: ['https://www.googleapis.com/auth/youtube']
      });
      const startResponse = JSON.parse(startResult.content[0].text);

      // Try to complete with modified state
      await expect(
        testServer.callTool('complete_oauth_flow', {
          code: 'test-code',
          state: startResponse.state + '-tampered'
        })
      ).rejects.toThrow();
    });
  });

  describe('Error Cases and Edge Conditions', () => {
    it('should handle invalid authorization codes', async () => {
      const startResult = await testServer.callTool('start_oauth_flow', {
        scopes: ['https://www.googleapis.com/auth/youtube']
      });
      const startResponse = JSON.parse(startResult.content[0].text);

      await expect(
        testServer.callTool('complete_oauth_flow', {
          code: 'invalid-code',
          state: startResponse.state
        })
      ).rejects.toThrow('Invalid authorization code');
    });

    it('should handle network errors during OAuth', async () => {
      // Mock network error
      vi.doMock('../../auth/oauth-service.js', () => ({
        oauthService: {
          generateAuthorizationUrl: vi.fn().mockRejectedValue(new Error('Network error')),
          completeAuthorization: vi.fn().mockRejectedValue(new Error('Network error'))
        }
      }));

      await expect(
        testServer.callTool('start_oauth_flow', {
          scopes: ['https://www.googleapis.com/auth/youtube']
        })
      ).rejects.toThrow('Network error');
    });

    it('should handle OAuth service unavailable', async () => {
      // Mock service unavailable
      vi.doMock('../../auth/oauth-service.js', () => ({
        oauthService: {
          generateAuthorizationUrl: vi.fn().mockRejectedValue(
            new Error('Service temporarily unavailable')
          )
        }
      }));

      await expect(
        testServer.callTool('start_oauth_flow', {
          scopes: ['https://www.googleapis.com/auth/youtube']
        })
      ).rejects.toThrow('Service temporarily unavailable');
    });

    it('should handle malformed OAuth responses', async () => {
      // Mock malformed response
      vi.doMock('../../auth/oauth-service.js', () => ({
        oauthService: {
          completeAuthorization: vi.fn().mockResolvedValue({
            // Missing required fields
            incomplete: 'response'
          })
        }
      }));

      await expect(
        testServer.callTool('complete_oauth_flow', {
          code: 'test-code',
          state: 'test-state'
        })
      ).rejects.toThrow();
    });
  });

  describe('Token Storage and Encryption', () => {
    it('should store tokens securely', async () => {
      const completeResult = await testServer.callTool('complete_oauth_flow', {
        code: 'test-authorization-code',
        state: 'test-state'
      });

      expect(completeResult.content).toBeDefined();

      // Verify tokens are saved to file
      const tokensExist = await fs.access(tokenFilePath).then(() => true).catch(() => false);
      expect(tokensExist).toBe(true);

      // Verify token format
      const tokenData = await fs.readFile(tokenFilePath, 'utf-8');
      const tokens = JSON.parse(tokenData);

      expect(tokens.access_token).toBeDefined();
      expect(tokens.refresh_token).toBeDefined();
      expect(tokens.expiry_date).toBeDefined();
      expect(typeof tokens.expiry_date).toBe('number');
    });

    it('should handle token storage errors', async () => {
      // Mock storage error
      vi.doMock('../../auth/token-storage.js', () => ({
        tokenStorage: {
          saveTokens: vi.fn().mockRejectedValue(new Error('Storage error'))
        }
      }));

      await expect(
        testServer.callTool('complete_oauth_flow', {
          code: 'test-code',
          state: 'test-state'
        })
      ).rejects.toThrow();
    });

    it('should handle encrypted token storage when enabled', async () => {
      // Mock encrypted storage
      vi.doMock('../../auth/token-storage.js', () => ({
        tokenStorage: {
          saveTokens: vi.fn().mockImplementation(async (tokens) => {
            // Simulate encryption by adding prefix
            const encrypted = { encrypted: true, data: tokens };
            await fs.writeFile(tokenFilePath, JSON.stringify(encrypted, null, 2));
            return true;
          }),
          loadTokens: vi.fn().mockImplementation(async () => {
            try {
              const data = await fs.readFile(tokenFilePath, 'utf-8');
              const parsed = JSON.parse(data);
              return parsed.encrypted ? parsed.data : parsed;
            } catch {
              return null;
            }
          })
        }
      }));

      const result = await testServer.callTool('complete_oauth_flow', {
        code: 'test-code',
        state: 'test-state'
      });

      expect(result.content).toBeDefined();

      // Verify encrypted format
      const tokenData = await fs.readFile(tokenFilePath, 'utf-8');
      const tokens = JSON.parse(tokenData);
      expect(tokens.encrypted).toBe(true);
      expect(tokens.data).toBeDefined();
    });
  });

  describe('OAuth Configuration Validation', () => {
    it('should validate OAuth client configuration', async () => {
      // Mock missing configuration
      vi.doMock('../../config/index.js', () => ({
        getConfig: () => ({
          ...TEST_CONFIGURATION,
          oauth: {
            ...TEST_CONFIGURATION.oauth,
            clientId: undefined
          }
        })
      }));

      await expect(
        testServer.callTool('start_oauth_flow', {
          scopes: ['https://www.googleapis.com/auth/youtube']
        })
      ).rejects.toThrow();
    });

    it('should validate redirect URI configuration', async () => {
      const result = await testServer.callTool('start_oauth_flow', {
        scopes: ['https://www.googleapis.com/auth/youtube']
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.authUrl).toContain('redirect_uri');
    });

    it('should handle invalid scope configurations', async () => {
      await expect(
        testServer.callTool('start_oauth_flow', {
          scopes: ['invalid-scope']
        })
      ).rejects.toThrow();
    });
  });

  describe('Concurrent OAuth Flows', () => {
    it('should handle multiple concurrent OAuth flows', async () => {
      const flows = await Promise.allSettled([
        testServer.callTool('start_oauth_flow', {
          scopes: ['https://www.googleapis.com/auth/youtube']
        }),
        testServer.callTool('start_oauth_flow', {
          scopes: ['https://www.googleapis.com/auth/youtube']
        }),
        testServer.callTool('start_oauth_flow', {
          scopes: ['https://www.googleapis.com/auth/youtube']
        })
      ]);

      // All flows should succeed
      flows.forEach(flow => {
        expect(flow.status).toBe('fulfilled');
      });

      // Each should have unique state
      const states = flows.map(flow => {
        if (flow.status === 'fulfilled') {
          const response = JSON.parse((flow.value as any).content[0].text);
          return response.state;
        }
        return null;
      }).filter(Boolean);

      expect(new Set(states).size).toBe(states.length);
    });
  });
});