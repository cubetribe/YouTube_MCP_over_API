#!/usr/bin/env tsx

/**
 * YouTube MCP Extended - Environment Validator
 * Validates development and production environment setup
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

interface ValidationResult {
  passed: boolean;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

interface EnvironmentConfig {
  required: string[];
  optional: string[];
  defaultValues: Record<string, string>;
}

class EnvironmentValidator {
  private rootDir: string;
  private results: ValidationResult[] = [];

  constructor() {
    this.rootDir = process.cwd();
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

  private addResult(passed: boolean, message: string, severity: 'error' | 'warning' | 'info' = 'error') {
    this.results.push({ passed, message, severity });
  }

  private validateNodeVersion(): void {
    this.log('Checking Node.js version...', 'info');

    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    const minorVersion = parseInt(nodeVersion.slice(1).split('.')[1]);

    if (majorVersion < 20) {
      this.addResult(false, `Node.js 20+ required. Current: ${nodeVersion}`, 'error');
    } else if (majorVersion === 20 && minorVersion < 0) {
      this.addResult(false, `Node.js 20.0+ required. Current: ${nodeVersion}`, 'warning');
    } else {
      this.addResult(true, `Node.js version ${nodeVersion} is compatible`, 'info');
    }
  }

  private validatePackageManager(): void {
    this.log('Checking package manager...', 'info');

    try {
      const npmVersion = execSync('npm --version', { encoding: 'utf-8' }).trim();
      this.addResult(true, `npm version ${npmVersion} detected`, 'info');

      // Check if package-lock.json exists
      if (existsSync(join(this.rootDir, 'package-lock.json'))) {
        this.addResult(true, 'package-lock.json found - consistent dependency tree', 'info');
      } else {
        this.addResult(false, 'package-lock.json missing - run npm install', 'warning');
      }
    } catch (error) {
      this.addResult(false, 'npm not found or not working properly', 'error');
    }
  }

  private validateRequiredFiles(): void {
    this.log('Checking required files...', 'info');

    const requiredFiles = [
      'package.json',
      'tsconfig.json',
      'src/index.ts',
      '.gitignore'
    ];

    for (const file of requiredFiles) {
      const filePath = join(this.rootDir, file);
      if (existsSync(filePath)) {
        this.addResult(true, `${file} exists`, 'info');
      } else {
        this.addResult(false, `${file} missing`, 'error');
      }
    }
  }

  private validateDependencies(): void {
    this.log('Checking dependencies...', 'info');

    try {
      const packageJson = JSON.parse(readFileSync(join(this.rootDir, 'package.json'), 'utf-8'));

      // Check for required dependencies
      const requiredDeps = [
        '@modelcontextprotocol/sdk',
        'google-auth-library',
        'googleapis',
        'uuid',
        'zod'
      ];

      const requiredDevDeps = [
        'typescript',
        'tsx',
        '@types/node'
      ];

      for (const dep of requiredDeps) {
        if (packageJson.dependencies?.[dep]) {
          this.addResult(true, `Dependency ${dep} found`, 'info');
        } else {
          this.addResult(false, `Required dependency ${dep} missing`, 'error');
        }
      }

      for (const dep of requiredDevDeps) {
        if (packageJson.devDependencies?.[dep]) {
          this.addResult(true, `Dev dependency ${dep} found`, 'info');
        } else {
          this.addResult(false, `Required dev dependency ${dep} missing`, 'error');
        }
      }

      // Check if node_modules exists
      if (existsSync(join(this.rootDir, 'node_modules'))) {
        this.addResult(true, 'node_modules directory exists', 'info');
      } else {
        this.addResult(false, 'node_modules missing - run npm install', 'error');
      }

    } catch (error) {
      this.addResult(false, 'Failed to read package.json', 'error');
    }
  }

  private validateEnvironmentVariables(): void {
    this.log('Checking environment variables...', 'info');

    const envConfig: EnvironmentConfig = {
      required: [
        'YOUTUBE_CLIENT_ID',
        'YOUTUBE_CLIENT_SECRET'
      ],
      optional: [
        'YOUTUBE_REDIRECT_URI',
        'OAUTH_ENCRYPTION_SECRET',
        'NODE_ENV',
        'PORT',
        'LOG_LEVEL'
      ],
      defaultValues: {
        'YOUTUBE_REDIRECT_URI': 'http://localhost:3000/callback',
        'NODE_ENV': 'development',
        'PORT': '3000',
        'LOG_LEVEL': 'info'
      }
    };

    // Load environment variables from .env if exists
    const envFile = join(this.rootDir, '.env');
    const envExampleFile = join(this.rootDir, '.env.example');

    let envVars: Record<string, string> = { ...process.env };

    if (existsSync(envFile)) {
      this.addResult(true, '.env file found', 'info');
      try {
        const envContent = readFileSync(envFile, 'utf-8');
        for (const line of envContent.split('\n')) {
          const match = line.match(/^([^=]+)=(.*)$/);
          if (match) {
            const [, key, value] = match;
            envVars[key.trim()] = value.trim().replace(/^["']|["']$/g, '');
          }
        }
      } catch (error) {
        this.addResult(false, 'Failed to parse .env file', 'warning');
      }
    } else {
      this.addResult(false, '.env file missing', 'warning');
    }

    if (existsSync(envExampleFile)) {
      this.addResult(true, '.env.example file found', 'info');
    } else {
      this.addResult(false, '.env.example file missing', 'warning');
    }

    // Check required environment variables
    for (const varName of envConfig.required) {
      if (envVars[varName]) {
        this.addResult(true, `${varName} is set`, 'info');
      } else {
        this.addResult(false, `Required environment variable ${varName} missing`, 'error');
      }
    }

    // Check optional environment variables
    for (const varName of envConfig.optional) {
      if (envVars[varName]) {
        this.addResult(true, `${varName} is set`, 'info');
      } else {
        const defaultValue = envConfig.defaultValues[varName];
        if (defaultValue) {
          this.addResult(true, `${varName} will use default: ${defaultValue}`, 'info');
        } else {
          this.addResult(true, `Optional ${varName} not set`, 'info');
        }
      }
    }
  }

  private validateTypeScript(): void {
    this.log('Checking TypeScript configuration...', 'info');

    try {
      const tsConfig = JSON.parse(readFileSync(join(this.rootDir, 'tsconfig.json'), 'utf-8'));

      // Check essential TypeScript settings
      const requiredSettings = {
        'target': ['ES2020', 'ES2021', 'ES2022', 'ESNext'],
        'module': ['ESNext', 'CommonJS'],
        'moduleResolution': ['node'],
        'strict': [true, false], // Allow both for flexibility
        'esModuleInterop': [true],
        'skipLibCheck': [true]
      };

      for (const [setting, allowedValues] of Object.entries(requiredSettings)) {
        const currentValue = tsConfig.compilerOptions?.[setting];
        if (allowedValues.includes(currentValue)) {
          this.addResult(true, `TypeScript ${setting}: ${currentValue}`, 'info');
        } else {
          this.addResult(false, `TypeScript ${setting} should be one of: ${allowedValues.join(', ')}. Current: ${currentValue}`, 'warning');
        }
      }

      // Check if TypeScript can compile
      try {
        execSync('npx tsc --noEmit', { encoding: 'utf-8', stdio: 'pipe' });
        this.addResult(true, 'TypeScript compilation check passed', 'info');
      } catch (error) {
        this.addResult(false, 'TypeScript compilation has errors', 'warning');
      }

    } catch (error) {
      this.addResult(false, 'Failed to read tsconfig.json', 'error');
    }
  }

  private validateGitConfiguration(): void {
    this.log('Checking Git configuration...', 'info');

    try {
      execSync('git --version', { encoding: 'utf-8', stdio: 'pipe' });
      this.addResult(true, 'Git is available', 'info');

      if (existsSync(join(this.rootDir, '.git'))) {
        this.addResult(true, 'Git repository initialized', 'info');

        try {
          const gitStatus = execSync('git status --porcelain', { encoding: 'utf-8', stdio: 'pipe' });
          if (gitStatus.trim()) {
            this.addResult(true, 'Working directory has changes', 'info');
          } else {
            this.addResult(true, 'Working directory is clean', 'info');
          }
        } catch (error) {
          this.addResult(false, 'Git status check failed', 'warning');
        }
      } else {
        this.addResult(false, 'Not a Git repository', 'warning');
      }
    } catch (error) {
      this.addResult(false, 'Git not available', 'warning');
    }
  }

  private validateDirectoryStructure(): void {
    this.log('Checking directory structure...', 'info');

    const expectedDirs = [
      'src',
      'agents',
      'scripts',
      'dist'
    ];

    const optionalDirs = [
      'tests',
      'docs',
      'examples',
      'backups',
      'tokens',
      'storage'
    ];

    for (const dir of expectedDirs) {
      const dirPath = join(this.rootDir, dir);
      if (existsSync(dirPath)) {
        this.addResult(true, `Directory ${dir}/ exists`, 'info');
      } else {
        this.addResult(false, `Expected directory ${dir}/ missing`, 'warning');
      }
    }

    for (const dir of optionalDirs) {
      const dirPath = join(this.rootDir, dir);
      if (existsSync(dirPath)) {
        this.addResult(true, `Optional directory ${dir}/ exists`, 'info');
      }
    }
  }

  public async validate(): Promise<boolean> {
    this.log('🔍 Starting environment validation...', 'info');
    this.log('', 'info');

    this.validateNodeVersion();
    this.validatePackageManager();
    this.validateRequiredFiles();
    this.validateDependencies();
    this.validateEnvironmentVariables();
    this.validateTypeScript();
    this.validateGitConfiguration();
    this.validateDirectoryStructure();

    this.log('', 'info');
    this.log('📊 Validation Results:', 'info');
    this.log('', 'info');

    let hasErrors = false;
    let hasWarnings = false;

    const errors = this.results.filter(r => !r.passed && r.severity === 'error');
    const warnings = this.results.filter(r => !r.passed && r.severity === 'warning');
    const info = this.results.filter(r => r.passed);

    if (errors.length > 0) {
      hasErrors = true;
      this.log('❌ Errors:', 'error');
      errors.forEach(result => this.log(`  • ${result.message}`, 'error'));
      this.log('', 'info');
    }

    if (warnings.length > 0) {
      hasWarnings = true;
      this.log('⚠️  Warnings:', 'warn');
      warnings.forEach(result => this.log(`  • ${result.message}`, 'warn'));
      this.log('', 'info');
    }

    if (info.length > 0) {
      this.log('✅ Passed checks:', 'success');
      info.forEach(result => this.log(`  • ${result.message}`, 'success'));
      this.log('', 'info');
    }

    const summary = hasErrors
      ? 'Environment validation failed with errors'
      : hasWarnings
        ? 'Environment validation passed with warnings'
        : 'Environment validation passed successfully';

    this.log(`📋 Summary: ${summary}`, hasErrors ? 'error' : hasWarnings ? 'warn' : 'success');

    if (hasErrors) {
      this.log('', 'info');
      this.log('💡 To fix errors:', 'info');
      this.log('  1. Install missing dependencies: npm install', 'info');
      this.log('  2. Create .env file from .env.example', 'info');
      this.log('  3. Set required environment variables', 'info');
      this.log('  4. Ensure Node.js 20+ is installed', 'info');
    }

    return !hasErrors;
  }

  public generateEnvTemplate(): void {
    this.log('Generating .env.example template...', 'info');

    const envTemplate = `# YouTube MCP Extended - Environment Configuration

# Required: OAuth credentials from Google Cloud Console
YOUTUBE_CLIENT_ID=your_youtube_client_id_here
YOUTUBE_CLIENT_SECRET=your_youtube_client_secret_here

# Optional: OAuth redirect URI (defaults to http://localhost:3000/callback)
YOUTUBE_REDIRECT_URI=http://localhost:3000/callback

# Optional: Secret for encrypting stored OAuth tokens
OAUTH_ENCRYPTION_SECRET=your_32_character_encryption_key

# Optional: Application settings
NODE_ENV=development
PORT=3000
LOG_LEVEL=info

# Optional: API settings
API_TIMEOUT=30000
BATCH_SIZE=50
RATE_LIMIT_DELAY=1000
`;

    const envExamplePath = join(this.rootDir, '.env.example');

    try {
      require('fs').writeFileSync(envExamplePath, envTemplate);
      this.log(`.env.example created at ${envExamplePath}`, 'success');
      this.log('Copy this file to .env and fill in your values', 'info');
    } catch (error) {
      this.log(`Failed to create .env.example: ${error}`, 'error');
    }
  }
}

// CLI Handler
async function main() {
  const command = process.argv[2] || 'validate';
  const validator = new EnvironmentValidator();

  switch (command) {
    case 'validate':
    case 'check':
      const isValid = await validator.validate();
      process.exit(isValid ? 0 : 1);
      break;
    case 'generate-env':
    case 'env':
      validator.generateEnvTemplate();
      break;
    default:
      console.log(`
Usage: tsx env-validator.ts <command>

Commands:
  validate      Validate environment setup (default)
  check         Alias for validate
  generate-env  Generate .env.example template
  env           Alias for generate-env

Examples:
  tsx env-validator.ts
  tsx env-validator.ts validate
  tsx env-validator.ts generate-env
      `);
      process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Environment validation failed:', error);
    process.exit(1);
  });
}

export { EnvironmentValidator };