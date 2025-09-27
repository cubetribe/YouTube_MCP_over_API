# Security Documentation

## Overview

YouTube MCP Extended implements comprehensive security measures to protect user data, API credentials, and system integrity. This document outlines the security architecture, implementation details, and best practices.

## Security Architecture

### Security Layers

```
┌─────────────────────────────────────────────────────────────┐
│                   Application Layer                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │  Input Validation│  │   Authorization │  │  Rate Limiting│ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                     Protocol Layer                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │  OAuth 2.0 PKCE │  │  Token Encryption│  │  HTTPS/TLS   │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                     Storage Layer                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │  File Encryption │  │  Secure Paths   │  │  Access Control│ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Security Principles

1. **Defense in Depth**: Multiple security layers
2. **Least Privilege**: Minimal required permissions
3. **Secure by Default**: Secure configurations by default
4. **Zero Trust**: Verify all requests and access
5. **Data Minimization**: Collect only necessary data
6. **Encryption Everywhere**: Encrypt data at rest and in transit

## Authentication and Authorization

### OAuth 2.0 Implementation

#### PKCE (Proof Key for Code Exchange)

```typescript
// OAuth service with PKCE implementation
export class OAuthService {
  async generateAuthorizationUrl(scopes?: string[]): Promise<AuthUrlResult> {
    // Generate cryptographically secure PKCE parameters
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = await this.generateCodeChallenge(codeVerifier);
    const state = this.generateState();

    // Store PKCE parameters securely
    await this.storePKCEParameters(state, codeVerifier);

    const authUrl = this.buildAuthUrl({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: scopes?.join(' ') || this.config.defaultScopes.join(' '),
      response_type: 'code',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      access_type: 'offline'
    });

    return {
      url: authUrl,
      state,
      codeVerifier // Store securely, don't expose to client
    };
  }

  private generateCodeVerifier(): string {
    // Generate cryptographically secure random string
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return base64URLEncode(array);
  }

  private async generateCodeChallenge(verifier: string): Promise<string> {
    // SHA256 hash of code verifier
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return base64URLEncode(new Uint8Array(digest));
  }

  private generateState(): string {
    // Generate cryptographically secure state parameter
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return base64URLEncode(array);
  }
}
```

#### Token Security

```typescript
// Secure token handling
export class TokenStorage {
  constructor(private config: SecurityConfig) {}

  async saveTokens(tokens: Credentials): Promise<void> {
    if (this.config.encryptionSecret) {
      const encrypted = await this.encryptTokens(tokens);
      await this.writeToFile(encrypted);
    } else {
      // Development mode warning
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️  Tokens stored unencrypted in development mode');
      }
      await this.writeToFile(tokens);
    }
  }

  private async encryptTokens(tokens: Credentials): Promise<EncryptedData> {
    const key = await this.deriveKey(this.config.encryptionSecret!);
    const iv = crypto.getRandomValues(new Uint8Array(12)); // GCM IV
    const data = new TextEncoder().encode(JSON.stringify(tokens));

    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );

    return {
      data: Array.from(new Uint8Array(encrypted)),
      iv: Array.from(iv),
      algorithm: 'AES-GCM'
    };
  }

  private async deriveKey(secret: string): Promise<CryptoKey> {
    // Derive encryption key from secret using PBKDF2
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode('youtube-mcp-salt'), // Use proper salt in production
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }
}
```

### Scope Management

```typescript
// OAuth scope validation and management
export class ScopeManager {
  private readonly requiredScopes = [
    'https://www.googleapis.com/auth/youtube',
    'https://www.googleapis.com/auth/youtube.force-ssl'
  ];

  private readonly optionalScopes = [
    'https://www.googleapis.com/auth/youtube.readonly'
  ];

  validateScopes(requestedScopes: string[]): ScopeValidationResult {
    const missing = this.requiredScopes.filter(
      scope => !requestedScopes.includes(scope)
    );

    const unauthorized = requestedScopes.filter(
      scope => !this.isAllowedScope(scope)
    );

    return {
      valid: missing.length === 0 && unauthorized.length === 0,
      missing,
      unauthorized,
      approved: requestedScopes.filter(scope => this.isAllowedScope(scope))
    };
  }

  private isAllowedScope(scope: string): boolean {
    return [...this.requiredScopes, ...this.optionalScopes].includes(scope);
  }
}
```

## Input Validation and Sanitization

### Zod Schema Validation

```typescript
// Comprehensive input validation
export const SecureVideoMetadataSchema = z.object({
  title: z.string()
    .min(1, 'Title is required')
    .max(100, 'Title must be 100 characters or less')
    .regex(/^[^<>\"&]*$/, 'Title contains invalid characters'),

  description: z.string()
    .max(5000, 'Description must be 5000 characters or less')
    .transform(str => this.sanitizeDescription(str)),

  tags: z.array(
    z.string()
      .min(1, 'Tag cannot be empty')
      .max(500, 'Tag must be 500 characters or less')
      .regex(/^[^<>\"&]*$/, 'Tag contains invalid characters')
  ).max(500, 'Maximum 500 tags allowed'),

  categoryId: z.string()
    .regex(/^\d+$/, 'Category ID must be numeric')
    .refine(id => this.isValidCategoryId(id), 'Invalid category ID'),

  privacyStatus: z.enum(['private', 'unlisted', 'public'])
});

// Input sanitization utilities
export class InputSanitizer {
  static sanitizeDescription(description: string): string {
    // Remove potential XSS vectors
    return description
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .trim();
  }

  static sanitizeVideoId(videoId: string): string {
    // YouTube video IDs are 11 characters, alphanumeric + - and _
    if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      throw new ValidationError('Invalid video ID format', 'videoId', videoId);
    }
    return videoId;
  }

  static sanitizePlaylistId(playlistId: string): string {
    // YouTube playlist IDs start with PL and are followed by 32 characters
    if (!/^PL[a-zA-Z0-9_-]{32}$/.test(playlistId)) {
      throw new ValidationError('Invalid playlist ID format', 'playlistId', playlistId);
    }
    return playlistId;
  }
}
```

### SQL Injection Prevention

```typescript
// Parameterized queries (if using database)
export class SecureDatabase {
  async getUserData(userId: string): Promise<UserData | null> {
    // Use parameterized queries to prevent SQL injection
    const query = 'SELECT * FROM users WHERE id = ?';
    const result = await this.db.query(query, [userId]);
    return result[0] || null;
  }

  async saveVideoMetadata(videoId: string, metadata: VideoMetadata): Promise<void> {
    const query = `
      INSERT INTO video_metadata (video_id, title, description, tags, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        title = VALUES(title),
        description = VALUES(description),
        tags = VALUES(tags),
        updated_at = VALUES(updated_at)
    `;

    await this.db.query(query, [
      videoId,
      metadata.title,
      metadata.description,
      JSON.stringify(metadata.tags),
      new Date()
    ]);
  }
}
```

## API Security

### Rate Limiting

```typescript
// Rate limiting implementation
export class RateLimiter {
  private requestCounts: Map<string, RequestCount> = new Map();
  private readonly limits = {
    perSecond: 100,
    perMinute: 6000,
    perHour: 50000,
    perDay: 10000 // YouTube API quota
  };

  async checkLimit(clientId: string): Promise<RateLimitResult> {
    const now = Date.now();
    const count = this.getRequestCount(clientId, now);

    // Check all time windows
    const checks = [
      { window: 1000, limit: this.limits.perSecond, current: count.lastSecond },
      { window: 60000, limit: this.limits.perMinute, current: count.lastMinute },
      { window: 3600000, limit: this.limits.perHour, current: count.lastHour },
      { window: 86400000, limit: this.limits.perDay, current: count.lastDay }
    ];

    for (const check of checks) {
      if (check.current >= check.limit) {
        return {
          allowed: false,
          retryAfter: this.calculateRetryAfter(check.window),
          limit: check.limit,
          current: check.current
        };
      }
    }

    // Update counters
    this.updateRequestCount(clientId, now);

    return {
      allowed: true,
      limit: this.limits.perDay,
      current: count.lastDay + 1
    };
  }

  private getRequestCount(clientId: string, now: number): RequestCount {
    const existing = this.requestCounts.get(clientId);
    if (!existing) {
      return {
        lastSecond: 0,
        lastMinute: 0,
        lastHour: 0,
        lastDay: 0,
        timestamps: []
      };
    }

    // Filter timestamps within time windows
    const timestamps = existing.timestamps.filter(ts => now - ts < 86400000);

    return {
      lastSecond: timestamps.filter(ts => now - ts < 1000).length,
      lastMinute: timestamps.filter(ts => now - ts < 60000).length,
      lastHour: timestamps.filter(ts => now - ts < 3600000).length,
      lastDay: timestamps.length,
      timestamps
    };
  }
}
```

### Quota Management

```typescript
// YouTube API quota management with security considerations
export class QuotaManager {
  private usage: Map<string, QuotaUsage> = new Map();
  private readonly dailyLimit = 10000;
  private readonly quotaCosts = {
    'search': 100,
    'videos.list': 1,
    'videos.update': 50,
    'playlists.insert': 50,
    'playlistItems.insert': 50
  };

  async checkQuota(operation: string, clientId: string): Promise<QuotaCheckResult> {
    const cost = this.quotaCosts[operation] || 1;
    const usage = this.getUsage(clientId);

    if (usage.used + cost > this.dailyLimit) {
      // Log quota exceeded attempts for security monitoring
      this.logQuotaExceeded(clientId, operation, cost);

      return {
        allowed: false,
        cost,
        used: usage.used,
        remaining: this.dailyLimit - usage.used,
        resetTime: usage.resetTime
      };
    }

    return {
      allowed: true,
      cost,
      used: usage.used,
      remaining: this.dailyLimit - usage.used - cost,
      resetTime: usage.resetTime
    };
  }

  private logQuotaExceeded(clientId: string, operation: string, cost: number): void {
    // Security logging for quota abuse detection
    console.warn('Quota exceeded attempt:', {
      clientId: this.hashClientId(clientId),
      operation,
      cost,
      timestamp: new Date().toISOString()
    });
  }

  private hashClientId(clientId: string): string {
    // Hash client ID for privacy in logs
    const hash = crypto.createHash('sha256');
    hash.update(clientId);
    return hash.digest('hex').substring(0, 8);
  }
}
```

## Data Protection

### Encryption at Rest

```typescript
// File encryption for sensitive data
export class FileEncryption {
  constructor(private encryptionKey: string) {}

  async encryptFile(filePath: string, data: any): Promise<void> {
    const key = await this.deriveKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = new TextEncoder().encode(JSON.stringify(data));

    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      plaintext
    );

    const encryptedData = {
      data: Array.from(new Uint8Array(encrypted)),
      iv: Array.from(iv),
      version: '1.0'
    };

    await fs.writeFile(filePath, JSON.stringify(encryptedData), 'utf8');
  }

  async decryptFile(filePath: string): Promise<any> {
    const fileContent = await fs.readFile(filePath, 'utf8');
    const encryptedData = JSON.parse(fileContent);

    const key = await this.deriveKey();
    const iv = new Uint8Array(encryptedData.iv);
    const data = new Uint8Array(encryptedData.data);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );

    const plaintext = new TextDecoder().decode(decrypted);
    return JSON.parse(plaintext);
  }

  private async deriveKey(): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(this.encryptionKey),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode('youtube-mcp-file-salt'),
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }
}
```

### Secure File Handling

```typescript
// Secure file operations
export class SecureFileManager {
  private readonly allowedPaths = [
    'tokens/',
    'backups/',
    'storage/metadata-suggestions/',
    'temp/'
  ];

  async writeSecurely(filePath: string, data: any): Promise<void> {
    // Validate file path
    this.validatePath(filePath);

    // Create secure directory if it doesn't exist
    const dir = path.dirname(filePath);
    await this.ensureSecureDirectory(dir);

    // Write with secure permissions
    const tempPath = filePath + '.tmp';

    try {
      await fs.writeFile(tempPath, JSON.stringify(data, null, 2), {
        mode: 0o600, // Read/write for owner only
        flag: 'w'
      });

      // Atomic move
      await fs.rename(tempPath, filePath);
    } catch (error) {
      // Cleanup temp file on error
      try {
        await fs.unlink(tempPath);
      } catch {}
      throw error;
    }
  }

  private validatePath(filePath: string): void {
    const normalized = path.normalize(filePath);

    // Prevent directory traversal
    if (normalized.includes('..') || normalized.startsWith('/')) {
      throw new SecurityError('Invalid file path', 'PATH_TRAVERSAL', { path: filePath });
    }

    // Check allowed paths
    const isAllowed = this.allowedPaths.some(allowedPath =>
      normalized.startsWith(allowedPath)
    );

    if (!isAllowed) {
      throw new SecurityError('Unauthorized file path', 'UNAUTHORIZED_PATH', { path: filePath });
    }
  }

  private async ensureSecureDirectory(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, {
        recursive: true,
        mode: 0o700 // Read/write/execute for owner only
      });
    }
  }
}
```

## Error Handling and Information Disclosure

### Secure Error Handling

```typescript
// Security-aware error handling
export class SecurityErrorHandler {
  static handleError(error: unknown, context: string): MCPError {
    // Log full error details for debugging (not exposed to client)
    this.logError(error, context);

    // Return sanitized error to client
    if (error instanceof ValidationError) {
      return new MCPError(
        'Invalid input provided',
        'VALIDATION_ERROR',
        { field: error.field } // Safe to expose
      );
    }

    if (error instanceof AuthenticationError) {
      return new MCPError(
        'Authentication required',
        'AUTH_REQUIRED'
        // Don't expose authentication details
      );
    }

    if (error instanceof YouTubeAPIError) {
      return new MCPError(
        'External service temporarily unavailable',
        'SERVICE_UNAVAILABLE'
        // Don't expose API details
      );
    }

    // Generic error for unknown issues
    return new MCPError(
      'An unexpected error occurred',
      'INTERNAL_ERROR'
    );
  }

  private static logError(error: unknown, context: string): void {
    const errorLog = {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      context,
      timestamp: new Date().toISOString(),
      // Don't log sensitive data
    };

    // Log to secure location (not stdout/stderr for MCP servers)
    if (process.env.NODE_ENV === 'development') {
      console.error('Security Error:', errorLog);
    }
  }
}
```

### Information Disclosure Prevention

```typescript
// Prevent sensitive information leakage
export class InformationProtection {
  static sanitizeForLogging(data: any): any {
    const sensitiveFields = [
      'password',
      'token',
      'secret',
      'key',
      'authorization',
      'cookie',
      'session'
    ];

    return this.recursiveSanitize(data, sensitiveFields);
  }

  private static recursiveSanitize(obj: any, sensitiveFields: string[]): any {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.recursiveSanitize(item, sensitiveFields));
    }

    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = sensitiveFields.some(field =>
        lowerKey.includes(field)
      );

      if (isSensitive) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = this.recursiveSanitize(value, sensitiveFields);
      }
    }

    return sanitized;
  }

  static sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
    const sanitized = { ...headers };

    // Redact sensitive headers
    if (sanitized.authorization) {
      sanitized.authorization = '[REDACTED]';
    }
    if (sanitized.cookie) {
      sanitized.cookie = '[REDACTED]';
    }

    return sanitized;
  }
}
```

## Security Monitoring and Logging

### Security Event Logging

```typescript
// Security event monitoring
export class SecurityMonitor {
  private eventLog: SecurityEvent[] = [];

  logAuthenticationAttempt(success: boolean, clientInfo: ClientInfo): void {
    this.logEvent({
      type: 'AUTHENTICATION_ATTEMPT',
      success,
      clientId: this.hashClientId(clientInfo.id),
      userAgent: clientInfo.userAgent,
      ipAddress: this.hashIP(clientInfo.ipAddress),
      timestamp: new Date().toISOString()
    });
  }

  logRateLimitViolation(clientId: string, operation: string, limit: number): void {
    this.logEvent({
      type: 'RATE_LIMIT_VIOLATION',
      success: false,
      clientId: this.hashClientId(clientId),
      operation,
      limit,
      timestamp: new Date().toISOString()
    });
  }

  logSuspiciousActivity(activity: SuspiciousActivity): void {
    this.logEvent({
      type: 'SUSPICIOUS_ACTIVITY',
      success: false,
      description: activity.description,
      clientId: activity.clientId ? this.hashClientId(activity.clientId) : undefined,
      details: InformationProtection.sanitizeForLogging(activity.details),
      timestamp: new Date().toISOString()
    });
  }

  private logEvent(event: SecurityEvent): void {
    this.eventLog.push(event);

    // Write to secure log file
    if (process.env.NODE_ENV !== 'test') {
      this.writeToSecureLog(event);
    }

    // Trigger alerts for critical events
    if (this.isCriticalEvent(event)) {
      this.triggerSecurityAlert(event);
    }
  }

  private isCriticalEvent(event: SecurityEvent): boolean {
    return [
      'AUTHENTICATION_FAILURE_SEQUENCE',
      'RATE_LIMIT_VIOLATION',
      'SUSPICIOUS_ACTIVITY'
    ].includes(event.type);
  }

  private async writeToSecureLog(event: SecurityEvent): Promise<void> {
    const logEntry = JSON.stringify(event) + '\n';
    const logPath = path.join('logs', 'security.log');

    await fs.appendFile(logPath, logEntry, {
      mode: 0o600 // Secure permissions
    });
  }

  private hashClientId(clientId: string): string {
    return crypto.createHash('sha256').update(clientId).digest('hex').substring(0, 16);
  }

  private hashIP(ipAddress: string): string {
    return crypto.createHash('sha256').update(ipAddress).digest('hex').substring(0, 16);
  }
}
```

### Intrusion Detection

```typescript
// Basic intrusion detection
export class IntrusionDetector {
  private failedAttempts: Map<string, FailureRecord> = new Map();
  private readonly thresholds = {
    maxFailedAttempts: 5,
    timeWindow: 300000, // 5 minutes
    lockoutDuration: 900000 // 15 minutes
  };

  checkForIntrusion(clientId: string, success: boolean): IntrusionResult {
    const hashedClientId = this.hashClientId(clientId);
    const now = Date.now();

    if (success) {
      // Clear failed attempts on success
      this.failedAttempts.delete(hashedClientId);
      return { blocked: false };
    }

    // Record failed attempt
    const record = this.failedAttempts.get(hashedClientId) || {
      attempts: 0,
      firstAttempt: now,
      lastAttempt: now
    };

    record.attempts++;
    record.lastAttempt = now;
    this.failedAttempts.set(hashedClientId, record);

    // Check if within time window
    if (now - record.firstAttempt > this.thresholds.timeWindow) {
      // Reset counter if outside time window
      record.attempts = 1;
      record.firstAttempt = now;
    }

    // Check for lockout
    if (record.attempts >= this.thresholds.maxFailedAttempts) {
      return {
        blocked: true,
        lockoutUntil: now + this.thresholds.lockoutDuration,
        reason: 'Too many failed authentication attempts'
      };
    }

    return { blocked: false };
  }

  private hashClientId(clientId: string): string {
    return crypto.createHash('sha256').update(clientId).digest('hex');
  }
}
```

## Compliance and Best Practices

### GDPR Compliance

```typescript
// GDPR compliance utilities
export class GDPRCompliance {
  static async anonymizeUserData(userData: UserData): Promise<AnonymizedData> {
    return {
      id: this.generateAnonymousId(),
      usage: userData.usage,
      // Remove PII
      createdAt: userData.createdAt,
      lastActivity: userData.lastActivity
    };
  }

  static async deleteUserData(userId: string): Promise<void> {
    // Delete all user-related data
    await Promise.all([
      this.deleteTokens(userId),
      this.deleteBackups(userId),
      this.deleteMetadataSuggestions(userId),
      this.deleteLogs(userId)
    ]);
  }

  static async exportUserData(userId: string): Promise<UserDataExport> {
    return {
      tokens: await this.exportTokens(userId),
      backups: await this.exportBackups(userId),
      metadata: await this.exportMetadata(userId),
      exportedAt: new Date().toISOString()
    };
  }

  private static generateAnonymousId(): string {
    return 'anon_' + crypto.randomUUID();
  }
}
```

### Security Headers

```typescript
// Security headers for HTTP responses (if applicable)
export class SecurityHeaders {
  static getSecurityHeaders(): Record<string, string> {
    return {
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'Content-Security-Policy': "default-src 'self'",
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), location=()'
    };
  }
}
```

## Vulnerability Management

### Dependency Security

```bash
# Security audit commands
npm audit                    # Check for vulnerabilities
npm audit fix               # Fix automatically fixable issues
npm audit --audit-level high # Only show high/critical vulnerabilities

# Use npm-check-updates for dependency updates
npx ncu -u                  # Update package.json
npm install                 # Install updated dependencies

# Snyk integration for advanced security scanning
npx snyk test              # Scan for vulnerabilities
npx snyk monitor           # Monitor project
```

### Security Scanning

```yaml
# GitHub Actions security workflow
name: Security Scan

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 2 * * 1' # Weekly scan

jobs:
  security:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v3

    - name: Run Snyk to check for vulnerabilities
      uses: snyk/actions/node@master
      env:
        SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}

    - name: CodeQL Analysis
      uses: github/codeql-action/analyze@v2
      with:
        languages: javascript

    - name: NPM Audit
      run: npm audit --audit-level high
```

## Incident Response

### Security Incident Procedures

1. **Detection**: Monitor security logs and alerts
2. **Assessment**: Evaluate severity and impact
3. **Containment**: Isolate affected systems
4. **Eradication**: Remove threats and vulnerabilities
5. **Recovery**: Restore normal operations
6. **Lessons Learned**: Improve security measures

### Breach Response

```typescript
// Security breach response procedures
export class BreachResponse {
  async handleSecurityBreach(incident: SecurityIncident): Promise<void> {
    // Immediate containment
    await this.containBreach(incident);

    // Assess impact
    const assessment = await this.assessImpact(incident);

    // Notify stakeholders
    await this.notifyStakeholders(assessment);

    // Begin recovery
    await this.initiateRecovery(incident);

    // Document incident
    await this.documentIncident(incident, assessment);
  }

  private async containBreach(incident: SecurityIncident): Promise<void> {
    // Revoke compromised tokens
    if (incident.type === 'TOKEN_COMPROMISE') {
      await this.revokeAllTokens();
    }

    // Block suspicious IP addresses
    if (incident.suspiciousIPs) {
      await this.blockIPAddresses(incident.suspiciousIPs);
    }

    // Rotate encryption keys
    await this.rotateEncryptionKeys();
  }
}
```

## Security Configuration

### Environment-Specific Security

```typescript
// Security configuration by environment
export class SecurityConfig {
  static getSecurityConfig(environment: string): SecuritySettings {
    switch (environment) {
      case 'production':
        return {
          encryption: {
            required: true,
            algorithm: 'AES-256-GCM',
            keyRotationDays: 90
          },
          authentication: {
            requireMFA: true,
            sessionTimeout: 3600, // 1 hour
            maxSessions: 1
          },
          logging: {
            level: 'warn',
            auditLevel: 'full',
            retention: 365 // days
          },
          rateLimiting: {
            enabled: true,
            strict: true
          }
        };

      case 'development':
        return {
          encryption: {
            required: false, // For easier debugging
            algorithm: 'AES-256-GCM',
            keyRotationDays: 30
          },
          authentication: {
            requireMFA: false,
            sessionTimeout: 86400, // 24 hours
            maxSessions: 5
          },
          logging: {
            level: 'debug',
            auditLevel: 'basic',
            retention: 30
          },
          rateLimiting: {
            enabled: true,
            strict: false
          }
        };

      default:
        throw new Error(`Unknown environment: ${environment}`);
    }
  }
}
```

This comprehensive security documentation provides the foundation for maintaining a secure YouTube MCP Extended implementation across all environments and use cases.