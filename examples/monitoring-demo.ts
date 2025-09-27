/**
 * Monitoring System Demo
 *
 * This script demonstrates how to use the monitoring and logging system
 * in the YouTube MCP Extended project.
 */

import { logger } from '../src/lib/logger.js';
import { performanceMonitor } from '../src/lib/performance-monitor.js';
import { quotaMonitor } from '../src/lib/quota-monitor.js';
import { auditLogger } from '../src/lib/audit-logger.js';
import { monitoringDashboard } from '../src/lib/monitoring-dashboard.js';

async function demonstrateMonitoring() {
  console.log('🔍 YouTube MCP Extended - Monitoring System Demo\n');

  // 1. Structured Logging Demo
  console.log('1. Structured Logging Examples:');

  logger.info('Application started', 'system', {
    version: '1.0.0',
    environment: 'demo',
    correlationId: 'demo_001'
  });

  logger.debug('Debug message with metadata', 'api', {
    endpoint: '/videos/list',
    parameters: { maxResults: 25 }
  });

  logger.warn('Warning example', 'quota', {
    currentUsage: 7500,
    limit: 10000,
    percentage: 75
  });

  logger.error('Error example', 'api', new Error('API timeout'), {
    operation: 'videos.update',
    videoId: 'demo123',
    retryCount: 3
  });

  console.log('✅ Logs written to stderr and logs/app-YYYY-MM-DD.log\n');

  // 2. Performance Monitoring Demo
  console.log('2. Performance Monitoring Examples:');

  // Simulate API operation with wrapper
  const result = await performanceMonitor.wrapOperation(
    {
      operationType: 'videos.list',
      correlationId: 'demo_002',
      quotaCost: 1
    },
    async () => {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 150));
      return { success: true, data: 'mock video data' };
    }
  );

  console.log(`✅ Operation completed: ${JSON.stringify(result)}`);

  // Manual timing example
  const endTimer = performanceMonitor.startTimer('custom_operation', 'demo_003');
  await new Promise(resolve => setTimeout(resolve, 75));
  endTimer();

  console.log('✅ Performance metrics recorded\n');

  // 3. Quota Monitoring Demo
  console.log('3. Quota Monitoring Examples:');

  quotaMonitor.recordQuotaUsage({
    operation: 'videos.list',
    cost: 1,
    totalUsage: 1250,
    remainingQuota: 8750,
    success: true,
    correlationId: 'demo_004'
  });

  quotaMonitor.recordQuotaUsage({
    operation: 'videos.update',
    cost: 50,
    totalUsage: 1300,
    remainingQuota: 8700,
    success: true,
    correlationId: 'demo_005'
  });

  quotaMonitor.recordRateLimit({
    operation: 'videos.insert',
    retryAfter: 60,
    correlationId: 'demo_006'
  });

  const quotaStats = quotaMonitor.getQuotaStatistics();
  console.log(`✅ Quota Statistics: ${JSON.stringify(quotaStats, null, 2)}\n`);

  // 4. Audit Logging Demo
  console.log('4. Audit Logging Examples:');

  auditLogger.logMetadataChange({
    videoId: 'demo_video_123',
    userId: 'demo_user',
    action: 'generate_suggestion',
    oldValues: {
      title: 'Original Video Title',
      description: 'Original description',
      tags: ['original', 'tags']
    },
    newValues: {
      title: 'Enhanced Video Title with Keywords',
      description: 'Enhanced description with timestamps',
      tags: ['enhanced', 'seo', 'keywords']
    },
    suggestionId: 'suggestion_456',
    correlationId: 'demo_007'
  });

  auditLogger.logMetadataChange({
    videoId: 'demo_video_123',
    userId: 'demo_user',
    action: 'apply_metadata',
    newValues: {
      title: 'Final Applied Title',
      description: 'Final applied description'
    },
    suggestionId: 'suggestion_456',
    guardrailsAcknowledged: true,
    correlationId: 'demo_008'
  });

  console.log('✅ Audit events logged\n');

  // 5. Dashboard Demo
  console.log('5. Monitoring Dashboard Examples:');

  // Generate dashboard data
  const dashboardData = await monitoringDashboard.generateDashboardData({
    since: new Date(Date.now() - 60 * 60 * 1000) // Last hour
  });

  console.log('Dashboard Data Summary:');
  console.log(`- Performance Metrics: ${dashboardData.performance.metrics.length}`);
  console.log(`- Active Operations: ${dashboardData.performance.activeOperations.length}`);
  console.log(`- Quota Entries: ${dashboardData.quota.usage.length}`);
  console.log(`- Audit Events: ${dashboardData.audit.recentAudits.length}`);
  console.log(`- Alerts: ${dashboardData.alerts.length}`);

  // Export dashboard as JSON
  await monitoringDashboard.exportDashboardData('./demo-dashboard.json');
  console.log('✅ Dashboard data exported to demo-dashboard.json');

  // Generate HTML report
  const htmlReport = await monitoringDashboard.generateHTMLReport();
  console.log(`✅ HTML report generated (${htmlReport.length} characters)`);

  // Save dashboard snapshot
  const snapshotFile = await monitoringDashboard.saveDashboardSnapshot();
  console.log(`✅ Dashboard snapshot saved: ${snapshotFile}`);

  console.log('\n6. Monitoring Data Export:');

  // Export monitoring data
  await logger.exportMonitoringData('./demo-monitoring-export.json');
  console.log('✅ Monitoring data exported to demo-monitoring-export.json');

  // Export audit data
  await auditLogger.exportAuditData('./demo-audit-export.json', {
    since: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
    resource: 'video_metadata'
  });
  console.log('✅ Audit data exported to demo-audit-export.json');

  console.log('\n🎉 Monitoring system demo completed!');
  console.log('\nGenerated files:');
  console.log('- logs/app-YYYY-MM-DD.log (application logs)');
  console.log('- logs/audit/audit-YYYY-MM-DD.log (audit logs)');
  console.log('- logs/audit/metadata-YYYY-MM-DD.log (metadata audit)');
  console.log('- logs/dashboard/snapshot-*.json (dashboard snapshots)');
  console.log('- demo-dashboard.json (dashboard export)');
  console.log('- demo-monitoring-export.json (monitoring export)');
  console.log('- demo-audit-export.json (audit export)');

  console.log('\n📊 Check the logs directory for detailed logging output!');
}

// Run the demo
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateMonitoring().catch(console.error);
}

export { demonstrateMonitoring };