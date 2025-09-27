import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { oauthConfig } from './oauth-config.js';
import { getStoragePaths } from '../config/index.js';

export interface StoredToken {
  accessToken: string;
  refreshToken?: string;
  scope?: string;
  tokenType?: string;
  expiryDate?: number;
  createdAt: number;
}

export interface StoredAuthState {
  state: string;
  verifier: string;
  createdAt: number;
  redirectUri: string;
  scopes: string[];
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

// Use new configuration system with fallback
function getTokenDirectory(): string {
  try {
    return getStoragePaths().tokenDir;
  } catch (error) {
    // Fallback to old environment variable method
    return process.env['OAUTH_STORAGE_DIR'] || path.join(PROJECT_ROOT, 'tokens');
  }
}

const TOKEN_DIR = getTokenDirectory();
const TOKEN_FILE = path.join(TOKEN_DIR, 'oauth_tokens.json');
const STATE_FILE = path.join(TOKEN_DIR, 'oauth_states.json');
const AUTH_STATE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export class TokenStorage {
  private cache: StoredToken | null = null;
  private states: Record<string, StoredAuthState> = {};

  constructor() {
    void this.loadStates();
  }

  async saveTokens(tokens: StoredToken): Promise<void> {
    await fs.mkdir(TOKEN_DIR, { recursive: true });
    this.cache = tokens;
    const payload = oauthConfig.encryptionEnabled()
      ? oauthConfig.encrypt(JSON.stringify(tokens))
      : JSON.stringify(tokens, null, 2);
    await fs.writeFile(TOKEN_FILE, payload, 'utf-8');
  }

  async getTokens(): Promise<StoredToken | null> {
    if (this.cache) return this.cache;
    try {
      const raw = await fs.readFile(TOKEN_FILE, 'utf-8');
      const json = oauthConfig.encryptionEnabled() ? oauthConfig.decrypt(raw) : raw;
      const parsed = JSON.parse(json) as StoredToken;
      this.cache = parsed;
      return parsed;
    } catch {
      return null;
    }
  }

  async removeTokens(): Promise<void> {
    this.cache = null;
    await fs.rm(TOKEN_FILE, { force: true });
  }

  async saveAuthState(state: StoredAuthState): Promise<void> {
    await fs.mkdir(TOKEN_DIR, { recursive: true });
    await this.loadStates();
    this.states[state.state] = state;
    await this.persistStates();
  }

  async consumeAuthState(stateKey: string): Promise<StoredAuthState | null> {
    await this.loadStates();
    const state = this.states[stateKey];
    if (!state) return null;
    delete this.states[stateKey];
    await this.persistStates();
    return state;
  }

  private async loadStates(): Promise<void> {
    try {
      const raw = await fs.readFile(STATE_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as Record<string, StoredAuthState>;
      const now = Date.now();
      this.states = Object.fromEntries(
        Object.entries(parsed).filter(([, value]) => now - value.createdAt < AUTH_STATE_TTL_MS)
      );
      if (Object.keys(this.states).length !== Object.keys(parsed).length) {
        await this.persistStates();
      }
    } catch {
      this.states = {};
    }
  }

  private async persistStates(): Promise<void> {
    await fs.writeFile(STATE_FILE, JSON.stringify(this.states, null, 2), 'utf-8');
  }
}

export const tokenStorage = new TokenStorage();
