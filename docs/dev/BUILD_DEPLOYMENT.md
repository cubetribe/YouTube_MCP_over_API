# Build and Deployment Guide

## Overview

YouTube MCP Extended supports multiple build configurations and deployment strategies. This guide covers the build system architecture, deployment options, and operational considerations.

## Build System Architecture

### Build Tools

- **TypeScript Compiler**: Core TypeScript to JavaScript compilation
- **tsx**: TypeScript execution for development and build scripts
- **Build Scripts**: Advanced build orchestration (optional)
- **npm scripts**: Standard build automation

### Build Configurations

```typescript
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

### Build Variants

1. **Basic Build** (`npm run build:basic`):
   - Simple TypeScript compilation
   - Fastest build time
   - Development and CI friendly

2. **Advanced Build** (`npm run build`):
   - Uses build orchestration scripts
   - Optimizations and validations
   - Production-ready artifacts

3. **Development Build** (`npm run build:dev`):
   - Development optimizations
   - Source maps enabled
   - Watch mode available

4. **Production Build** (`npm run build:prod`):
   - Production optimizations
   - Minification and bundling
   - Performance optimizations

## Build Scripts and Commands

### Core Build Commands

```bash
# Basic TypeScript compilation
npm run build:basic

# Clean build artifacts
npm run clean

# Development build with watch
npm run build:watch

# Production build
npm run build:prod

# Analyze build output
npm run build:analyze
```

### Advanced Build Commands

```bash
# Full build with validation
npm run build

# Development mode build
npm run build:dev

# Deployment build
npm run build:deploy

# Environment validation
npm run validate:env

# Generate environment template
npm run generate:env
```

### Build Script Implementation

```typescript
// agents/buildops/build-scripts.ts (if exists)
export interface BuildOptions {
  mode: 'development' | 'production';
  watch?: boolean;
  analyze?: boolean;
  deploy?: boolean;
}

export class BuildOrchestrator {
  constructor(private options: BuildOptions) {}

  async build(): Promise<void> {
    await this.validateEnvironment();
    await this.cleanBuild();
    await this.compile();

    if (this.options.analyze) {
      await this.analyzeBundle();
    }

    if (this.options.deploy) {
      await this.prepareDeploy();
    }
  }

  private async validateEnvironment(): Promise<void> {
    // Validate Node.js version
    const nodeVersion = process.version;
    if (!this.isValidNodeVersion(nodeVersion)) {
      throw new Error(`Node.js ${nodeVersion} not supported. Require >=20.0.0`);
    }

    // Validate TypeScript
    await this.validateTypeScript();

    // Validate dependencies
    await this.validateDependencies();
  }

  private async compile(): Promise<void> {
    const tscCommand = this.options.mode === 'production'
      ? 'tsc --build --clean && tsc'
      : 'tsc';

    await this.runCommand(tscCommand);
  }

  private async analyzeBundle(): Promise<void> {
    // Bundle analysis logic
    console.log('📊 Analyzing build output...');
    await this.generateBundleReport();
  }
}
```

## Development Builds

### Development Server

```bash
# Start development server with hot reload
npm run dev:basic

# Development with advanced build system
npm run dev

# Development with debugging
npm run dev:debug

# Development with inspection
npm run dev:inspect
```

### Development Configuration

```typescript
// Development-specific configuration
const developmentConfig = {
  typescript: {
    incremental: true,
    tsBuildInfoFile: '.tsbuildinfo'
  },
  sourceMap: true,
  watch: true,
  optimization: false
};
```

### Hot Reload Setup

```typescript
// Development server with tsx watch
const startDevelopmentServer = () => {
  const watcher = spawn('tsx', ['watch', 'src/index.ts'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'development'
    }
  });

  // Handle process termination
  process.on('SIGINT', () => {
    watcher.kill('SIGINT');
    process.exit(0);
  });
};
```

## Production Builds

### Production Optimization

```typescript
// Production build configuration
const productionConfig = {
  typescript: {
    removeComments: true,
    declaration: true,
    sourceMap: false
  },
  optimization: {
    minify: true,
    treeshaking: true,
    deadCodeElimination: true
  },
  validation: {
    typeCheck: true,
    lint: true,
    test: true
  }
};
```

### Build Validation Pipeline

```typescript
// Production build validation
export class ProductionBuildValidator {
  async validate(): Promise<ValidationResult> {
    const results = await Promise.all([
      this.validateTypeScript(),
      this.validateLinting(),
      this.validateTests(),
      this.validateSecurity(),
      this.validatePerformance()
    ]);

    return this.combineResults(results);
  }

  private async validateTypeScript(): Promise<ValidationStep> {
    try {
      await this.runCommand('npm run type-check');
      return { step: 'typescript', passed: true };
    } catch (error) {
      return { step: 'typescript', passed: false, error };
    }
  }

  private async validateSecurity(): Promise<ValidationStep> {
    try {
      await this.runCommand('npm audit --audit-level moderate');
      return { step: 'security', passed: true };
    } catch (error) {
      return { step: 'security', passed: false, error };
    }
  }
}
```

### Production Artifacts

```bash
# Generated artifacts structure
dist/
├── index.js              # Main entry point
├── index.d.ts            # Type definitions
├── auth/                 # Authentication modules
│   ├── oauth-service.js
│   └── oauth-service.d.ts
├── youtube/              # YouTube integration
│   ├── client.js
│   └── client.d.ts
└── ...                   # Other modules
```

## Docker Deployment

### Dockerfile

```dockerfile
# Multi-stage Docker build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Build application
RUN npm run build:prod

# Production stage
FROM node:20-alpine AS runtime

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Copy built application
COPY --from=builder --chown=nextjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "console.log('Health check passed')" || exit 1

# Start application
CMD ["npm", "start"]
```

### Docker Build Commands

```bash
# Build Docker image
npm run docker:build

# Run Docker container
npm run docker:run

# Development container
npm run docker:dev

# Production container
npm run docker:prod
```

### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  youtube-mcp:
    build:
      context: .
      dockerfile: Dockerfile
      target: runtime
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - YOUTUBE_CLIENT_ID=${YOUTUBE_CLIENT_ID}
      - YOUTUBE_CLIENT_SECRET=${YOUTUBE_CLIENT_SECRET}
      - OAUTH_ENCRYPTION_SECRET=${OAUTH_ENCRYPTION_SECRET}
    volumes:
      - ./tokens:/app/tokens
      - ./backups:/app/backups
      - ./logs:/app/logs
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "console.log('Health check')"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Development variant
  youtube-mcp-dev:
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
      - "9229:9229" # Debug port
    environment:
      - NODE_ENV=development
    volumes:
      - .:/app
      - /app/node_modules
    command: npm run dev:basic
```

## Cloud Deployment

### AWS Deployment

```typescript
// Infrastructure as Code (AWS CDK)
export class YouTubeMCPStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // ECS Cluster
    const cluster = new ecs.Cluster(this, 'YouTubeMCPCluster', {
      vpc: this.vpc
    });

    // Task Definition
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'TaskDefinition', {
      memoryLimitMiB: 512,
      cpu: 256
    });

    // Container Definition
    taskDefinition.addContainer('youtube-mcp', {
      image: ecs.ContainerImage.fromRegistry('your-registry/youtube-mcp:latest'),
      environment: {
        NODE_ENV: 'production'
      },
      secrets: {
        YOUTUBE_CLIENT_ID: ecs.Secret.fromSecretsManager(this.secrets),
        YOUTUBE_CLIENT_SECRET: ecs.Secret.fromSecretsManager(this.secrets)
      },
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'youtube-mcp'
      })
    });

    // ECS Service
    new ecs.FargateService(this, 'Service', {
      cluster,
      taskDefinition,
      desiredCount: 1
    });
  }
}
```

### Google Cloud Deployment

```yaml
# cloudbuild.yaml
steps:
  # Build
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/youtube-mcp:$COMMIT_SHA', '.']

  # Push
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/youtube-mcp:$COMMIT_SHA']

  # Deploy to Cloud Run
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - 'youtube-mcp'
      - '--image'
      - 'gcr.io/$PROJECT_ID/youtube-mcp:$COMMIT_SHA'
      - '--region'
      - 'us-central1'
      - '--platform'
      - 'managed'
      - '--allow-unauthenticated'

images:
  - 'gcr.io/$PROJECT_ID/youtube-mcp:$COMMIT_SHA'
```

### Kubernetes Deployment

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: youtube-mcp
  labels:
    app: youtube-mcp
spec:
  replicas: 2
  selector:
    matchLabels:
      app: youtube-mcp
  template:
    metadata:
      labels:
        app: youtube-mcp
    spec:
      containers:
      - name: youtube-mcp
        image: your-registry/youtube-mcp:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: YOUTUBE_CLIENT_ID
          valueFrom:
            secretKeyRef:
              name: youtube-credentials
              key: client-id
        - name: YOUTUBE_CLIENT_SECRET
          valueFrom:
            secretKeyRef:
              name: youtube-credentials
              key: client-secret
        resources:
          limits:
            memory: 512Mi
            cpu: 500m
          requests:
            memory: 256Mi
            cpu: 250m
        livenessProbe:
          exec:
            command:
            - node
            - -e
            - "console.log('Health check')"
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          exec:
            command:
            - node
            - -e
            - "console.log('Ready check')"
          initialDelaySeconds: 5
          periodSeconds: 5

---
apiVersion: v1
kind: Service
metadata:
  name: youtube-mcp-service
spec:
  selector:
    app: youtube-mcp
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: LoadBalancer
```

## Environment Management

### Environment Variables

```bash
# Development environment
NODE_ENV=development
LOG_LEVEL=debug
YOUTUBE_CLIENT_ID=dev_client_id
YOUTUBE_CLIENT_SECRET=dev_client_secret
OAUTH_ENCRYPTION_SECRET=development_secret_key

# Production environment
NODE_ENV=production
LOG_LEVEL=info
YOUTUBE_CLIENT_ID=prod_client_id
YOUTUBE_CLIENT_SECRET=prod_client_secret
OAUTH_ENCRYPTION_SECRET=production_secret_key
```

### Configuration Management

```typescript
// Environment-specific configuration
export class EnvironmentManager {
  static getConfig(env: string): EnvironmentConfig {
    switch (env) {
      case 'development':
        return this.getDevelopmentConfig();
      case 'production':
        return this.getProductionConfig();
      case 'test':
        return this.getTestConfig();
      default:
        throw new Error(`Unknown environment: ${env}`);
    }
  }

  private static getDevelopmentConfig(): EnvironmentConfig {
    return {
      logging: {
        level: 'debug',
        enableConsole: true,
        enableFile: true
      },
      security: {
        encryptionRequired: false,
        strictMode: false
      },
      performance: {
        enableCache: false,
        optimizations: false
      }
    };
  }

  private static getProductionConfig(): EnvironmentConfig {
    return {
      logging: {
        level: 'info',
        enableConsole: false,
        enableFile: true
      },
      security: {
        encryptionRequired: true,
        strictMode: true
      },
      performance: {
        enableCache: true,
        optimizations: true
      }
    };
  }
}
```

### Secret Management

```typescript
// Secret management utilities
export class SecretManager {
  static async loadSecrets(environment: string): Promise<SecretConfig> {
    switch (environment) {
      case 'production':
        return this.loadFromVault();
      case 'development':
        return this.loadFromFile();
      default:
        return this.loadFromEnvironment();
    }
  }

  private static async loadFromVault(): Promise<SecretConfig> {
    // Load from HashiCorp Vault, AWS Secrets Manager, etc.
    const vault = new VaultClient();
    return vault.getSecrets('youtube-mcp');
  }

  private static loadFromFile(): Promise<SecretConfig> {
    // Load from encrypted file
    return readEncryptedConfig('.env.encrypted');
  }

  private static loadFromEnvironment(): SecretConfig {
    // Load from environment variables
    return {
      youtubeClientId: process.env.YOUTUBE_CLIENT_ID!,
      youtubeClientSecret: process.env.YOUTUBE_CLIENT_SECRET!,
      encryptionSecret: process.env.OAUTH_ENCRYPTION_SECRET!
    };
  }
}
```

## Monitoring and Observability

### Health Checks

```typescript
// Health check implementation
export class HealthChecker {
  async checkHealth(): Promise<HealthStatus> {
    const checks = await Promise.allSettled([
      this.checkDatabase(),
      this.checkYouTubeAPI(),
      this.checkFileSystem(),
      this.checkMemory()
    ]);

    return {
      status: checks.every(check => check.status === 'fulfilled') ? 'healthy' : 'unhealthy',
      checks: checks.map((check, index) => ({
        name: ['database', 'youtube-api', 'filesystem', 'memory'][index],
        status: check.status === 'fulfilled' ? 'ok' : 'error',
        details: check.status === 'rejected' ? check.reason : undefined
      })),
      timestamp: new Date().toISOString()
    };
  }

  private async checkYouTubeAPI(): Promise<void> {
    // Test YouTube API connectivity
    const client = new YouTubeClient({ /* config */ });
    await client.testConnection();
  }

  private async checkMemory(): Promise<void> {
    const usage = process.memoryUsage();
    const limitMB = 512; // 512MB limit

    if (usage.heapUsed > limitMB * 1024 * 1024) {
      throw new Error(`Memory usage ${Math.round(usage.heapUsed / 1024 / 1024)}MB exceeds limit ${limitMB}MB`);
    }
  }
}
```

### Metrics Collection

```typescript
// Metrics collection
export class MetricsCollector {
  private metrics: Map<string, Metric> = new Map();

  recordApiCall(endpoint: string, duration: number, success: boolean): void {
    const key = `api.${endpoint}`;
    this.updateMetric(key + '.duration', duration);
    this.updateMetric(key + '.calls', 1);
    if (!success) {
      this.updateMetric(key + '.errors', 1);
    }
  }

  recordBatchOperation(type: string, itemCount: number, duration: number): void {
    this.updateMetric(`batch.${type}.items`, itemCount);
    this.updateMetric(`batch.${type}.duration`, duration);
  }

  getMetrics(): Record<string, Metric> {
    return Object.fromEntries(this.metrics);
  }

  private updateMetric(key: string, value: number): void {
    const existing = this.metrics.get(key) || { count: 0, sum: 0, avg: 0 };
    existing.count++;
    existing.sum += value;
    existing.avg = existing.sum / existing.count;
    this.metrics.set(key, existing);
  }
}
```

## Performance Optimization

### Build Performance

```typescript
// Build performance optimization
export class BuildOptimizer {
  async optimizeBuild(): Promise<void> {
    await Promise.all([
      this.enableTypeScriptIncremental(),
      this.optimizeNodeModules(),
      this.enableCaching(),
      this.parallelizeOperations()
    ]);
  }

  private async enableTypeScriptIncremental(): Promise<void> {
    // Enable TypeScript incremental compilation
    const tsconfigPath = 'tsconfig.json';
    const tsconfig = await readJSON(tsconfigPath);
    tsconfig.compilerOptions.incremental = true;
    tsconfig.compilerOptions.tsBuildInfoFile = '.tsbuildinfo';
    await writeJSON(tsconfigPath, tsconfig);
  }

  private async optimizeNodeModules(): Promise<void> {
    // Remove unnecessary files from node_modules for production
    const unnecessaryPatterns = [
      '**/test/**',
      '**/tests/**',
      '**/*.test.js',
      '**/*.spec.js',
      '**/README.md',
      '**/CHANGELOG.md'
    ];

    for (const pattern of unnecessaryPatterns) {
      await rimraf(pattern);
    }
  }
}
```

### Runtime Performance

```typescript
// Runtime performance optimization
export class RuntimeOptimizer {
  optimizeForProduction(): void {
    // Enable V8 optimizations
    if (process.env.NODE_ENV === 'production') {
      process.env.NODE_OPTIONS = [
        '--max-old-space-size=512',
        '--optimize-for-size',
        '--gc-interval=100'
      ].join(' ');
    }
  }

  setupMemoryManagement(): void {
    // Garbage collection monitoring
    if (global.gc) {
      setInterval(() => {
        global.gc();
      }, 30000); // Force GC every 30 seconds
    }

    // Memory usage monitoring
    setInterval(() => {
      const usage = process.memoryUsage();
      if (usage.heapUsed > 400 * 1024 * 1024) { // 400MB threshold
        console.warn('High memory usage detected:', usage);
      }
    }, 60000);
  }
}
```

## Deployment Automation

### CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    tags:
      - 'v*'

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v3

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '20'
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Run tests
      run: npm test

    - name: Build production
      run: npm run build:prod

    - name: Build Docker image
      run: docker build -t youtube-mcp:${{ github.sha }} .

    - name: Deploy to production
      run: |
        # Deploy to your preferred platform
        echo "Deploying to production..."
```

### Deployment Scripts

```bash
#!/bin/bash
# scripts/deploy.sh

set -e

echo "🚀 Starting deployment..."

# Build application
echo "📦 Building application..."
npm run build:prod

# Run tests
echo "🧪 Running tests..."
npm test

# Build Docker image
echo "🐳 Building Docker image..."
docker build -t youtube-mcp:latest .

# Deploy based on environment
if [ "$DEPLOY_ENV" = "production" ]; then
    echo "🚀 Deploying to production..."
    # Production deployment logic
    kubectl apply -f k8s/production/
elif [ "$DEPLOY_ENV" = "staging" ]; then
    echo "🎭 Deploying to staging..."
    # Staging deployment logic
    kubectl apply -f k8s/staging/
fi

echo "✅ Deployment completed successfully!"
```

This comprehensive build and deployment guide provides everything needed to build, optimize, and deploy YouTube MCP Extended across various environments and platforms.