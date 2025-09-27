#!/usr/bin/env tsx

/**
 * Advanced Build Script for YouTube MCP Extended
 *
 * Features:
 * - TypeScript compilation with optimization
 * - Bundle analysis and size reporting
 * - Source map generation
 * - Build time measurement
 * - Error handling and validation
 * - Multiple build targets (development, production, analysis)
 */

import { execSync, spawn } from 'child_process';
import { promises as fs } from 'fs';
import { join, resolve } from 'path';
import { performance } from 'perf_hooks';

interface BuildOptions {
  mode: 'development' | 'production' | 'analysis';
  watch?: boolean;
  sourceMap?: boolean;
  minify?: boolean;
  analyze?: boolean;
  clean?: boolean;
  verbose?: boolean;
}

interface BuildResult {
  success: boolean;
  duration: number;
  outputSize: number;
  warnings: string[];
  errors: string[];
}

class BuildManager {
  private projectRoot: string;
  private distDir: string;
  private srcDir: string;

  constructor() {
    this.projectRoot = resolve(process.cwd());
    this.distDir = join(this.projectRoot, 'dist');
    this.srcDir = join(this.projectRoot, 'src');
  }

  async build(options: BuildOptions): Promise<BuildResult> {
    const startTime = performance.now();
    const result: BuildResult = {
      success: false,
      duration: 0,
      outputSize: 0,
      warnings: [],
      errors: []
    };

    try {
      console.log(`🏗️  Starting ${options.mode} build...`);

      // Clean dist directory if requested
      if (options.clean) {
        await this.cleanDist();
      }

      // Validate environment and dependencies
      await this.validateEnvironment();

      // Run TypeScript compilation
      await this.compileTypeScript(options);

      // Post-build optimizations
      if (options.mode === 'production') {
        await this.optimizeProduction();
      }

      // Analyze bundle if requested
      if (options.analyze) {
        await this.analyzeBuild();
      }

      // Calculate build metrics
      result.outputSize = await this.calculateOutputSize();
      result.duration = performance.now() - startTime;
      result.success = true;

      console.log(`✅ Build completed successfully in ${result.duration.toFixed(2)}ms`);
      console.log(`📦 Output size: ${(result.outputSize / 1024).toFixed(2)} KB`);

    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : String(error));
      result.duration = performance.now() - startTime;
      console.error('❌ Build failed:', error);
    }

    return result;
  }

  private async cleanDist(): Promise<void> {
    console.log('🧹 Cleaning dist directory...');
    try {
      await fs.rm(this.distDir, { recursive: true, force: true });
      await fs.mkdir(this.distDir, { recursive: true });
    } catch (error) {
      console.warn('Warning: Could not clean dist directory:', error);
    }
  }

  private async validateEnvironment(): Promise<void> {
    console.log('🔍 Validating environment...');

    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    if (majorVersion < 20) {
      throw new Error(`Node.js 20+ required, found ${nodeVersion}`);
    }

    // Check TypeScript availability
    try {
      execSync('npx tsc --version', { stdio: 'pipe' });
    } catch {
      throw new Error('TypeScript compiler not available');
    }

    // Validate tsconfig.json
    const tsconfigPath = join(this.projectRoot, 'tsconfig.json');
    try {
      await fs.access(tsconfigPath);
    } catch {
      throw new Error('tsconfig.json not found');
    }
  }

  private async compileTypeScript(options: BuildOptions): Promise<void> {
    console.log('📝 Compiling TypeScript...');

    const tscArgs = [
      'tsc',
      '--project', this.projectRoot
    ];

    // Add build-specific flags
    if (options.mode === 'production') {
      tscArgs.push('--removeComments');
    }

    if (!options.sourceMap) {
      tscArgs.push('--sourceMap', 'false');
    }

    if (options.watch) {
      tscArgs.push('--watch');
    }

    try {
      const output = execSync(`npx ${tscArgs.join(' ')}`, {
        cwd: this.projectRoot,
        encoding: 'utf8',
        stdio: options.watch ? 'inherit' : 'pipe'
      });

      if (options.verbose && output) {
        console.log(output);
      }
    } catch (error: any) {
      throw new Error(`TypeScript compilation failed: ${error.message}`);
    }
  }

  private async optimizeProduction(): Promise<void> {
    console.log('⚡ Applying production optimizations...');

    // Copy only necessary files
    await this.copyProductionAssets();

    // Generate production package.json
    await this.generateProductionPackageJson();
  }

  private async copyProductionAssets(): Promise<void> {
    const assets = ['README.md', 'LICENSE'];

    for (const asset of assets) {
      const sourcePath = join(this.projectRoot, asset);
      const destPath = join(this.distDir, asset);

      try {
        await fs.copyFile(sourcePath, destPath);
      } catch {
        // Asset doesn't exist, skip
      }
    }
  }

  private async generateProductionPackageJson(): Promise<void> {
    const packageJsonPath = join(this.projectRoot, 'package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));

    // Create production package.json with only runtime dependencies
    const prodPackageJson = {
      name: packageJson.name,
      version: packageJson.version,
      description: packageJson.description,
      main: packageJson.main,
      type: packageJson.type,
      engines: packageJson.engines,
      dependencies: packageJson.dependencies,
      keywords: packageJson.keywords,
      author: packageJson.author,
      license: packageJson.license
    };

    await fs.writeFile(
      join(this.distDir, 'package.json'),
      JSON.stringify(prodPackageJson, null, 2)
    );
  }

  private async analyzeBuild(): Promise<void> {
    console.log('📊 Analyzing build output...');

    const files = await this.getDistFiles();

    console.log('\n📦 Build Analysis:');
    console.log('==================');

    for (const file of files) {
      const stats = await fs.stat(file.path);
      console.log(`${file.name}: ${(stats.size / 1024).toFixed(2)} KB`);
    }
  }

  private async getDistFiles(): Promise<Array<{name: string, path: string}>> {
    const files: Array<{name: string, path: string}> = [];

    const readDir = async (dir: string, prefix = ''): Promise<void> => {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        const relativeName = prefix ? `${prefix}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          await readDir(fullPath, relativeName);
        } else {
          files.push({ name: relativeName, path: fullPath });
        }
      }
    };

    await readDir(this.distDir);
    return files;
  }

  private async calculateOutputSize(): Promise<number> {
    try {
      const files = await this.getDistFiles();
      let totalSize = 0;

      for (const file of files) {
        const stats = await fs.stat(file.path);
        totalSize += stats.size;
      }

      return totalSize;
    } catch {
      return 0;
    }
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const options: BuildOptions = {
    mode: 'development',
    clean: true,
    sourceMap: true,
    analyze: false,
    verbose: false
  };

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--mode':
        options.mode = args[++i] as BuildOptions['mode'];
        break;
      case '--production':
        options.mode = 'production';
        options.minify = true;
        break;
      case '--watch':
        options.watch = true;
        break;
      case '--no-clean':
        options.clean = false;
        break;
      case '--no-sourcemap':
        options.sourceMap = false;
        break;
      case '--analyze':
        options.analyze = true;
        break;
      case '--verbose':
        options.verbose = true;
        break;
      case '--help':
        console.log(`
Usage: build.ts [options]

Options:
  --mode <mode>      Build mode: development, production, analysis
  --production       Shortcut for production mode with optimizations
  --watch            Watch mode for continuous compilation
  --no-clean         Don't clean dist directory before build
  --no-sourcemap     Disable source map generation
  --analyze          Analyze bundle size and composition
  --verbose          Enable verbose output
  --help             Show this help message
        `);
        process.exit(0);
    }
  }

  const buildManager = new BuildManager();
  const result = await buildManager.build(options);

  process.exit(result.success ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { BuildManager, type BuildOptions, type BuildResult };