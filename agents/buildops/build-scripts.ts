#!/usr/bin/env tsx

/**
 * YouTube MCP Extended - Build Scripts
 * Comprehensive build system with multiple targets and optimizations
 *
 * Usage:
 *   tsx build-scripts.ts dev      - Development build with hot reload
 *   tsx build-scripts.ts build    - Production build with optimizations
 *   tsx build-scripts.ts watch    - Watch mode for development
 *   tsx build-scripts.ts deploy   - Full deployment build
 *   tsx build-scripts.ts analyze  - Bundle size analysis
 */

import { spawn, exec } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface BuildConfig {
  mode: 'development' | 'production';
  sourceMap: boolean;
  minify: boolean;
  treeshake: boolean;
  watch: boolean;
  analyze: boolean;
  outDir: string;
  envVars: Record<string, string>;
}

class BuildSystem {
  private rootDir: string;
  private srcDir: string;
  private distDir: string;
  private startTime: number = 0;

  constructor() {
    this.rootDir = process.cwd();
    this.srcDir = join(this.rootDir, 'src');
    this.distDir = join(this.rootDir, 'dist');
  }

  private log(message: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') {
    const colors = {
      info: '\x1b[36m',    // Cyan
      success: '\x1b[32m', // Green
      error: '\x1b[31m',   // Red
      warn: '\x1b[33m',    // Yellow
      reset: '\x1b[0m'
    };

    const timestamp = new Date().toLocaleTimeString();
    console.log(`${colors[type]}[${timestamp}] ${message}${colors.reset}`);
  }

  private async execCommand(command: string): Promise<{ stdout: string; stderr: string }> {
    try {
      return await execAsync(command);
    } catch (error: any) {
      throw new Error(`Command failed: ${command}\n${error.message}`);
    }
  }

  private createConfig(mode: string): BuildConfig {
    const configs: Record<string, Partial<BuildConfig>> = {
      dev: {
        mode: 'development',
        sourceMap: true,
        minify: false,
        treeshake: false,
        watch: true,
        analyze: false,
        envVars: { NODE_ENV: 'development' }
      },
      build: {
        mode: 'production',
        sourceMap: true,
        minify: true,
        treeshake: true,
        watch: false,
        analyze: false,
        envVars: { NODE_ENV: 'production' }
      },
      watch: {
        mode: 'development',
        sourceMap: true,
        minify: false,
        treeshake: false,
        watch: true,
        analyze: false,
        envVars: { NODE_ENV: 'development' }
      },
      deploy: {
        mode: 'production',
        sourceMap: false,
        minify: true,
        treeshake: true,
        watch: false,
        analyze: true,
        envVars: { NODE_ENV: 'production' }
      },
      analyze: {
        mode: 'production',
        sourceMap: true,
        minify: false,
        treeshake: true,
        watch: false,
        analyze: true,
        envVars: { NODE_ENV: 'production' }
      }
    };

    const baseConfig: BuildConfig = {
      mode: 'development',
      sourceMap: true,
      minify: false,
      treeshake: false,
      watch: false,
      analyze: false,
      outDir: 'dist',
      envVars: {}
    };

    return { ...baseConfig, ...(configs[mode] || {}) };
  }

  private async validateEnvironment(): Promise<void> {
    this.log('Validating build environment...', 'info');

    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    if (majorVersion < 20) {
      throw new Error(`Node.js 20 or higher required. Current version: ${nodeVersion}`);
    }

    // Check required files
    const requiredFiles = ['package.json', 'tsconfig.json', 'src/index.ts'];
    for (const file of requiredFiles) {
      if (!existsSync(join(this.rootDir, file))) {
        throw new Error(`Required file not found: ${file}`);
      }
    }

    // Check TypeScript installation
    try {
      await execAsync('npx tsc --version');
    } catch {
      throw new Error('TypeScript not found. Please install with: npm install -D typescript');
    }

    this.log('Environment validation passed', 'success');
  }

  private async injectEnvironmentVariables(config: BuildConfig): Promise<void> {
    this.log('Injecting environment variables...', 'info');

    const envFile = join(this.rootDir, '.env');
    let envVars: Record<string, string> = { ...config.envVars };

    // Load .env file if exists
    if (existsSync(envFile)) {
      const envContent = readFileSync(envFile, 'utf-8');
      for (const line of envContent.split('\n')) {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
          const [, key, value] = match;
          envVars[key.trim()] = value.trim().replace(/^["']|["']$/g, '');
        }
      }
    }

    // Set environment variables
    Object.assign(process.env, envVars);

    this.log(`Injected ${Object.keys(envVars).length} environment variables`, 'info');
  }

  private async cleanBuild(): Promise<void> {
    this.log('Cleaning build directory...', 'info');

    try {
      await execAsync(`rm -rf ${this.distDir}`);
      mkdirSync(this.distDir, { recursive: true });
      this.log('Build directory cleaned', 'success');
    } catch (error) {
      this.log(`Failed to clean build directory: ${error}`, 'error');
      throw error;
    }
  }

  private async buildTypeScript(config: BuildConfig): Promise<void> {
    this.log(`Building TypeScript (${config.mode})...`, 'info');

    // Create custom tsconfig for this build
    const tsConfig = JSON.parse(readFileSync(join(this.rootDir, 'tsconfig.json'), 'utf-8'));

    // Apply build-specific options
    tsConfig.compilerOptions = {
      ...tsConfig.compilerOptions,
      sourceMap: config.sourceMap,
      outDir: config.outDir,
      removeComments: config.minify,
      skipLibCheck: true
    };

    // Write temporary config
    const tempConfigPath = join(this.rootDir, 'tsconfig.build.json');
    writeFileSync(tempConfigPath, JSON.stringify(tsConfig, null, 2));

    try {
      const tscCommand = config.watch
        ? `npx tsc --project ${tempConfigPath} --watch --preserveWatchOutput`
        : `npx tsc --project ${tempConfigPath}`;

      if (config.watch) {
        // For watch mode, spawn process and don't wait
        const tscProcess = spawn('npx', ['tsc', '--project', tempConfigPath, '--watch', '--preserveWatchOutput'], {
          stdio: 'inherit',
          shell: true
        });

        tscProcess.on('error', (error) => {
          this.log(`TypeScript watch failed: ${error}`, 'error');
        });

        this.log('TypeScript watch mode started', 'success');
        return;
      }

      await execAsync(tscCommand);
      this.log('TypeScript compilation completed', 'success');
    } catch (error) {
      this.log(`TypeScript compilation failed: ${error}`, 'error');
      throw error;
    } finally {
      // Clean up temporary config
      if (existsSync(tempConfigPath)) {
        await execAsync(`rm ${tempConfigPath}`);
      }
    }
  }

  private async optimizeBuild(config: BuildConfig): Promise<void> {
    if (!config.minify && !config.treeshake) return;

    this.log('Optimizing build...', 'info');

    // Note: For a more sophisticated minification, you might want to use tools like:
    // - terser for JS minification
    // - webpack or esbuild for bundling and tree-shaking
    // For now, we'll rely on TypeScript's removeComments option

    this.log('Build optimization completed', 'success');
  }

  private async analyzeBuild(): Promise<void> {
    this.log('Analyzing build size...', 'info');

    try {
      const { stdout } = await execAsync(`find ${this.distDir} -name "*.js" -exec wc -c {} + | tail -1`);
      const totalSize = parseInt(stdout.trim().split(' ')[0]);
      const sizeInKB = (totalSize / 1024).toFixed(2);

      this.log(`Total build size: ${sizeInKB} KB`, 'info');

      // Detailed file analysis
      const { stdout: files } = await execAsync(`find ${this.distDir} -name "*.js" -exec ls -lh {} +`);
      console.log('\nFile sizes:');
      console.log(files);

    } catch (error) {
      this.log(`Build analysis failed: ${error}`, 'warn');
    }
  }

  private async generateBuildInfo(config: BuildConfig): Promise<void> {
    const buildInfo = {
      timestamp: new Date().toISOString(),
      mode: config.mode,
      version: process.env.npm_package_version || '0.0.0',
      nodeVersion: process.version,
      commit: await this.getGitCommit(),
      buildTime: Date.now() - this.startTime,
      sourceMap: config.sourceMap,
      minified: config.minify
    };

    const buildInfoPath = join(this.distDir, 'build-info.json');
    writeFileSync(buildInfoPath, JSON.stringify(buildInfo, null, 2));
    this.log(`Build info written to ${buildInfoPath}`, 'info');
  }

  private async getGitCommit(): Promise<string> {
    try {
      const { stdout } = await execAsync('git rev-parse HEAD');
      return stdout.trim();
    } catch {
      return 'unknown';
    }
  }

  public async build(mode: string): Promise<void> {
    this.startTime = Date.now();
    this.log(`Starting ${mode} build...`, 'info');

    try {
      const config = this.createConfig(mode);

      await this.validateEnvironment();
      await this.injectEnvironmentVariables(config);

      if (!config.watch) {
        await this.cleanBuild();
      }

      await this.buildTypeScript(config);

      if (!config.watch) {
        await this.optimizeBuild(config);
        await this.generateBuildInfo(config);

        if (config.analyze) {
          await this.analyzeBuild();
        }

        const buildTime = ((Date.now() - this.startTime) / 1000).toFixed(2);
        this.log(`Build completed in ${buildTime}s`, 'success');
      }

    } catch (error) {
      this.log(`Build failed: ${error}`, 'error');
      process.exit(1);
    }
  }

  public async dev(): Promise<void> {
    this.log('Starting development server...', 'info');

    try {
      // Start TypeScript compiler in watch mode
      await this.build('watch');

      // Start the application with nodemon-like behavior
      const appProcess = spawn('node', ['--watch', join(this.distDir, 'index.js')], {
        stdio: 'inherit',
        shell: true,
        env: { ...process.env, NODE_ENV: 'development' }
      });

      appProcess.on('error', (error) => {
        this.log(`Application failed: ${error}`, 'error');
      });

      // Handle graceful shutdown
      process.on('SIGINT', () => {
        this.log('Shutting down development server...', 'info');
        appProcess.kill('SIGINT');
        process.exit(0);
      });

    } catch (error) {
      this.log(`Development server failed: ${error}`, 'error');
      process.exit(1);
    }
  }
}

// CLI Handler
async function main() {
  const command = process.argv[2] || 'build';
  const buildSystem = new BuildSystem();

  switch (command) {
    case 'dev':
      await buildSystem.dev();
      break;
    case 'build':
    case 'watch':
    case 'deploy':
    case 'analyze':
      await buildSystem.build(command);
      break;
    default:
      console.log(`
Usage: tsx build-scripts.ts <command>

Commands:
  dev      Start development server with hot reload
  build    Production build with optimizations
  watch    Watch mode for development
  deploy   Full deployment build with analysis
  analyze  Build with bundle size analysis

Examples:
  tsx build-scripts.ts dev
  tsx build-scripts.ts build
  tsx build-scripts.ts deploy
      `);
      process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Build script failed:', error);
    process.exit(1);
  });
}

export { BuildSystem };