#!/usr/bin/env tsx

/**
 * YouTube MCP Extended - Build Analysis Script
 * Analyzes build output for size, dependencies, and performance
 */

import { readFileSync, statSync, readdirSync } from 'fs';
import { join, extname, relative } from 'path';
import { execSync } from 'child_process';

interface FileAnalysis {
  path: string;
  size: number;
  type: string;
  dependencies?: string[];
}

interface BundleAnalysis {
  totalSize: number;
  files: FileAnalysis[];
  dependencies: Record<string, number>;
  recommendations: string[];
}

class BuildAnalyzer {
  private distDir: string;
  private packageJson: any;

  constructor(distDir: string = 'dist') {
    this.distDir = distDir;
    try {
      this.packageJson = JSON.parse(readFileSync('package.json', 'utf-8'));
    } catch {
      this.packageJson = {};
    }
  }

  private log(message: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') {
    const colors = {
      info: '\x1b[36m',    // Cyan
      success: '\x1b[32m', // Green
      error: '\x1b[31m',   // Red
      warn: '\x1b[33m',    // Yellow
      reset: '\x1b[0m'
    };

    console.log(`${colors[type]}${message}${colors.reset}`);
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private getAllFiles(dir: string): FileAnalysis[] {
    const files: FileAnalysis[] = [];

    try {
      const items = readdirSync(dir, { withFileTypes: true });

      for (const item of items) {
        const fullPath = join(dir, item.name);

        if (item.isDirectory()) {
          files.push(...this.getAllFiles(fullPath));
        } else {
          const stats = statSync(fullPath);
          files.push({
            path: relative(this.distDir, fullPath),
            size: stats.size,
            type: extname(item.name) || 'unknown',
            dependencies: this.analyzeDependencies(fullPath)
          });
        }
      }
    } catch (error) {
      this.log(`Error reading directory ${dir}: ${error}`, 'warn');
    }

    return files;
  }

  private analyzeDependencies(filePath: string): string[] {
    if (extname(filePath) !== '.js') return [];

    try {
      const content = readFileSync(filePath, 'utf-8');
      const dependencies: string[] = [];

      // Find require() calls
      const requireMatches = content.match(/require\(['"`]([^'"`]+)['"`]\)/g);
      if (requireMatches) {
        requireMatches.forEach(match => {
          const dep = match.match(/require\(['"`]([^'"`]+)['"`]\)/)?.[1];
          if (dep && !dep.startsWith('.') && !dep.startsWith('/')) {
            dependencies.push(dep);
          }
        });
      }

      // Find import statements
      const importMatches = content.match(/import\s+.*?\s+from\s+['"`]([^'"`]+)['"`]/g);
      if (importMatches) {
        importMatches.forEach(match => {
          const dep = match.match(/from\s+['"`]([^'"`]+)['"`]/)?.[1];
          if (dep && !dep.startsWith('.') && !dep.startsWith('/')) {
            dependencies.push(dep);
          }
        });
      }

      return [...new Set(dependencies)]; // Remove duplicates
    } catch {
      return [];
    }
  }

  private generateRecommendations(analysis: BundleAnalysis): string[] {
    const recommendations: string[] = [];

    // Size-based recommendations
    if (analysis.totalSize > 10 * 1024 * 1024) { // 10MB
      recommendations.push('Bundle size is quite large (>10MB). Consider code splitting or removing unused dependencies.');
    }

    // Large file recommendations
    const largeFiles = analysis.files.filter(file => file.size > 1024 * 1024); // 1MB
    if (largeFiles.length > 0) {
      recommendations.push(`Large files detected: ${largeFiles.map(f => f.path).join(', ')}. Consider optimizing or splitting these files.`);
    }

    // Dependency recommendations
    const heavyDependencies = Object.entries(analysis.dependencies)
      .filter(([, count]) => count > 10)
      .map(([dep]) => dep);

    if (heavyDependencies.length > 0) {
      recommendations.push(`Heavy dependencies found: ${heavyDependencies.join(', ')}. Consider alternatives or lazy loading.`);
    }

    // Type distribution recommendations
    const typeDistribution = analysis.files.reduce((acc, file) => {
      acc[file.type] = (acc[file.type] || 0) + file.size;
      return acc;
    }, {} as Record<string, number>);

    const jsSize = typeDistribution['.js'] || 0;
    const mapSize = typeDistribution['.map'] || 0;

    if (mapSize > jsSize * 0.5) {
      recommendations.push('Source maps are quite large. Consider generating them separately for production.');
    }

    // File count recommendations
    if (analysis.files.length > 100) {
      recommendations.push('Many files in bundle. Consider bundling to reduce HTTP requests.');
    }

    return recommendations;
  }

  public analyze(): BundleAnalysis {
    this.log('📊 Analyzing build output...', 'info');

    const files = this.getAllFiles(this.distDir);
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);

    // Count dependencies
    const dependencies: Record<string, number> = {};
    files.forEach(file => {
      file.dependencies?.forEach(dep => {
        dependencies[dep] = (dependencies[dep] || 0) + 1;
      });
    });

    const analysis: BundleAnalysis = {
      totalSize,
      files,
      dependencies,
      recommendations: []
    };

    analysis.recommendations = this.generateRecommendations(analysis);

    return analysis;
  }

  public printAnalysis(analysis: BundleAnalysis): void {
    console.log('');
    this.log('📋 Build Analysis Report', 'info');
    console.log('='.repeat(50));

    // Overview
    console.log('');
    this.log('📊 Overview:', 'info');
    console.log(`  Total bundle size: ${this.formatBytes(analysis.totalSize)}`);
    console.log(`  Number of files: ${analysis.files.length}`);
    console.log(`  Dependencies used: ${Object.keys(analysis.dependencies).length}`);

    // File size distribution
    console.log('');
    this.log('📁 File Size Distribution:', 'info');

    const sortedFiles = [...analysis.files].sort((a, b) => b.size - a.size);
    const topFiles = sortedFiles.slice(0, 10);

    topFiles.forEach((file, index) => {
      const percentage = ((file.size / analysis.totalSize) * 100).toFixed(1);
      console.log(`  ${index + 1}. ${file.path} - ${this.formatBytes(file.size)} (${percentage}%)`);
    });

    if (sortedFiles.length > 10) {
      const remainingSize = sortedFiles.slice(10).reduce((sum, file) => sum + file.size, 0);
      console.log(`  ... and ${sortedFiles.length - 10} more files (${this.formatBytes(remainingSize)})`);
    }

    // Type distribution
    console.log('');
    this.log('📄 File Type Distribution:', 'info');

    const typeDistribution = analysis.files.reduce((acc, file) => {
      acc[file.type] = (acc[file.type] || 0) + file.size;
      return acc;
    }, {} as Record<string, number>);

    Object.entries(typeDistribution)
      .sort(([, a], [, b]) => b - a)
      .forEach(([type, size]) => {
        const percentage = ((size / analysis.totalSize) * 100).toFixed(1);
        console.log(`  ${type || 'no extension'}: ${this.formatBytes(size)} (${percentage}%)`);
      });

    // Most used dependencies
    console.log('');
    this.log('📦 Most Used Dependencies:', 'info');

    const sortedDeps = Object.entries(analysis.dependencies)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);

    if (sortedDeps.length > 0) {
      sortedDeps.forEach(([dep, count]) => {
        console.log(`  ${dep}: used in ${count} files`);
      });
    } else {
      console.log('  No external dependencies detected');
    }

    // Recommendations
    if (analysis.recommendations.length > 0) {
      console.log('');
      this.log('💡 Recommendations:', 'warn');
      analysis.recommendations.forEach((rec, index) => {
        console.log(`  ${index + 1}. ${rec}`);
      });
    }

    // Performance metrics
    console.log('');
    this.log('⚡ Performance Metrics:', 'info');

    const gzipEstimate = analysis.totalSize * 0.3; // Rough gzip estimate
    console.log(`  Estimated gzipped size: ${this.formatBytes(gzipEstimate)}`);

    const downloadTime = this.calculateDownloadTime(analysis.totalSize);
    console.log(`  Download time estimates:`);
    console.log(`    Fast 3G (1.5 Mbps): ${downloadTime.fast3g}s`);
    console.log(`    4G (10 Mbps): ${downloadTime.fourG}s`);
    console.log(`    Broadband (50 Mbps): ${downloadTime.broadband}s`);

    console.log('');
    console.log('='.repeat(50));
  }

  private calculateDownloadTime(bytes: number): { fast3g: string; fourG: string; broadband: string } {
    const bits = bytes * 8;

    return {
      fast3g: (bits / (1.5 * 1024 * 1024)).toFixed(1),
      fourG: (bits / (10 * 1024 * 1024)).toFixed(1),
      broadband: (bits / (50 * 1024 * 1024)).toFixed(1)
    };
  }

  public generateReport(): void {
    try {
      const analysis = this.analyze();
      this.printAnalysis(analysis);

      // Save detailed report to file
      const reportPath = join(this.distDir, 'analysis-report.json');
      require('fs').writeFileSync(reportPath, JSON.stringify(analysis, null, 2));

      console.log('');
      this.log(`📄 Detailed report saved to: ${reportPath}`, 'success');

    } catch (error) {
      this.log(`Analysis failed: ${error}`, 'error');
      throw error;
    }
  }
}

// CLI Handler
async function main() {
  const distDir = process.argv[2] || 'dist';
  const analyzer = new BuildAnalyzer(distDir);

  try {
    analyzer.generateReport();
  } catch (error) {
    console.error('Build analysis failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { BuildAnalyzer };