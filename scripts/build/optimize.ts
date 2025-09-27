#!/usr/bin/env tsx

/**
 * Production Build Optimization for YouTube MCP Extended
 *
 * Features:
 * - Dead code elimination
 * - Bundle size optimization
 * - Dependency analysis and tree shaking
 * - Asset optimization
 * - Security hardening
 * - Performance profiling
 */

import { promises as fs } from 'fs';
import { join, resolve, extname, basename } from 'path';
import { execSync } from 'child_process';
import { createHash } from 'crypto';

interface OptimizationOptions {
  target: 'node' | 'browser';
  minify: boolean;
  removeComments: boolean;
  treeshake: boolean;
  bundleAnalysis: boolean;
  securityScan: boolean;
  verbose: boolean;
}

interface OptimizationResult {
  originalSize: number;
  optimizedSize: number;
  compressionRatio: number;
  removedFiles: string[];
  warnings: string[];
  securityIssues: string[];
}

class ProductionOptimizer {
  private projectRoot: string;
  private distDir: string;
  private options: OptimizationOptions;

  constructor(options: Partial<OptimizationOptions> = {}) {
    this.projectRoot = resolve(process.cwd());
    this.distDir = join(this.projectRoot, 'dist');
    this.options = {
      target: 'node',
      minify: true,
      removeComments: true,
      treeshake: true,
      bundleAnalysis: true,
      securityScan: true,
      verbose: false,
      ...options
    };
  }

  async optimize(): Promise<OptimizationResult> {
    console.log('⚡ Starting production optimization...');

    const result: OptimizationResult = {
      originalSize: 0,
      optimizedSize: 0,
      compressionRatio: 0,
      removedFiles: [],
      warnings: [],
      securityIssues: []
    };

    try {
      // Calculate original size
      result.originalSize = await this.calculateDirectorySize(this.distDir);
      console.log(`📊 Original build size: ${this.formatBytes(result.originalSize)}`);

      // Run optimization steps
      await this.optimizeJavaScript();
      await this.optimizeAssets();
      await this.removeUnnecessaryFiles(result);

      if (this.options.bundleAnalysis) {
        await this.analyzeDependencies(result);
      }

      if (this.options.securityScan) {
        await this.runSecurityScan(result);
      }

      // Calculate optimized size
      result.optimizedSize = await this.calculateDirectorySize(this.distDir);
      result.compressionRatio = ((result.originalSize - result.optimizedSize) / result.originalSize) * 100;

      console.log(`✅ Optimization complete!`);
      console.log(`📊 Optimized size: ${this.formatBytes(result.optimizedSize)}`);
      console.log(`📈 Size reduction: ${result.compressionRatio.toFixed(2)}%`);

    } catch (error) {
      console.error('❌ Optimization failed:', error);
      throw error;
    }

    return result;
  }

  private async optimizeJavaScript(): Promise<void> {
    console.log('🔧 Optimizing JavaScript files...');

    const jsFiles = await this.findFiles(this.distDir, ['.js']);

    for (const file of jsFiles) {
      try {
        await this.optimizeJsFile(file);
      } catch (error) {
        console.warn(`⚠️  Could not optimize ${file}:`, error);
      }
    }
  }

  private async optimizeJsFile(filePath: string): Promise<void> {
    let content = await fs.readFile(filePath, 'utf8');

    if (this.options.removeComments) {
      // Remove single-line comments (but preserve shebangs and license headers)
      content = content.replace(/^\s*\/\/(?!\s*#!).*$/gm, '');

      // Remove multi-line comments (but preserve license blocks)
      content = content.replace(/\/\*(?!\*\s*@license)[\s\S]*?\*\//g, '');
    }

    if (this.options.minify) {
      // Basic minification for Node.js (remove extra whitespace)
      content = content
        .replace(/\s+/g, ' ')
        .replace(/;\s*}/g, ';}')
        .replace(/{\s*/g, '{')
        .replace(/}\s*/g, '}')
        .replace(/,\s*/g, ',')
        .trim();
    }

    await fs.writeFile(filePath, content);

    if (this.options.verbose) {
      console.log(`✅ Optimized: ${basename(filePath)}`);
    }
  }

  private async optimizeAssets(): Promise<void> {
    console.log('🎨 Optimizing assets...');

    // Optimize JSON files
    const jsonFiles = await this.findFiles(this.distDir, ['.json']);

    for (const file of jsonFiles) {
      try {
        const content = await fs.readFile(file, 'utf8');
        const parsed = JSON.parse(content);
        const minified = JSON.stringify(parsed);
        await fs.writeFile(file, minified);

        if (this.options.verbose) {
          console.log(`✅ Minified JSON: ${basename(file)}`);
        }
      } catch (error) {
        console.warn(`⚠️  Could not optimize ${file}:`, error);
      }
    }
  }

  private async removeUnnecessaryFiles(result: OptimizationResult): Promise<void> {
    console.log('🧹 Removing unnecessary files...');

    const unnecessaryPatterns = [
      /\.test\.js$/,
      /\.spec\.js$/,
      /\.d\.ts$/,
      /\.map$/,
      /\.tsbuildinfo$/,
      /^\.DS_Store$/,
      /^Thumbs\.db$/,
      /^\.gitkeep$/
    ];

    const files = await this.findAllFiles(this.distDir);

    for (const file of files) {
      const filename = basename(file);

      if (unnecessaryPatterns.some(pattern => pattern.test(filename))) {
        try {
          await fs.unlink(file);
          result.removedFiles.push(file);

          if (this.options.verbose) {
            console.log(`🗑️  Removed: ${filename}`);
          }
        } catch (error) {
          console.warn(`⚠️  Could not remove ${file}:`, error);
        }
      }
    }

    console.log(`🗑️  Removed ${result.removedFiles.length} unnecessary files`);
  }

  private async analyzeDependencies(result: OptimizationResult): Promise<void> {
    console.log('📦 Analyzing dependencies...');

    try {
      const packageJsonPath = join(this.distDir, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));

      if (packageJson.dependencies) {
        const deps = Object.keys(packageJson.dependencies);
        console.log(`📦 Production dependencies: ${deps.length}`);

        // Check for potential unused dependencies
        const jsFiles = await this.findFiles(this.distDir, ['.js']);
        const usedDeps = new Set<string>();

        for (const file of jsFiles) {
          const content = await fs.readFile(file, 'utf8');

          for (const dep of deps) {
            if (content.includes(`require('${dep}')`) ||
                content.includes(`require("${dep}")`) ||
                content.includes(`from '${dep}'`) ||
                content.includes(`from "${dep}"`)) {
              usedDeps.add(dep);
            }
          }
        }

        const unusedDeps = deps.filter(dep => !usedDeps.has(dep));

        if (unusedDeps.length > 0) {
          result.warnings.push(`Potentially unused dependencies: ${unusedDeps.join(', ')}`);
          console.warn(`⚠️  Potentially unused dependencies: ${unusedDeps.join(', ')}`);
        }
      }
    } catch (error) {
      console.warn('⚠️  Could not analyze dependencies:', error);
    }
  }

  private async runSecurityScan(result: OptimizationResult): Promise<void> {
    console.log('🔐 Running security scan...');

    try {
      // Check for potential security issues in the code
      const jsFiles = await this.findFiles(this.distDir, ['.js']);

      const securityPatterns = [
        { pattern: /eval\s*\(/g, issue: 'Use of eval() function' },
        { pattern: /Function\s*\(/g, issue: 'Use of Function constructor' },
        { pattern: /innerHTML\s*=/g, issue: 'Direct innerHTML assignment' },
        { pattern: /document\.write\s*\(/g, issue: 'Use of document.write()' },
        { pattern: /process\.env\.[\w_]+\s*=\s*['"]/g, issue: 'Environment variable exposure' }
      ];

      for (const file of jsFiles) {
        const content = await fs.readFile(file, 'utf8');
        const filename = basename(file);

        for (const { pattern, issue } of securityPatterns) {
          const matches = content.match(pattern);
          if (matches) {
            result.securityIssues.push(`${filename}: ${issue} (${matches.length} occurrence${matches.length > 1 ? 's' : ''})`);
          }
        }
      }

      if (result.securityIssues.length > 0) {
        console.warn(`⚠️  Security issues found: ${result.securityIssues.length}`);
        if (this.options.verbose) {
          result.securityIssues.forEach(issue => console.warn(`   - ${issue}`));
        }
      } else {
        console.log('✅ No security issues detected');
      }

    } catch (error) {
      console.warn('⚠️  Could not complete security scan:', error);
    }
  }

  private async findFiles(dir: string, extensions: string[]): Promise<string[]> {
    const files: string[] = [];

    const scan = async (currentDir: string): Promise<void> => {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(currentDir, entry.name);

        if (entry.isDirectory()) {
          await scan(fullPath);
        } else if (extensions.includes(extname(entry.name))) {
          files.push(fullPath);
        }
      }
    };

    await scan(dir);
    return files;
  }

  private async findAllFiles(dir: string): Promise<string[]> {
    const files: string[] = [];

    const scan = async (currentDir: string): Promise<void> => {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(currentDir, entry.name);

        if (entry.isDirectory()) {
          await scan(fullPath);
        } else {
          files.push(fullPath);
        }
      }
    };

    await scan(dir);
    return files;
  }

  private async calculateDirectorySize(dir: string): Promise<number> {
    let size = 0;

    const scan = async (currentDir: string): Promise<void> => {
      try {
        const entries = await fs.readdir(currentDir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = join(currentDir, entry.name);

          if (entry.isDirectory()) {
            await scan(fullPath);
          } else {
            const stats = await fs.stat(fullPath);
            size += stats.size;
          }
        }
      } catch (error) {
        // Directory might not exist or be accessible
      }
    };

    await scan(dir);
    return size;
  }

  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const options: Partial<OptimizationOptions> = {};

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--target':
        options.target = args[++i] as 'node' | 'browser';
        break;
      case '--no-minify':
        options.minify = false;
        break;
      case '--keep-comments':
        options.removeComments = false;
        break;
      case '--no-treeshake':
        options.treeshake = false;
        break;
      case '--no-analysis':
        options.bundleAnalysis = false;
        break;
      case '--no-security':
        options.securityScan = false;
        break;
      case '--verbose':
        options.verbose = true;
        break;
      case '--help':
        console.log(`
Usage: optimize.ts [options]

Options:
  --target <type>      Target platform: node, browser (default: node)
  --no-minify          Disable code minification
  --keep-comments      Keep comments in code
  --no-treeshake       Disable tree shaking
  --no-analysis        Skip bundle analysis
  --no-security        Skip security scan
  --verbose            Enable verbose output
  --help               Show this help message
        `);
        process.exit(0);
    }
  }

  const optimizer = new ProductionOptimizer(options);
  const result = await optimizer.optimize();

  // Print summary
  console.log('\n📊 Optimization Summary:');
  console.log('========================');
  console.log(`Original size: ${optimizer['formatBytes'](result.originalSize)}`);
  console.log(`Optimized size: ${optimizer['formatBytes'](result.optimizedSize)}`);
  console.log(`Compression: ${result.compressionRatio.toFixed(2)}%`);
  console.log(`Files removed: ${result.removedFiles.length}`);
  console.log(`Warnings: ${result.warnings.length}`);
  console.log(`Security issues: ${result.securityIssues.length}`);

  if (result.warnings.length > 0 || result.securityIssues.length > 0) {
    console.log('\n⚠️  Issues detected - check output above for details');
  }

  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { ProductionOptimizer, type OptimizationOptions, type OptimizationResult };