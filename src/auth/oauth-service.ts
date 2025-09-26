import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import { oauthConfig } from './oauth-config.js';
import { tokenStorage, type StoredAuthState, type StoredToken } from './token-storage.js';

export interface AuthorizationUrlResult {
  url: string;
  state: string;
  verifier: string;
  scopes: string[];
}

export class OAuthService {
  private client: OAuth2Client;

  constructor() {
    const config = oauthConfig.getConfig();
    this.client = new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri);
  }

  async generateAuthorizationUrl(scopes?: string[]): Promise<AuthorizationUrlResult> {
    const config = oauthConfig.getConfig();
    const resolvedScopes = oauthConfig.parseScopes(scopes);
    const pkce = oauthConfig.generatePKCEPair();
    const state = oauthConfig.generateState();

    const url = this.client.generateAuthUrl({
      access_type: 'offline',
      scope: resolvedScopes,
      prompt: 'consent',
      state,
      code_challenge: pkce.challenge,
      code_challenge_method: 'S256' as any,
    });

    const statePayload: StoredAuthState = {
      state,
      verifier: pkce.verifier,
      createdAt: Date.now(),
      redirectUri: config.redirectUri,
      scopes: resolvedScopes,
    };

    await tokenStorage.saveAuthState(statePayload);

    return { url, state, verifier: pkce.verifier, scopes: resolvedScopes };
  }

  async completeAuthorization(code: string, state: string): Promise<StoredToken> {
    const stored = await tokenStorage.consumeAuthState(state);
    if (!stored) {
      throw new Error('State token invalid or expired.');
    }

    const { tokens } = await this.client.getToken({
      code,
      codeVerifier: stored.verifier,
      redirect_uri: stored.redirectUri,
    });

    if (!tokens.access_token) {
      throw new Error('Google OAuth did not return an access token');
    }

    const payload: StoredToken = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      scope: tokens.scope,
      tokenType: tokens.token_type,
      expiryDate: tokens.expiry_date,
      createdAt: Date.now(),
    };

    await tokenStorage.saveTokens(payload);
    return payload;
  }

  async getAuthorizedClient(): Promise<OAuth2Client> {
    const tokens = await tokenStorage.getTokens();
    if (!tokens) {
      throw new Error('OAuth credentials not found. Run start_oauth_flow first.');
    }

    this.client.setCredentials({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      scope: tokens.scope,
      token_type: tokens.tokenType,
      expiry_date: tokens.expiryDate,
    });

    const buffer = 60_000; // 1 minute refresh buffer
    if (tokens.expiryDate && tokens.expiryDate - buffer < Date.now()) {
      await this.refreshTokens();
    }

    return this.client;
  }

  async refreshTokens(): Promise<StoredToken> {
    const { credentials } = await this.client.refreshAccessToken();
    const fallback = await tokenStorage.getTokens();
    const payload: StoredToken = {
      accessToken: credentials.access_token || fallback?.accessToken || '',
      refreshToken: credentials.refresh_token || fallback?.refreshToken,
      scope: credentials.scope || fallback?.scope,
      tokenType: credentials.token_type || fallback?.tokenType,
      expiryDate: credentials.expiry_date || fallback?.expiryDate,
      createdAt: Date.now(),
    };

    await tokenStorage.saveTokens(payload);
    return payload;
  }
}

export const oauthService = new OAuthService();
