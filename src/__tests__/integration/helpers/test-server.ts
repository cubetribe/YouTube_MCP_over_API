import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { vi } from 'vitest';
import { Readable, Writable } from 'stream';
import { EventEmitter } from 'events';

/**
 * Mock MCP transport that captures communication between client and server
 * for testing purposes
 */
export class MockMCPTransport extends EventEmitter {
  private _readable: Readable;
  private _writable: Writable;
  private _messages: any[] = [];
  private _responses: Map<string, any> = new Map();

  constructor() {
    super();
    this._readable = new Readable({
      read() {
        // Do nothing - we'll push data manually
      }
    });
    this._writable = new Writable({
      write(chunk, encoding, callback) {
        try {
          const message = JSON.parse(chunk.toString());
          this._messages.push(message);
          this.emit('message', message);
          callback();
        } catch (error) {
          callback(error);
        }
      }.bind(this)
    });
  }

  get readable() {
    return this._readable;
  }

  get writable() {
    return this._writable;
  }

  get messages() {
    return [...this._messages];
  }

  // Send a message from client to server
  sendFromClient(message: any): void {
    this._readable.push(JSON.stringify(message) + '\n');
  }

  // Get responses sent from server to client
  getServerResponses(): any[] {
    return [...this._messages];
  }

  // Mock response from server
  mockServerResponse(id: string, response: any): void {
    this._responses.set(id, response);
  }

  // Clear captured messages
  clear(): void {
    this._messages = [];
    this._responses.clear();
  }

  // Simulate connection close
  close(): void {
    this._readable.push(null);
    this._writable.end();
    this.emit('close');
  }
}

/**
 * Test server factory that creates an isolated MCP server instance
 * with mocked dependencies for integration testing
 */
export class TestMCPServer {
  private server: Server;
  private transport: MockMCPTransport;
  private isConnected: boolean = false;

  constructor(config?: {
    name?: string;
    version?: string;
    capabilities?: any;
  }) {
    this.server = new Server(
      {
        name: config?.name || 'test-mcp-server',
        version: config?.version || '0.0.1-test'
      },
      {
        capabilities: config?.capabilities || {
          resources: {},
          tools: {},
          prompts: {},
        }
      }
    );
    this.transport = new MockMCPTransport();
  }

  async start(): Promise<void> {
    if (this.isConnected) {
      throw new Error('Server is already started');
    }

    // Create mock stdio transport
    const stdioTransport = {
      start: vi.fn(),
      close: vi.fn(),
      send: vi.fn((message) => {
        this.transport.sendFromClient(message);
      }),
      onMessage: vi.fn(),
      onClose: vi.fn(),
      onError: vi.fn(),
    };

    // Connect server with mock transport
    await this.server.connect(stdioTransport as any);
    this.isConnected = true;
  }

  async stop(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    this.transport.close();
    this.isConnected = false;
  }

  // Get the server instance for setting up handlers
  getServer(): Server {
    return this.server;
  }

  // Get the transport for sending messages and inspecting responses
  getTransport(): MockMCPTransport {
    return this.transport;
  }

  // Send a request to the server and get response
  async sendRequest(request: any): Promise<any> {
    if (!this.isConnected) {
      throw new Error('Server is not started');
    }

    const requestId = Math.random().toString(36).substring(7);
    const message = {
      jsonrpc: '2.0',
      id: requestId,
      method: request.method,
      params: request.params || {}
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, 5000);

      this.transport.once('message', (response) => {
        clearTimeout(timeout);
        if (response.id === requestId) {
          if (response.error) {
            reject(new Error(response.error.message || 'Server error'));
          } else {
            resolve(response.result);
          }
        }
      });

      this.transport.sendFromClient(message);
    });
  }

  // Helper methods for common MCP operations
  async listTools(): Promise<any> {
    return this.sendRequest({ method: 'tools/list' });
  }

  async listResources(): Promise<any> {
    return this.sendRequest({ method: 'resources/list' });
  }

  async callTool(name: string, args: any = {}): Promise<any> {
    return this.sendRequest({
      method: 'tools/call',
      params: { name, arguments: args }
    });
  }

  async readResource(uri: string): Promise<any> {
    return this.sendRequest({
      method: 'resources/read',
      params: { uri }
    });
  }

  async subscribe(uri: string): Promise<any> {
    return this.sendRequest({
      method: 'resources/subscribe',
      params: { uri }
    });
  }

  async unsubscribe(uri: string): Promise<any> {
    return this.sendRequest({
      method: 'resources/unsubscribe',
      params: { uri }
    });
  }

  // Get all messages sent by the server
  getServerMessages(): any[] {
    return this.transport.getServerResponses();
  }

  // Clear message history
  clearMessages(): void {
    this.transport.clear();
  }
}

/**
 * Create a test server instance with YouTube MCP configuration
 */
export async function createTestYouTubeMCPServer(): Promise<TestMCPServer> {
  const server = new TestMCPServer({
    name: 'youtube-mcp-extended-test',
    version: '0.0.2-test',
    capabilities: {
      resources: {
        subscribe: true,
        listChanged: true,
      },
      tools: {},
      prompts: {},
    }
  });

  await server.start();
  return server;
}

/**
 * Utility to wait for async operations to complete
 */
export function waitFor(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Mock function to create realistic delays in tests
 */
export async function simulateNetworkDelay(): Promise<void> {
  const delay = Math.random() * 100 + 50; // 50-150ms
  return waitFor(delay);
}