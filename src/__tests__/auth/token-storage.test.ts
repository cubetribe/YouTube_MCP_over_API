import { beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { TokenStorage, type StoredToken, type StoredAuthState } from '../../auth/token-storage.js';
import { oauthConfig } from '../../auth/oauth-config.js';

// Mock the oauth-config module
vi.mock('../../auth/oauth-config.js', () => ({
  oauthConfig: {
    encryptionEnabled: vi.fn(() => false),
    encrypt: vi.fn((data: string) => data),
    decrypt: vi.fn((data: string) => data),
  },
}));

// Mock fs module
vi.mock('fs/promises');

describe('TokenStorage', () => {
  let tokenStorage: TokenStorage;
  const mockFs = vi.mocked(fs);
  const mockOauthConfig = vi.mocked(oauthConfig);

  const sampleToken: StoredToken = {
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
    scope: 'test-scope',
    tokenType: 'Bearer',
    expiryDate: Date.now() + 3600000,
    createdAt: Date.now(),
  };

  const sampleAuthState: StoredAuthState = {
    state: 'test-state',
    verifier: 'test-verifier',
    createdAt: Date.now(),
    redirectUri: 'http://localhost:3000/callback',
    scopes: ['https://www.googleapis.com/auth/youtube'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.rm.mockResolvedValue(undefined);
    mockOauthConfig.encryptionEnabled.mockReturnValue(false);
    mockOauthConfig.encrypt.mockImplementation((data: string) => data);
    mockOauthConfig.decrypt.mockImplementation((data: string) => data);

    tokenStorage = new TokenStorage();
  });

  describe('Token Operations', () => {
    it('should save tokens to file system', async () => {
      await tokenStorage.saveTokens(sampleToken);

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('tokens'),
        { recursive: true }
      );
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('oauth_tokens.json'),
        JSON.stringify(sampleToken, null, 2),
        'utf-8'
      );
    });

    it('should encrypt tokens when encryption is enabled', async () => {
      mockOauthConfig.encryptionEnabled.mockReturnValue(true);
      mockOauthConfig.encrypt.mockReturnValue('encrypted-data');

      await tokenStorage.saveTokens(sampleToken);

      expect(mockOauthConfig.encrypt).toHaveBeenCalledWith(JSON.stringify(sampleToken));
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('oauth_tokens.json'),
        'encrypted-data',
        'utf-8'
      );
    });

    it('should retrieve tokens from cache if available', async () => {
      // Save token first to populate cache
      await tokenStorage.saveTokens(sampleToken);

      const retrievedToken = await tokenStorage.getTokens();

      expect(retrievedToken).toEqual(sampleToken);
      expect(mockFs.readFile).not.toHaveBeenCalled();
    });

    it('should retrieve tokens from file system if not in cache', async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify(sampleToken));

      const retrievedToken = await tokenStorage.getTokens();

      expect(mockFs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('oauth_tokens.json'),
        'utf-8'
      );
      expect(retrievedToken).toEqual(sampleToken);
    });

    it('should decrypt tokens when encryption is enabled', async () => {
      mockOauthConfig.encryptionEnabled.mockReturnValue(true);
      mockOauthConfig.decrypt.mockReturnValue(JSON.stringify(sampleToken));
      mockFs.readFile.mockResolvedValue('encrypted-data');

      const retrievedToken = await tokenStorage.getTokens();

      expect(mockOauthConfig.decrypt).toHaveBeenCalledWith('encrypted-data');
      expect(retrievedToken).toEqual(sampleToken);
    });

    it('should return null if token file does not exist', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      const retrievedToken = await tokenStorage.getTokens();

      expect(retrievedToken).toBeNull();
    });

    it('should remove tokens and clear cache', async () => {
      // Save token first
      await tokenStorage.saveTokens(sampleToken);

      await tokenStorage.removeTokens();

      expect(mockFs.rm).toHaveBeenCalledWith(
        expect.stringContaining('oauth_tokens.json'),
        { force: true }
      );

      // Cache should be cleared
      const retrievedToken = await tokenStorage.getTokens();
      expect(mockFs.readFile).toHaveBeenCalled(); // Should try to read from file
    });
  });

  describe('Auth State Operations', () => {
    it('should save auth state to file system', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found')); // No existing states

      await tokenStorage.saveAuthState(sampleAuthState);

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('tokens'),
        { recursive: true }
      );
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('oauth_states.json'),
        expect.stringContaining(sampleAuthState.state),
        'utf-8'
      );
    });

    it('should load and merge existing auth states', async () => {
      const existingState = {
        'existing-state': {
          state: 'existing-state',
          verifier: 'existing-verifier',
          createdAt: Date.now(),
          redirectUri: 'http://localhost:3000/callback',
          scopes: ['scope1'],
        },
      };
      mockFs.readFile.mockResolvedValue(JSON.stringify(existingState));

      await tokenStorage.saveAuthState(sampleAuthState);

      // Should write both states
      const writeCall = mockFs.writeFile.mock.calls.find(call =>
        call[0].toString().includes('oauth_states.json')
      );
      expect(writeCall).toBeDefined();
      const writtenData = JSON.parse(writeCall![1] as string);
      expect(writtenData).toHaveProperty('existing-state');
      expect(writtenData).toHaveProperty(sampleAuthState.state);
    });

    it('should consume auth state and remove it from storage', async () => {
      const states = {
        [sampleAuthState.state]: sampleAuthState,
        'other-state': {
          state: 'other-state',
          verifier: 'other-verifier',
          createdAt: Date.now(),
          redirectUri: 'http://localhost:3000/callback',
          scopes: ['scope1'],
        },
      };
      mockFs.readFile.mockResolvedValue(JSON.stringify(states));

      const consumedState = await tokenStorage.consumeAuthState(sampleAuthState.state);

      expect(consumedState).toEqual(sampleAuthState);

      // Should write remaining states without the consumed one
      const writeCall = mockFs.writeFile.mock.calls.find(call =>
        call[0].toString().includes('oauth_states.json')
      );
      expect(writeCall).toBeDefined();
      const writtenData = JSON.parse(writeCall![1] as string);
      expect(writtenData).not.toHaveProperty(sampleAuthState.state);
      expect(writtenData).toHaveProperty('other-state');
    });

    it('should return null for non-existent auth state', async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify({}));

      const consumedState = await tokenStorage.consumeAuthState('non-existent-state');

      expect(consumedState).toBeNull();
    });

    it('should clean up expired auth states on load', async () => {
      const now = Date.now();
      const expiredState = {
        'expired-state': {
          state: 'expired-state',
          verifier: 'expired-verifier',
          createdAt: now - 10 * 60 * 1000, // 10 minutes ago (expired)
          redirectUri: 'http://localhost:3000/callback',
          scopes: ['scope1'],
        },
        'valid-state': {
          state: 'valid-state',
          verifier: 'valid-verifier',
          createdAt: now - 2 * 60 * 1000, // 2 minutes ago (valid)
          redirectUri: 'http://localhost:3000/callback',
          scopes: ['scope1'],
        },
      };
      mockFs.readFile.mockResolvedValue(JSON.stringify(expiredState));

      await tokenStorage.saveAuthState(sampleAuthState);

      // Should have cleaned up expired state
      const writeCall = mockFs.writeFile.mock.calls.find(call =>
        call[0].toString().includes('oauth_states.json')
      );
      expect(writeCall).toBeDefined();
      const writtenData = JSON.parse(writeCall![1] as string);
      expect(writtenData).not.toHaveProperty('expired-state');
      expect(writtenData).toHaveProperty('valid-state');
      expect(writtenData).toHaveProperty(sampleAuthState.state);
    });

    it('should handle missing states file gracefully', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      await tokenStorage.saveAuthState(sampleAuthState);

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('oauth_states.json'),
        expect.stringContaining(sampleAuthState.state),
        'utf-8'
      );
    });
  });

  describe('File Path Configuration', () => {
    it('should use custom storage directory from environment variable', () => {
      const originalEnv = process.env.OAUTH_STORAGE_DIR;
      process.env.OAUTH_STORAGE_DIR = '/custom/path';

      const customTokenStorage = new TokenStorage();

      // Verify custom path is used by checking the mkdir call
      customTokenStorage.saveTokens(sampleToken);

      expect(mockFs.mkdir).toHaveBeenCalledWith('/custom/path', { recursive: true });

      process.env.OAUTH_STORAGE_DIR = originalEnv;
    });

    it('should use default tokens directory when no environment variable set', async () => {
      await tokenStorage.saveTokens(sampleToken);

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('tokens'),
        { recursive: true }
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle file write errors gracefully', async () => {
      mockFs.writeFile.mockRejectedValue(new Error('Write permission denied'));

      await expect(tokenStorage.saveTokens(sampleToken)).rejects.toThrow('Write permission denied');
    });

    it('should handle file read errors gracefully for tokens', async () => {
      mockFs.readFile.mockRejectedValue(new Error('Read permission denied'));

      const result = await tokenStorage.getTokens();
      expect(result).toBeNull();
    });

    it('should handle JSON parsing errors gracefully', async () => {
      mockFs.readFile.mockResolvedValue('invalid json');

      const result = await tokenStorage.getTokens();
      expect(result).toBeNull();
    });
  });
});