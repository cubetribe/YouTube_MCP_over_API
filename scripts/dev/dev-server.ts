#!/usr/bin/env tsx

/**
 * Development Server for YouTube MCP Extended
 *
 * Features:
 * - Hot reload with tsx watch
 * - File system monitoring
 * - Automatic restart on config changes
 * - Development environment setup
 * - Enhanced logging and debugging
 * - Port conflict resolution
 * - Health checks
 */

import { spawn, ChildProcess } from 'child_process';
import { watch } from 'fs';
import { join, resolve } from 'path';
import { promises as fs } from 'fs';
import { createServer } from 'http';

interface DevServerOptions {
  port?: number;
  host?: string;
  watch?: boolean;
  verbose?: boolean;
  autoRestart?: boolean;
  healthCheck?: boolean;
  debounceMs?: number;
}

interface DevServerConfig {
  entryPoint: string;
  watchPaths: string[];
  ignorePaths: string[];
  envFile?: string;
}

class DevServer {
  private options: Required<DevServerOptions>;
  private config: DevServerConfig;
  private projectRoot: string;
  private mcpProcess?: ChildProcess;
  private healthServer?: any;
  private restartTimer?: NodeJS.Timeout;
  private isRestarting = false;

  constructor(options: DevServerOptions = {}) {
    this.projectRoot = resolve(process.cwd());
    this.options = {
      port: options.port ?? 3000,
      host: options.host ?? 'localhost',
      watch: options.watch ?? true,
      verbose: options.verbose ?? false,
      autoRestart: options.autoRestart ?? true,
      healthCheck: options.healthCheck ?? true,
      debounceMs: options.debounceMs ?? 1000
    };

    this.config = {
      entryPoint: join(this.projectRoot, 'src/index.ts'),
      watchPaths: [
        join(this.projectRoot, 'src'),
        join(this.projectRoot, 'package.json'),
        join(this.projectRoot, 'tsconfig.json'),
        join(this.projectRoot, '.env')
      ],
      ignorePaths: [
        join(this.projectRoot, 'node_modules'),
        join(this.projectRoot, 'dist'),
        join(this.projectRoot, '.git'),
        join(this.projectRoot, 'logs')
      ]
    };
  }

  async start(): Promise<void> {
    console.log('🚀 Starting YouTube MCP Extended Development Server...');
    console.log(`📍 Project: ${this.projectRoot}`);
    console.log(`⚡ Entry: ${this.config.entryPoint}`);

    try {
      // Validate environment
      await this.validateEnvironment();

      // Start health check server if enabled
      if (this.options.healthCheck) {
        await this.startHealthServer();
      }

      // Start the MCP server
      await this.startMcpServer();

      // Set up file watching if enabled
      if (this.options.watch) {
        this.setupFileWatching();
      }

      console.log('✅ Development server started successfully');
      console.log(`🔗 Health check: http://${this.options.host}:${this.options.port}/health`);

      // Keep process alive
      this.setupGracefulShutdown();

    } catch (error) {
      console.error('❌ Failed to start development server:', error);
      process.exit(1);
    }
  }

  private async validateEnvironment(): Promise<void> {
    console.log('🔍 Validating development environment...');

    // Check if entry point exists
    try {
      await fs.access(this.config.entryPoint);
    } catch {
      throw new Error(`Entry point not found: ${this.config.entryPoint}`);
    }

    // Check if tsx is available
    try {
      const { execSync } = await import('child_process');
      execSync('npx tsx --version', { stdio: 'pipe' });
    } catch {
      throw new Error('tsx not available. Run: npm install tsx');
    }

    // Load environment variables
    await this.loadEnvironment();

    console.log('✅ Environment validation passed');
  }

  private async loadEnvironment(): Promise<void> {
    const envPath = join(this.projectRoot, '.env');

    try {
      const envContent = await fs.readFile(envPath, 'utf8');
      const lines = envContent.split('\n');

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = trimmed.split('=');
          if (key && valueParts.length > 0) {
            const value = valueParts.join('=');
            process.env[key.trim()] = value.trim();
          }
        }
      }

      console.log(`📄 Loaded environment from ${envPath}`);
    } catch {
      console.log('📄 No .env file found, using system environment');
    }

    // Set development-specific environment variables
    process.env.NODE_ENV = 'development';
    process.env.MCP_DEV_MODE = 'true';
  }

  private async startHealthServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.healthServer = createServer((req, res) => {
        if (req.url === '/health') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            mcpRunning: !!this.mcpProcess && !this.mcpProcess.killed
          }));
        } else {
          res.writeHead(404);
          res.end('Not Found');
        }
      });

      this.healthServer.listen(this.options.port, this.options.host, () => {
        console.log(`🏥 Health server listening on http://${this.options.host}:${this.options.port}`);
        resolve();
      });

      this.healthServer.on('error', reject);
    });
  }

  private async startMcpServer(): Promise<void> {
    console.log('🔧 Starting MCP server with tsx watch...');

    return new Promise((resolve, reject) => {
      this.mcpProcess = spawn('npx', ['tsx', 'watch', this.config.entryPoint], {
        cwd: this.projectRoot,
        stdio: this.options.verbose ? 'inherit' : ['pipe', 'pipe', 'pipe'],
        env: { ...process.env }
      });

      let startupComplete = false;

      this.mcpProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        if (this.options.verbose) {
          console.log(`[MCP] ${output}`);
        }

        // Look for startup indicators
        if (!startupComplete && (output.includes('Server started') || output.includes('listening'))) {
          startupComplete = true;
          console.log('✅ MCP server started successfully');
          resolve();
        }
      });

      this.mcpProcess.stderr?.on('data', (data) => {
        const error = data.toString();
        if (this.options.verbose) {
          console.error(`[MCP Error] ${error}`);
        }

        // Check for critical errors
        if (error.includes('EADDRINUSE') || error.includes('port already in use')) {
          reject(new Error('Port already in use. Try a different port.'));
        }
      });

      this.mcpProcess.on('error', (error) => {
        console.error('❌ MCP process error:', error);
        if (!startupComplete) {
          reject(error);
        }
      });

      this.mcpProcess.on('exit', (code, signal) => {
        if (code !== 0 && !this.isRestarting) {
          console.error(`❌ MCP server exited with code ${code}, signal ${signal}`);
        }
      });

      // Timeout fallback
      setTimeout(() => {
        if (!startupComplete) {
          console.log('⚠️  MCP server startup timeout, assuming success');
          resolve();
        }
      }, 5000);
    });
  }

  private setupFileWatching(): void {
    console.log('👀 Setting up file watching...');

    for (const watchPath of this.config.watchPaths) {
      try {
        const watcher = watch(watchPath, { recursive: true }, (eventType, filename) => {
          if (!filename) return;

          const fullPath = join(watchPath, filename);

          // Ignore certain files and directories
          if (this.shouldIgnoreFile(fullPath)) {
            return;
          }

          if (this.options.verbose) {
            console.log(`📝 File changed: ${fullPath} (${eventType})`);
          }

          this.scheduleRestart();
        });

        console.log(`👀 Watching: ${watchPath}`);
      } catch (error) {
        console.warn(`⚠️  Could not watch ${watchPath}:`, error);
      }
    }
  }

  private shouldIgnoreFile(filePath: string): boolean {
    // Check ignore patterns
    for (const ignorePath of this.config.ignorePaths) {
      if (filePath.startsWith(ignorePath)) {
        return true;
      }
    }

    // Ignore temporary files and common non-source files
    const filename = filePath.split('/').pop() || '';
    const ignorePatterns = [
      /\.DS_Store$/,
      /\.log$/,
      /\.tmp$/,
      /~$/,
      /\.swp$/,
      /\.pid$/,
      /node_modules/,
      /\.git/
    ];

    return ignorePatterns.some(pattern => pattern.test(filePath));
  }

  private scheduleRestart(): void {
    if (this.isRestarting) return;

    // Clear existing timer
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
    }

    // Debounce restarts
    this.restartTimer = setTimeout(() => {
      this.restartMcpServer();
    }, this.options.debounceMs);
  }

  private async restartMcpServer(): Promise<void> {
    if (this.isRestarting) return;

    this.isRestarting = true;
    console.log('🔄 Restarting MCP server...');

    try {
      // Kill existing process
      if (this.mcpProcess && !this.mcpProcess.killed) {
        this.mcpProcess.kill('SIGTERM');

        // Wait for graceful shutdown
        await new Promise(resolve => {
          const timeout = setTimeout(() => {
            if (this.mcpProcess && !this.mcpProcess.killed) {
              this.mcpProcess.kill('SIGKILL');
            }
            resolve(void 0);
          }, 3000);

          this.mcpProcess?.on('exit', () => {
            clearTimeout(timeout);
            resolve(void 0);
          });
        });
      }

      // Start new process
      await this.startMcpServer();
      console.log('✅ MCP server restarted successfully');

    } catch (error) {
      console.error('❌ Failed to restart MCP server:', error);
    } finally {
      this.isRestarting = false;
    }
  }

  private setupGracefulShutdown(): void {
    const cleanup = async () => {
      console.log('\n🛑 Shutting down development server...');

      // Stop file watchers (they clean up automatically)

      // Kill MCP process
      if (this.mcpProcess && !this.mcpProcess.killed) {
        this.mcpProcess.kill('SIGTERM');
      }

      // Stop health server
      if (this.healthServer) {
        this.healthServer.close();
      }

      console.log('✅ Development server stopped');
      process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught exception:', error);
      cleanup();
    });
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const options: DevServerOptions = {};

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--port':
        options.port = parseInt(args[++i]);
        break;
      case '--host':
        options.host = args[++i];
        break;
      case '--no-watch':
        options.watch = false;
        break;
      case '--verbose':
        options.verbose = true;
        break;
      case '--no-health':
        options.healthCheck = false;
        break;
      case '--debounce':
        options.debounceMs = parseInt(args[++i]);
        break;
      case '--help':
        console.log(`
Usage: dev-server.ts [options]

Options:
  --port <number>    Port for health check server (default: 3000)
  --host <string>    Host for health check server (default: localhost)
  --no-watch         Disable file watching and auto-restart
  --verbose          Enable verbose logging
  --no-health        Disable health check server
  --debounce <ms>    Debounce time for file changes (default: 1000)
  --help             Show this help message
        `);
        process.exit(0);
    }
  }

  const devServer = new DevServer(options);
  await devServer.start();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { DevServer, type DevServerOptions };