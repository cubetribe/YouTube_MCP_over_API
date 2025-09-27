#!/usr/bin/env tsx

/**
 * YouTube MCP Extended - Health Check Script
 * Validates application health and environment readiness
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

interface HealthCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  details?: any;
}

interface HealthReport {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  checks: HealthCheck[];
  timestamp: string;
  version: string;
}

class HealthChecker {
  private checks: HealthCheck[] = [];

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

  private addCheck(name: string, status: 'pass' | 'fail' | 'warn', message: string, details?: any) {
    this.checks.push({ name, status, message, details });
  }

  private async execCommand(command: string): Promise<{ stdout: string; success: boolean }> {
    try {
      const stdout = execSync(command, { encoding: 'utf-8', stdio: 'pipe' });
      return { stdout, success: true };
    } catch (error: any) {
      return { stdout: error.message, success: false };
    }
  }

  // Core system checks
  private checkNodeVersion(): void {
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

    if (majorVersion >= 20) {
      this.addCheck('Node.js Version', 'pass', `Node.js ${nodeVersion} is supported`);
    } else if (majorVersion >= 18) {
      this.addCheck('Node.js Version', 'warn', `Node.js ${nodeVersion} works but 20+ recommended`);
    } else {
      this.addCheck('Node.js Version', 'fail', `Node.js ${nodeVersion} is too old. Requires 18+`);
    }
  }

  private checkMemory(): void {
    const totalMemory = process.memoryUsage();
    const heapUsed = Math.round(totalMemory.heapUsed / 1024 / 1024);
    const heapTotal = Math.round(totalMemory.heapTotal / 1024 / 1024);
    const external = Math.round(totalMemory.external / 1024 / 1024);

    if (heapUsed < 100) {
      this.addCheck('Memory Usage', 'pass', `Heap: ${heapUsed}MB / ${heapTotal}MB, External: ${external}MB`);
    } else if (heapUsed < 200) {
      this.addCheck('Memory Usage', 'warn', `Heap: ${heapUsed}MB / ${heapTotal}MB - Consider monitoring`);
    } else {
      this.addCheck('Memory Usage', 'fail', `Heap: ${heapUsed}MB / ${heapTotal}MB - High memory usage`);
    }
  }

  private checkDiskSpace(): void {
    try {
      const { stdout } = execSync('df -h .', { encoding: 'utf-8' });
      const lines = stdout.split('\n');
      if (lines.length > 1) {
        const parts = lines[1].split(/\s+/);
        const used = parts[4];
        const usedPercent = parseInt(used.replace('%', ''));

        if (usedPercent < 80) {
          this.addCheck('Disk Space', 'pass', `${used} used - Sufficient space available`);
        } else if (usedPercent < 90) {
          this.addCheck('Disk Space', 'warn', `${used} used - Monitor disk space`);
        } else {
          this.addCheck('Disk Space', 'fail', `${used} used - Low disk space`);
        }
      }
    } catch (error) {
      this.addCheck('Disk Space', 'warn', 'Could not check disk space');
    }
  }

  // Application-specific checks
  private checkEnvironmentVariables(): void {
    const requiredVars = ['YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET'];
    const optionalVars = ['YOUTUBE_REDIRECT_URI', 'OAUTH_ENCRYPTION_SECRET'];

    let missing = 0;
    let optional = 0;

    // Load .env file if exists
    const envFile = '.env';
    let envVars: Record<string, string> = { ...process.env };

    if (existsSync(envFile)) {
      try {
        const envContent = readFileSync(envFile, 'utf-8');
        for (const line of envContent.split('\n')) {
          const match = line.match(/^([^=]+)=(.*)$/);
          if (match) {
            const [, key, value] = match;
            envVars[key.trim()] = value.trim();
          }
        }
      } catch {
        // Ignore parsing errors
      }
    }

    for (const varName of requiredVars) {
      if (!envVars[varName]) {
        missing++;
      }
    }

    for (const varName of optionalVars) {
      if (envVars[varName]) {
        optional++;
      }
    }

    if (missing === 0) {
      this.addCheck('Environment Variables', 'pass', `All required variables set, ${optional} optional variables configured`);
    } else {
      this.addCheck('Environment Variables', 'fail', `${missing} required variables missing: ${requiredVars.filter(v => !envVars[v]).join(', ')}`);
    }
  }

  private checkDirectories(): void {
    const requiredDirs = ['src', 'dist'];
    const dataDir = ['tokens', 'backups', 'storage', 'logs'];

    let missing = 0;
    let dataExists = 0;

    for (const dir of requiredDirs) {
      if (!existsSync(dir)) {
        missing++;
      }
    }

    for (const dir of dataDir) {
      if (existsSync(dir)) {
        dataExists++;
      }
    }

    if (missing === 0) {
      this.addCheck('Directory Structure', 'pass', `Required directories exist, ${dataExists} data directories initialized`);
    } else {
      this.addCheck('Directory Structure', 'fail', `${missing} required directories missing`);
    }
  }

  private checkDependencies(): void {
    try {
      const packageJson = JSON.parse(readFileSync('package.json', 'utf-8'));
      const nodeModulesExists = existsSync('node_modules');

      if (nodeModulesExists) {
        // Check if package-lock.json exists for consistency
        const lockExists = existsSync('package-lock.json');
        if (lockExists) {
          this.addCheck('Dependencies', 'pass', 'Dependencies installed and locked');
        } else {
          this.addCheck('Dependencies', 'warn', 'Dependencies installed but no package-lock.json');
        }
      } else {
        this.addCheck('Dependencies', 'fail', 'Dependencies not installed - run npm install');
      }
    } catch (error) {
      this.addCheck('Dependencies', 'fail', 'Could not read package.json');
    }
  }

  private async checkBuild(): Promise<void> {
    const distExists = existsSync('dist');
    const indexExists = existsSync('dist/index.js');

    if (distExists && indexExists) {
      try {
        // Try to validate the built code
        const { success } = await this.execCommand('node dist/index.js --version');
        if (success) {
          this.addCheck('Build Status', 'pass', 'Application built and executable');
        } else {
          this.addCheck('Build Status', 'warn', 'Build exists but may have issues');
        }
      } catch {
        this.addCheck('Build Status', 'warn', 'Build exists but validation failed');
      }
    } else {
      this.addCheck('Build Status', 'fail', 'Application not built - run npm run build');
    }
  }

  private async checkTypeScript(): Promise<void> {
    try {
      const { success } = await this.execCommand('npx tsc --noEmit');
      if (success) {
        this.addCheck('TypeScript', 'pass', 'TypeScript compilation passes');
      } else {
        this.addCheck('TypeScript', 'fail', 'TypeScript compilation errors');
      }
    } catch {
      this.addCheck('TypeScript', 'warn', 'Could not check TypeScript');
    }
  }

  private async checkLinting(): Promise<void> {
    try {
      const { success } = await this.execCommand('npm run lint');
      if (success) {
        this.addCheck('Code Quality', 'pass', 'Code linting passes');
      } else {
        this.addCheck('Code Quality', 'warn', 'Linting issues found');
      }
    } catch {
      this.addCheck('Code Quality', 'warn', 'Could not run linting');
    }
  }

  // Network and external service checks
  private async checkInternetConnectivity(): Promise<void> {
    try {
      const { success } = await this.execCommand('ping -c 1 8.8.8.8');
      if (success) {
        this.addCheck('Internet Connectivity', 'pass', 'Internet connection available');
      } else {
        this.addCheck('Internet Connectivity', 'fail', 'No internet connection');
      }
    } catch {
      this.addCheck('Internet Connectivity', 'warn', 'Could not test connectivity');
    }
  }

  private async checkYouTubeAPI(): Promise<void> {
    try {
      // This is a basic connectivity test to YouTube API
      const { success } = await this.execCommand('curl -s --max-time 5 https://www.googleapis.com/youtube/v3/ || exit 1');
      if (success) {
        this.addCheck('YouTube API', 'pass', 'YouTube API endpoint reachable');
      } else {
        this.addCheck('YouTube API', 'fail', 'Cannot reach YouTube API');
      }
    } catch {
      this.addCheck('YouTube API', 'warn', 'Could not test YouTube API connectivity');
    }
  }

  // Security checks
  private checkPermissions(): void {
    try {
      // Check if we can write to required directories
      const testDirs = ['tokens', 'backups', 'storage', 'logs'];
      let writeable = 0;

      for (const dir of testDirs) {
        try {
          if (existsSync(dir)) {
            // Try to create a test file
            const testFile = join(dir, '.write-test');
            require('fs').writeFileSync(testFile, 'test');
            require('fs').unlinkSync(testFile);
            writeable++;
          }
        } catch {
          // Directory not writable
        }
      }

      if (writeable === testDirs.filter(d => existsSync(d)).length) {
        this.addCheck('File Permissions', 'pass', 'Required directories are writable');
      } else {
        this.addCheck('File Permissions', 'warn', 'Some directories may not be writable');
      }
    } catch {
      this.addCheck('File Permissions', 'warn', 'Could not check permissions');
    }
  }

  private checkSecurity(): void {
    const issues: string[] = [];

    // Check for sensitive files in wrong locations
    if (existsSync('.env') && !existsSync('.gitignore')) {
      issues.push('.env exists but no .gitignore');
    }

    // Check if tokens directory is secure
    if (existsSync('tokens')) {
      try {
        const stats = require('fs').statSync('tokens');
        const mode = (stats.mode & parseInt('777', 8)).toString(8);
        if (mode !== '700' && mode !== '755') {
          issues.push(`tokens directory permissions: ${mode}`);
        }
      } catch {
        // Ignore permission check errors
      }
    }

    if (issues.length === 0) {
      this.addCheck('Security', 'pass', 'No obvious security issues detected');
    } else {
      this.addCheck('Security', 'warn', `Security considerations: ${issues.join(', ')}`);
    }
  }

  public async runHealthCheck(): Promise<HealthReport> {
    this.log('🏥 Running health check...', 'info');

    // Run all checks
    this.checkNodeVersion();
    this.checkMemory();
    this.checkDiskSpace();
    this.checkEnvironmentVariables();
    this.checkDirectories();
    this.checkDependencies();
    await this.checkBuild();
    await this.checkTypeScript();
    await this.checkLinting();
    await this.checkInternetConnectivity();
    await this.checkYouTubeAPI();
    this.checkPermissions();
    this.checkSecurity();

    // Determine overall health
    const failedChecks = this.checks.filter(check => check.status === 'fail').length;
    const warnChecks = this.checks.filter(check => check.status === 'warn').length;

    let overall: 'healthy' | 'degraded' | 'unhealthy';
    if (failedChecks === 0 && warnChecks === 0) {
      overall = 'healthy';
    } else if (failedChecks === 0) {
      overall = 'degraded';
    } else {
      overall = 'unhealthy';
    }

    const report: HealthReport = {
      overall,
      checks: this.checks,
      timestamp: new Date().toISOString(),
      version: this.getVersion()
    };

    return report;
  }

  private getVersion(): string {
    try {
      const packageJson = JSON.parse(readFileSync('package.json', 'utf-8'));
      return packageJson.version || '0.0.0';
    } catch {
      return 'unknown';
    }
  }

  public printReport(report: HealthReport): void {
    console.log('');
    this.log('🏥 Health Check Report', 'info');
    console.log('='.repeat(50));

    // Overall status
    console.log('');
    const statusColor = report.overall === 'healthy' ? 'success' :
                       report.overall === 'degraded' ? 'warn' : 'error';
    this.log(`Overall Status: ${report.overall.toUpperCase()}`, statusColor);
    console.log(`Timestamp: ${report.timestamp}`);
    console.log(`Version: ${report.version}`);

    // Summary
    const passCount = report.checks.filter(c => c.status === 'pass').length;
    const warnCount = report.checks.filter(c => c.status === 'warn').length;
    const failCount = report.checks.filter(c => c.status === 'fail').length;

    console.log('');
    this.log('📊 Summary:', 'info');
    console.log(`  ✅ Passed: ${passCount}`);
    console.log(`  ⚠️  Warnings: ${warnCount}`);
    console.log(`  ❌ Failed: ${failCount}`);

    // Detailed results
    console.log('');
    this.log('📋 Detailed Results:', 'info');

    for (const check of report.checks) {
      const icon = check.status === 'pass' ? '✅' :
                  check.status === 'warn' ? '⚠️' : '❌';
      const color = check.status === 'pass' ? 'success' :
                   check.status === 'warn' ? 'warn' : 'error';

      console.log(`  ${icon} ${check.name}: ${check.message}`);
    }

    // Recommendations
    const failedChecks = report.checks.filter(c => c.status === 'fail');
    if (failedChecks.length > 0) {
      console.log('');
      this.log('💡 Action Required:', 'error');
      failedChecks.forEach((check, index) => {
        console.log(`  ${index + 1}. ${check.name}: ${check.message}`);
      });
    }

    const warnChecks = report.checks.filter(c => c.status === 'warn');
    if (warnChecks.length > 0) {
      console.log('');
      this.log('💡 Recommendations:', 'warn');
      warnChecks.forEach((check, index) => {
        console.log(`  ${index + 1}. ${check.name}: ${check.message}`);
      });
    }

    console.log('');
    console.log('='.repeat(50));
  }
}

// CLI Handler
async function main() {
  const checker = new HealthChecker();

  try {
    const report = await checker.runHealthCheck();
    checker.printReport(report);

    // Save report to file
    const reportPath = 'health-report.json';
    require('fs').writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📄 Detailed report saved to: ${reportPath}`);

    // Exit with appropriate code
    process.exit(report.overall === 'unhealthy' ? 1 : 0);

  } catch (error) {
    console.error('Health check failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { HealthChecker };