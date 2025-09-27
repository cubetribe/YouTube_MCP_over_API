#!/usr/bin/env tsx

/**
 * Pre-build Validation Scripts for YouTube MCP Extended
 *
 * Features:
 * - Environment validation
 * - Dependency checking
 * - Configuration validation
 * - Code quality checks
 * - Security auditing
 * - Performance baseline
 */

import { promises as fs } from 'fs';
import { join, resolve } from 'path';
import { execSync } from 'child_process';
import { createHash } from 'crypto';

interface ValidationOptions {
  skipLint?: boolean;
  skipTests?: boolean;
  skipSecurity?: boolean;
  skipDependencies?: boolean;
  skipEnvironment?: boolean;
  verbose?: boolean;
}

interface ValidationResult {
  success: boolean;
  checks: ValidationCheck[];
  errors: string[];
  warnings: string[];
  duration: number;
}

interface ValidationCheck {
  name: string;
  status: 'passed' | 'failed' | 'warning' | 'skipped';
  message: string;
  details?: string[];
}

class PreBuildValidator {
  private projectRoot: string;
  private options: ValidationOptions;

  constructor(options: ValidationOptions = {}) {
    this.projectRoot = resolve(process.cwd());
    this.options = options;
  }

  async validate(): Promise<ValidationResult> {
    const startTime = Date.now();
    const result: ValidationResult = {
      success: false,
      checks: [],
      errors: [],
      warnings: [],
      duration: 0
    };

    console.log('🔍 Starting pre-build validation...');

    try {
      // Run all validation checks
      await this.validateEnvironment(result);
      await this.validateDependencies(result);
      await this.validateConfiguration(result);
      await this.validateCodeQuality(result);
      await this.validateSecurity(result);
      await this.validateTypeScript(result);
      await this.validateGitState(result);

      // Determine overall success
      result.success = !result.checks.some(check => check.status === 'failed');
      result.duration = Date.now() - startTime;

      if (result.success) {
        console.log('✅ All pre-build validations passed');
      } else {
        console.error('❌ Pre-build validation failed');
      }

    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : String(error));
      result.duration = Date.now() - startTime;
    }

    return result;
  }

  private async validateEnvironment(result: ValidationResult): Promise<void> {
    if (this.options.skipEnvironment) {
      result.checks.push({
        name: 'Environment',
        status: 'skipped',
        message: 'Environment validation skipped'
      });
      return;
    }

    console.log('🌍 Validating environment...');

    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

    if (majorVersion >= 20) {
      result.checks.push({
        name: 'Node.js Version',
        status: 'passed',
        message: `Node.js ${nodeVersion} is supported`
      });
    } else {
      result.checks.push({
        name: 'Node.js Version',
        status: 'failed',
        message: `Node.js ${nodeVersion} is not supported. Requires 20+`
      });
    }

    // Check npm version
    try {
      const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
      result.checks.push({
        name: 'npm Version',
        status: 'passed',
        message: `npm ${npmVersion} is available`
      });
    } catch {
      result.checks.push({
        name: 'npm Version',
        status: 'failed',
        message: 'npm is not available'
      });
    }

    // Check TypeScript compiler
    try {
      const tscVersion = execSync('npx tsc --version', { encoding: 'utf8' }).trim();
      result.checks.push({
        name: 'TypeScript Compiler',
        status: 'passed',
        message: `${tscVersion} is available`
      });
    } catch {
      result.checks.push({
        name: 'TypeScript Compiler',
        status: 'failed',
        message: 'TypeScript compiler is not available'
      });
    }

    // Check disk space
    try {
      const stats = await fs.statfs(this.projectRoot);
      const freeSpaceGB = (stats.bavail * stats.bsize) / (1024 * 1024 * 1024);

      if (freeSpaceGB > 1) {
        result.checks.push({
          name: 'Disk Space',
          status: 'passed',
          message: `${freeSpaceGB.toFixed(2)} GB available`
        });
      } else {
        result.checks.push({
          name: 'Disk Space',
          status: 'warning',
          message: `Low disk space: ${freeSpaceGB.toFixed(2)} GB available`
        });
      }
    } catch {
      result.checks.push({
        name: 'Disk Space',
        status: 'warning',
        message: 'Could not check disk space'
      });
    }
  }

  private async validateDependencies(result: ValidationResult): Promise<void> {
    if (this.options.skipDependencies) {
      result.checks.push({
        name: 'Dependencies',
        status: 'skipped',
        message: 'Dependency validation skipped'
      });
      return;
    }

    console.log('📦 Validating dependencies...');

    // Check if node_modules exists
    const nodeModulesPath = join(this.projectRoot, 'node_modules');
    try {
      await fs.access(nodeModulesPath);
      result.checks.push({
        name: 'node_modules',
        status: 'passed',
        message: 'node_modules directory exists'
      });
    } catch {
      result.checks.push({
        name: 'node_modules',
        status: 'failed',
        message: 'node_modules directory not found. Run: npm install'
      });
      return;
    }

    // Validate package-lock.json
    const packageLockPath = join(this.projectRoot, 'package-lock.json');
    try {
      await fs.access(packageLockPath);
      result.checks.push({
        name: 'package-lock.json',
        status: 'passed',
        message: 'package-lock.json exists'
      });
    } catch {
      result.checks.push({
        name: 'package-lock.json',
        status: 'warning',
        message: 'package-lock.json not found'
      });
    }

    // Check for outdated dependencies
    try {
      const outdatedOutput = execSync('npm outdated --json', {
        cwd: this.projectRoot,
        encoding: 'utf8',
        stdio: 'pipe'
      });

      const outdated = JSON.parse(outdatedOutput);
      const outdatedCount = Object.keys(outdated).length;

      if (outdatedCount === 0) {
        result.checks.push({
          name: 'Outdated Dependencies',
          status: 'passed',
          message: 'All dependencies are up to date'
        });
      } else {
        result.checks.push({
          name: 'Outdated Dependencies',
          status: 'warning',
          message: `${outdatedCount} outdated dependencies found`,
          details: Object.keys(outdated)
        });
      }
    } catch {
      // npm outdated returns non-zero exit code when outdated packages exist
      result.checks.push({
        name: 'Outdated Dependencies',
        status: 'warning',
        message: 'Could not check for outdated dependencies'
      });
    }

    // Check for known vulnerabilities
    try {
      execSync('npm audit --audit-level moderate', {
        cwd: this.projectRoot,
        stdio: 'pipe'
      });

      result.checks.push({
        name: 'Security Vulnerabilities',
        status: 'passed',
        message: 'No security vulnerabilities found'
      });
    } catch {
      result.checks.push({
        name: 'Security Vulnerabilities',
        status: 'warning',
        message: 'Security vulnerabilities found. Run: npm audit fix'
      });
    }
  }

  private async validateConfiguration(result: ValidationResult): Promise<void> {
    console.log('⚙️  Validating configuration...');

    // Check tsconfig.json
    const tsconfigPath = join(this.projectRoot, 'tsconfig.json');
    try {
      const tsconfigContent = await fs.readFile(tsconfigPath, 'utf8');
      const tsconfig = JSON.parse(tsconfigContent);

      // Validate key configuration options
      const checks = [
        { key: 'compilerOptions.outDir', expected: './dist', message: 'Output directory' },
        { key: 'compilerOptions.rootDir', expected: './src', message: 'Root directory' },
        { key: 'compilerOptions.target', minimum: 'ES2022', message: 'Target ES version' },
        { key: 'compilerOptions.module', expected: 'ESNext', message: 'Module system' }
      ];

      let configValid = true;

      for (const check of checks) {
        const value = this.getNestedProperty(tsconfig, check.key);
        if (check.expected && value !== check.expected) {
          configValid = false;
          break;
        }
        if (check.minimum && !value) {
          configValid = false;
          break;
        }
      }

      result.checks.push({
        name: 'TypeScript Configuration',
        status: configValid ? 'passed' : 'warning',
        message: configValid ? 'tsconfig.json is valid' : 'tsconfig.json may need adjustments'
      });

    } catch {
      result.checks.push({
        name: 'TypeScript Configuration',
        status: 'failed',
        message: 'tsconfig.json not found or invalid'
      });
    }

    // Check package.json
    const packageJsonPath = join(this.projectRoot, 'package.json');
    try {
      const packageContent = await fs.readFile(packageJsonPath, 'utf8');
      const packageJson = JSON.parse(packageContent);

      const requiredFields = ['name', 'version', 'main', 'scripts'];
      const missingFields = requiredFields.filter(field => !packageJson[field]);

      if (missingFields.length === 0) {
        result.checks.push({
          name: 'Package Configuration',
          status: 'passed',
          message: 'package.json is valid'
        });
      } else {
        result.checks.push({
          name: 'Package Configuration',
          status: 'warning',
          message: `Missing fields in package.json: ${missingFields.join(', ')}`
        });
      }

    } catch {
      result.checks.push({
        name: 'Package Configuration',
        status: 'failed',
        message: 'package.json not found or invalid'
      });
    }

    // Check for environment file
    const envPath = join(this.projectRoot, '.env');
    try {
      await fs.access(envPath);
      result.checks.push({
        name: 'Environment File',
        status: 'passed',
        message: '.env file exists'
      });
    } catch {
      result.checks.push({
        name: 'Environment File',
        status: 'warning',
        message: '.env file not found'
      });
    }
  }

  private async validateCodeQuality(result: ValidationResult): Promise<void> {
    console.log('📝 Validating code quality...');

    // Run ESLint
    if (!this.options.skipLint) {
      try {
        execSync('npm run lint', {
          cwd: this.projectRoot,
          stdio: 'pipe'
        });

        result.checks.push({
          name: 'ESLint',
          status: 'passed',
          message: 'No linting errors found'
        });
      } catch (error: any) {
        const isWarningOnly = error.status === 1; // ESLint returns 1 for warnings

        result.checks.push({
          name: 'ESLint',
          status: isWarningOnly ? 'warning' : 'failed',
          message: isWarningOnly ? 'Linting warnings found' : 'Linting errors found'
        });
      }
    } else {
      result.checks.push({
        name: 'ESLint',
        status: 'skipped',
        message: 'Linting skipped'
      });
    }

    // Run Prettier check
    try {
      execSync('npx prettier --check "src/**/*.ts"', {
        cwd: this.projectRoot,
        stdio: 'pipe'
      });

      result.checks.push({
        name: 'Prettier',
        status: 'passed',
        message: 'Code formatting is consistent'
      });
    } catch {
      result.checks.push({
        name: 'Prettier',
        status: 'warning',
        message: 'Code formatting inconsistencies found. Run: npm run format'
      });
    }

    // Run tests
    if (!this.options.skipTests) {
      try {
        execSync('npm test', {
          cwd: this.projectRoot,
          stdio: 'pipe',
          env: { ...process.env, CI: 'true' }
        });

        result.checks.push({
          name: 'Tests',
          status: 'passed',
          message: 'All tests passed'
        });
      } catch {
        result.checks.push({
          name: 'Tests',
          status: 'failed',
          message: 'Some tests are failing'
        });
      }
    } else {
      result.checks.push({
        name: 'Tests',
        status: 'skipped',
        message: 'Tests skipped'
      });
    }
  }

  private async validateSecurity(result: ValidationResult): Promise<void> {
    if (this.options.skipSecurity) {
      result.checks.push({
        name: 'Security',
        status: 'skipped',
        message: 'Security validation skipped'
      });
      return;
    }

    console.log('🔒 Validating security...');

    // Check for sensitive files
    const sensitiveFiles = ['.env', 'secrets.json', 'private.key', '.aws/credentials'];
    const foundSensitiveFiles: string[] = [];

    for (const file of sensitiveFiles) {
      const filePath = join(this.projectRoot, file);
      try {
        await fs.access(filePath);
        foundSensitiveFiles.push(file);
      } catch {
        // File doesn't exist, which is expected for most
      }
    }

    if (foundSensitiveFiles.length > 0) {
      result.checks.push({
        name: 'Sensitive Files',
        status: 'warning',
        message: `Sensitive files found: ${foundSensitiveFiles.join(', ')}`,
        details: ['Ensure these files are properly secured and not committed to git']
      });
    } else {
      result.checks.push({
        name: 'Sensitive Files',
        status: 'passed',
        message: 'No sensitive files found in project root'
      });
    }

    // Check .gitignore
    const gitignorePath = join(this.projectRoot, '.gitignore');
    try {
      const gitignoreContent = await fs.readFile(gitignorePath, 'utf8');
      const requiredPatterns = ['node_modules', '.env', 'dist', '*.log'];
      const missingPatterns = requiredPatterns.filter(pattern => !gitignoreContent.includes(pattern));

      if (missingPatterns.length === 0) {
        result.checks.push({
          name: 'Git Ignore',
          status: 'passed',
          message: '.gitignore includes essential patterns'
        });
      } else {
        result.checks.push({
          name: 'Git Ignore',
          status: 'warning',
          message: `Missing .gitignore patterns: ${missingPatterns.join(', ')}`
        });
      }
    } catch {
      result.checks.push({
        name: 'Git Ignore',
        status: 'warning',
        message: '.gitignore file not found'
      });
    }
  }

  private async validateTypeScript(result: ValidationResult): Promise<void> {
    console.log('📘 Validating TypeScript...');

    // Run TypeScript compiler check
    try {
      execSync('npx tsc --noEmit', {
        cwd: this.projectRoot,
        stdio: 'pipe'
      });

      result.checks.push({
        name: 'TypeScript Compilation',
        status: 'passed',
        message: 'TypeScript compilation successful'
      });
    } catch {
      result.checks.push({
        name: 'TypeScript Compilation',
        status: 'failed',
        message: 'TypeScript compilation errors found'
      });
    }

    // Check for source files
    const srcDir = join(this.projectRoot, 'src');
    try {
      const files = await fs.readdir(srcDir, { recursive: true });
      const tsFiles = files.filter((file: any) => file.toString().endsWith('.ts'));

      if (tsFiles.length > 0) {
        result.checks.push({
          name: 'Source Files',
          status: 'passed',
          message: `Found ${tsFiles.length} TypeScript source files`
        });
      } else {
        result.checks.push({
          name: 'Source Files',
          status: 'warning',
          message: 'No TypeScript source files found in src/'
        });
      }
    } catch {
      result.checks.push({
        name: 'Source Files',
        status: 'failed',
        message: 'src/ directory not found'
      });
    }
  }

  private async validateGitState(result: ValidationResult): Promise<void> {
    console.log('🔀 Validating Git state...');

    try {
      // Check if git repo
      execSync('git rev-parse --git-dir', {
        cwd: this.projectRoot,
        stdio: 'pipe'
      });

      // Check for uncommitted changes
      const status = execSync('git status --porcelain', {
        cwd: this.projectRoot,
        encoding: 'utf8'
      });

      if (status.trim() === '') {
        result.checks.push({
          name: 'Git Status',
          status: 'passed',
          message: 'Working directory is clean'
        });
      } else {
        const lines = status.trim().split('\n');
        result.checks.push({
          name: 'Git Status',
          status: 'warning',
          message: `${lines.length} uncommitted changes found`
        });
      }

    } catch {
      result.checks.push({
        name: 'Git Status',
        status: 'warning',
        message: 'Not a git repository or git not available'
      });
    }
  }

  private getNestedProperty(obj: any, path: string): any {
    return path.split('.').reduce((current, prop) => current?.[prop], obj);
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const options: ValidationOptions = {};

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--skip-lint':
        options.skipLint = true;
        break;
      case '--skip-tests':
        options.skipTests = true;
        break;
      case '--skip-security':
        options.skipSecurity = true;
        break;
      case '--skip-deps':
        options.skipDependencies = true;
        break;
      case '--skip-env':
        options.skipEnvironment = true;
        break;
      case '--verbose':
        options.verbose = true;
        break;
      case '--help':
        console.log(`
Usage: pre-build.ts [options]

Options:
  --skip-lint        Skip ESLint validation
  --skip-tests       Skip test execution
  --skip-security    Skip security checks
  --skip-deps        Skip dependency validation
  --skip-env         Skip environment validation
  --verbose          Enable verbose output
  --help             Show this help message
        `);
        process.exit(0);
    }
  }

  const validator = new PreBuildValidator(options);
  const result = await validator.validate();

  // Print detailed results
  console.log('\n📊 Validation Summary:');
  console.log('======================');

  for (const check of result.checks) {
    const icon = {
      passed: '✅',
      failed: '❌',
      warning: '⚠️',
      skipped: '⏭️'
    }[check.status];

    console.log(`${icon} ${check.name}: ${check.message}`);

    if (options.verbose && check.details) {
      check.details.forEach(detail => console.log(`   - ${detail}`));
    }
  }

  const summary = result.checks.reduce((acc, check) => {
    acc[check.status] = (acc[check.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('\n📈 Results:');
  console.log(`   Passed: ${summary.passed || 0}`);
  console.log(`   Failed: ${summary.failed || 0}`);
  console.log(`   Warnings: ${summary.warning || 0}`);
  console.log(`   Skipped: ${summary.skipped || 0}`);
  console.log(`   Duration: ${result.duration}ms`);

  if (result.errors.length > 0) {
    console.log('\n❌ Validation Errors:');
    result.errors.forEach(error => console.log(`   - ${error}`));
  }

  process.exit(result.success ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { PreBuildValidator, type ValidationOptions, type ValidationResult };