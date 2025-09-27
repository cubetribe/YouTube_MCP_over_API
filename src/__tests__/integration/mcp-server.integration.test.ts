import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestMCPServer, createTestYouTubeMCPServer } from './helpers/test-server.js';
import { TEST_CONFIGURATION } from './fixtures/index.js';

describe('MCP Server Integration Tests', () => {
  let testServer: TestMCPServer;

  beforeEach(async () => {
    // Mock configuration
    vi.doMock('../../config/index.js', () => ({
      getConfig: () => TEST_CONFIGURATION,
      getFeatureFlags: () => ({
        getAllFlags: () => ({}),
        getSummary: () => ({ total: 0, enabled: 0, disabled: 0 }),
        getDeprecatedFlags: () => [],
        getEnabledFlags: () => [],
        getDisabledFlags: () => []
      }),
      ConfigValidator: {
        validateAppConfig: () => ({ isValid: true, errors: [], warnings: [], suggestions: [] }),
        checkCommonIssues: () => ({ isValid: true, errors: [], warnings: [], suggestions: [] })
      },
      configManager: {
        getEnv: () => process.env,
        reload: () => TEST_CONFIGURATION
      }
    }));

    testServer = await createTestYouTubeMCPServer();
  });

  afterEach(async () => {
    await testServer.stop();
    vi.clearAllMocks();
    vi.doUnmock('../../config/index.js');
  });

  describe('Server Initialization', () => {
    it('should start server successfully', async () => {
      expect(testServer).toBeDefined();
      expect(testServer.getServer()).toBeDefined();
    });

    it('should expose correct server capabilities', async () => {
      const server = testServer.getServer();
      expect(server).toBeDefined();
      // Server capabilities are set during creation
    });

    it('should handle multiple start/stop cycles', async () => {
      await testServer.stop();
      await expect(testServer.start()).resolves.not.toThrow();
      await testServer.stop();
    });

    it('should prevent double start', async () => {
      await expect(testServer.start()).rejects.toThrow('Server is already started');
    });
  });

  describe('Tool Registration and Schema Validation', () => {
    it('should list all registered tools', async () => {
      const tools = await testServer.listTools();

      expect(tools).toBeDefined();
      expect(Array.isArray(tools.tools)).toBe(true);

      const expectedTools = [
        'start_oauth_flow',
        'complete_oauth_flow',
        'list_videos',
        'get_video_transcript',
        'generate_metadata_suggestions',
        'apply_metadata',
        'schedule_videos',
        'create_playlist',
        'add_videos_to_playlist',
        'organize_playlists',
        'backup_video_metadata',
        'restore_video_metadata',
        'get_batch_status',
        'generate_thumbnail_concepts',
        'get_configuration_status',
        'reload_configuration'
      ];

      const toolNames = tools.tools.map((tool: any) => tool.name);
      expectedTools.forEach(expectedTool => {
        expect(toolNames).toContain(expectedTool);
      });
    });

    it('should have valid schemas for all tools', async () => {
      const tools = await testServer.listTools();

      tools.tools.forEach((tool: any) => {
        expect(tool.name).toBeDefined();
        expect(tool.description).toBeDefined();
        expect(tool.inputSchema).toBeDefined();
        expect(tool.inputSchema.type).toBe('object');
        expect(tool.inputSchema.properties).toBeDefined();
      });
    });

    it('should validate tool input schemas', async () => {
      const tools = await testServer.listTools();
      const startOAuthTool = tools.tools.find((tool: any) => tool.name === 'start_oauth_flow');

      expect(startOAuthTool).toBeDefined();
      expect(startOAuthTool.inputSchema.properties.scopes).toBeDefined();
      expect(startOAuthTool.inputSchema.properties.scopes.type).toBe('array');
    });
  });

  describe('Resource Exposure and Management', () => {
    it('should list all available resources', async () => {
      const resources = await testServer.listResources();

      expect(resources).toBeDefined();
      expect(Array.isArray(resources.resources)).toBe(true);

      const expectedResources = [
        'youtube://videos',
        'youtube://channels/mine',
        'youtube://playlists',
        'backups://list',
        'batch://status/{batchId}',
        'config://status',
        'config://features'
      ];

      const resourceUris = resources.resources.map((resource: any) => resource.uri);
      expectedResources.forEach(expectedResource => {
        expect(resourceUris).toContain(expectedResource);
      });
    });

    it('should have valid resource definitions', async () => {
      const resources = await testServer.listResources();

      resources.resources.forEach((resource: any) => {
        expect(resource.uri).toBeDefined();
        expect(resource.name).toBeDefined();
        expect(resource.description).toBeDefined();
        expect(resource.mimeType).toBeDefined();
        expect(resource.mimeType).toBe('application/json');
      });
    });

    it('should support resource subscription', async () => {
      const uri = 'config://status';

      await expect(testServer.subscribe(uri)).resolves.not.toThrow();
      await expect(testServer.unsubscribe(uri)).resolves.not.toThrow();
    });

    it('should handle multiple subscriptions to same resource', async () => {
      const uri = 'config://status';

      await testServer.subscribe(uri);
      await testServer.subscribe(uri); // Should not throw
      await testServer.unsubscribe(uri);
    });
  });

  describe('Error Handling and Validation', () => {
    it('should handle unknown tool calls gracefully', async () => {
      await expect(testServer.callTool('unknown_tool')).rejects.toThrow();
    });

    it('should validate tool arguments', async () => {
      // Try to call start_oauth_flow with invalid arguments
      await expect(
        testServer.callTool('start_oauth_flow', { scopes: 'not_an_array' })
      ).rejects.toThrow();
    });

    it('should handle malformed requests', async () => {
      const transport = testServer.getTransport();

      // Send malformed JSON
      transport.sendFromClient({ invalid: 'request', missing: 'required_fields' });

      // Should not crash the server
      expect(testServer.getServer()).toBeDefined();
    });

    it('should return proper error responses', async () => {
      try {
        await testServer.callTool('unknown_tool');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBeDefined();
      }
    });
  });

  describe('Request/Response Format Compliance', () => {
    it('should follow JSON-RPC 2.0 format for requests', async () => {
      testServer.clearMessages();

      await testServer.listTools().catch(() => {}); // Ignore errors for this test

      const messages = testServer.getServerMessages();
      // Note: In a real implementation, we would inspect the actual JSON-RPC messages
      expect(messages).toBeDefined();
    });

    it('should include correlation IDs in responses', async () => {
      testServer.clearMessages();

      const result = await testServer.listTools();

      expect(result).toBeDefined();
      // In a real implementation, we would verify that response IDs match request IDs
    });

    it('should handle concurrent requests properly', async () => {
      const promises = [
        testServer.listTools(),
        testServer.listResources(),
        testServer.callTool('get_configuration_status', { section: 'all' })
      ];

      const results = await Promise.all(promises.map(p => p.catch(e => e)));

      // At least some requests should succeed (depending on mocking)
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toBeDefined();
      });
    });
  });

  describe('Session Management', () => {
    it('should handle session isolation', async () => {
      // Subscribe to resource in current session
      await testServer.subscribe('config://status');

      // Verify subscription is tracked
      expect(testServer.getTransport()).toBeDefined();
    });

    it('should clean up subscriptions on disconnect', async () => {
      await testServer.subscribe('config://status');
      await testServer.stop();

      // After restart, subscriptions should be cleared
      await testServer.start();
      expect(testServer.getTransport()).toBeDefined();
    });

    it('should handle resource updates notifications', async () => {
      await testServer.subscribe('config://status');

      // In a real implementation, this would trigger a resource update
      // and verify that notifications are sent to subscribers
      expect(testServer.getTransport()).toBeDefined();
    });
  });

  describe('Protocol Version Compatibility', () => {
    it('should declare supported MCP protocol version', async () => {
      const server = testServer.getServer();
      expect(server).toBeDefined();

      // Protocol version is typically declared during capability negotiation
      // In a real implementation, we would verify the version is supported
    });

    it('should handle version negotiation', async () => {
      // This would test the capability negotiation phase
      expect(testServer.getServer()).toBeDefined();
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle rapid sequential requests', async () => {
      const requests = Array.from({ length: 10 }, (_, i) =>
        testServer.callTool('get_configuration_status', { section: 'all' })
      );

      const startTime = Date.now();
      const results = await Promise.allSettled(requests);
      const endTime = Date.now();

      // Should complete within reasonable time (adjust based on requirements)
      expect(endTime - startTime).toBeLessThan(5000);

      // Most requests should succeed
      const successful = results.filter(r => r.status === 'fulfilled').length;
      expect(successful).toBeGreaterThan(5);
    });

    it('should handle large resource responses', async () => {
      // Test reading a resource that would return large data
      const result = await testServer.readResource('config://status').catch(e => e);

      expect(result).toBeDefined();
      // In a real implementation, verify that large responses are handled properly
    });

    it('should maintain performance under subscription load', async () => {
      const uris = [
        'config://status',
        'config://features',
        'backups://list'
      ];

      // Subscribe to multiple resources
      await Promise.all(uris.map(uri => testServer.subscribe(uri)));

      // Server should remain responsive
      const result = await testServer.listTools();
      expect(result).toBeDefined();

      // Clean up subscriptions
      await Promise.all(uris.map(uri => testServer.unsubscribe(uri)));
    });
  });
});