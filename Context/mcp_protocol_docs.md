# Model Context Protocol (MCP) Documentation (2025)

## Overview

The Model Context Protocol (MCP) is an open standard that enables seamless integration between LLM applications and external data sources and tools. It provides a standardized way to connect AI systems with context they need, replacing fragmented integrations with a single protocol.

**Last Updated:** September 2025  
**Current Specification Version:** 2025-03-26  
**Official Website:** https://modelcontextprotocol.io  
**GitHub Repository:** https://github.com/modelcontextprotocol/modelcontextprotocol

## Key Concepts

### What is MCP?

MCP is like "USB for AI integrations" - it provides a universal, standardized interface that:
- Connects LLMs with external data sources and tools
- Eliminates the need for custom integrations between every AI app and data source
- Enables secure, bidirectional communication
- Supports real-time context sharing

### Architecture Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│      Host       │    │     Client      │    │     Server      │
│                 │    │                 │    │                 │
│ (Claude Desktop,│◄──►│  (MCP Client)   │◄──►│  (Data Source/  │
│  IDE, Custom    │    │                 │    │     Tool)       │
│  AI App)        │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

- **Host:** The AI application users interact with (Claude Desktop, VS Code, etc.)
- **Client:** Lives within the Host, manages connections to MCP servers (1:1 relationship)
- **Server:** External programs exposing data sources or tools via MCP protocol

## Core Primitives

### 1. Resources (Application-Controlled)

Data sources that provide context to LLMs - similar to GET endpoints in REST APIs.

```typescript
interface Resource {
  uri: string;           // Unique identifier
  name: string;          // Human-readable name  
  description?: string;  // Optional description
  mimeType?: string;     // Content type
}

// Example: File system resource
{
  uri: "file:///home/user/project/README.md",
  name: "Project README",
  description: "Main project documentation",
  mimeType: "text/markdown"
}
```

### 2. Tools (Model-Controlled)

Functions that LLMs can call to perform actions - equivalent to function calling.

```typescript
interface Tool {
  name: string;              // Tool identifier
  description: string;       // What the tool does
  inputSchema: JSONSchema;   // Parameter specification
}

// Example: Weather API tool
{
  name: "get_weather",
  description: "Get current weather for a location",
  inputSchema: {
    type: "object",
    properties: {
      location: { type: "string", description: "City name" },
      units: { type: "string", enum: ["celsius", "fahrenheit"] }
    },
    required: ["location"]
  }
}
```

### 3. Prompts (User-Controlled)

Pre-defined templates or workflows that optimize interactions.

```typescript
interface Prompt {
  name: string;           // Prompt identifier
  description: string;    // What the prompt does
  arguments?: Argument[]; // Optional parameters
}

// Example: Code review prompt
{
  name: "code_review",
  description: "Review code for best practices and issues",
  arguments: [
    {
      name: "file_path",
      description: "Path to the file to review",
      required: true
    }
  ]
}
```

## Protocol Specification

### Communication Layer

MCP uses **JSON-RPC 2.0** over various transports:

#### Local Transport (STDIO)
For same-machine client-server communication:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "resources/list",
  "params": {}
}
```

#### Remote Transport (HTTP + SSE)
For remote server connections:
```http
POST /mcp HTTP/1.1
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "get_weather",
    "arguments": { "location": "San Francisco" }
  }
}
```

### Session Lifecycle

#### 1. Initialization
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2025-03-26",
    "capabilities": {
      "resources": { "subscribe": true },
      "tools": {},
      "prompts": {}
    },
    "clientInfo": {
      "name": "Claude Desktop",
      "version": "1.0.0"
    }
  }
}
```

#### 2. Capability Negotiation
Server responds with its capabilities:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2025-03-26",
    "capabilities": {
      "resources": { "subscribe": true, "listChanged": true },
      "tools": { "listChanged": true },
      "prompts": { "listChanged": true }
    },
    "serverInfo": {
      "name": "File System Server",
      "version": "1.0.0"
    }
  }
}
```

### Common Methods

#### Resource Operations
```json
// List available resources
{
  "method": "resources/list",
  "params": {}
}

// Read resource content  
{
  "method": "resources/read",
  "params": {
    "uri": "file:///path/to/file.txt"
  }
}

// Subscribe to resource changes
{
  "method": "resources/subscribe", 
  "params": {
    "uri": "file:///path/to/directory/"
  }
}
```

#### Tool Operations
```json
// List available tools
{
  "method": "tools/list",
  "params": {}
}

// Call a tool
{
  "method": "tools/call",
  "params": {
    "name": "get_weather",
    "arguments": {
      "location": "New York",
      "units": "celsius"
    }
  }
}
```

#### Prompt Operations
```json
// List available prompts
{
  "method": "prompts/list", 
  "params": {}
}

// Get prompt content
{
  "method": "prompts/get",
  "params": {
    "name": "code_review",
    "arguments": {
      "file_path": "/src/main.js"
    }
  }
}
```

## Building MCP Servers

### Python Implementation (FastMCP)

```python
from fastmcp import FastMCP
import json

# Create MCP server
mcp = FastMCP("Demo Server")

# Add a resource
@mcp.resource("config://app.json")
def get_app_config() -> str:
    """Get application configuration"""
    config = {
        "app_name": "My App",
        "version": "1.0.0",
        "environment": "production"
    }
    return json.dumps(config, indent=2)

# Add a tool
@mcp.tool()
def calculate(expression: str) -> str:
    """
    Safely calculate mathematical expressions
    
    Args:
        expression: Mathematical expression to evaluate
    """
    try:
        # Safe evaluation (implement proper validation)
        result = eval(expression)  # Don't do this in production!
        return f"Result: {result}"
    except Exception as e:
        return f"Error: {str(e)}"

# Add a prompt
@mcp.prompt()
def code_review(file_path: str, style_guide: str = "PEP8") -> str:
    """
    Generate code review prompt
    
    Args:
        file_path: Path to file to review
        style_guide: Style guide to follow
    """
    return f"""
Please review the code in {file_path} according to {style_guide} standards.
Check for:
- Code style and formatting
- Best practices
- Potential bugs
- Performance issues
- Security concerns

Provide specific, actionable feedback.
"""

if __name__ == "__main__":
    mcp.run()
```

### TypeScript Implementation

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new Server(
  {
    name: 'youtube-mcp-server',
    version: '1.0.0'
  },
  {
    capabilities: {
      resources: { subscribe: true, listChanged: true },
      tools: { listChanged: true },
      prompts: { listChanged: true }
    }
  }
);

// Resource handler
server.setRequestHandler('resources/list', async () => ({
  resources: [
    {
      uri: 'youtube://videos',
      name: 'YouTube Videos',
      description: 'List of uploaded YouTube videos',
      mimeType: 'application/json'
    }
  ]
}));

server.setRequestHandler('resources/read', async (request) => {
  const { uri } = request.params;
  
  if (uri === 'youtube://videos') {
    // Fetch videos from YouTube API
    const videos = await fetchYouTubeVideos();
    return {
      contents: [{
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(videos, null, 2)
      }]
    };
  }
  
  throw new Error(`Resource not found: ${uri}`);
});

// Tool handler
server.setRequestHandler('tools/list', async () => ({
  tools: [
    {
      name: 'upload_video',
      description: 'Upload a video to YouTube',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Video title' },
          description: { type: 'string', description: 'Video description' },
          file_path: { type: 'string', description: 'Path to video file' },
          privacy: { 
            type: 'string', 
            enum: ['private', 'unlisted', 'public'],
            description: 'Privacy setting'
          }
        },
        required: ['title', 'file_path']
      }
    }
  ]
}));

server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;
  
  if (name === 'upload_video') {
    const result = await uploadVideo(args);
    return {
      content: [{
        type: 'text',
        text: `Video uploaded successfully: ${result.videoId}`
      }]
    };
  }
  
  throw new Error(`Tool not found: ${name}`);
});

// Start server
const transport = new StdioServerTransport();
server.connect(transport);
```

## Client Integration

### Claude Desktop Configuration

```json
{
  "mcpServers": {
    "youtube": {
      "command": "node",
      "args": ["path/to/youtube-mcp-server/dist/index.js"],
      "env": {
        "YOUTUBE_CLIENT_ID": "your-client-id",
        "YOUTUBE_CLIENT_SECRET": "your-client-secret"
      }
    },
    "filesystem": {
      "command": "python",
      "args": ["-m", "mcp_servers.filesystem", "/home/user/projects"]
    }
  }
}
```

### Custom Client Implementation

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

class MCPClient {
  private client: Client;
  private transport: StdioClientTransport;
  
  constructor(command: string, args: string[]) {
    this.transport = new StdioClientTransport({ command, args });
    this.client = new Client({
      name: 'my-mcp-client',
      version: '1.0.0'
    }, {
      capabilities: {
        resources: {},
        tools: {},
        prompts: {}
      }
    });
  }
  
  async connect() {
    await this.client.connect(this.transport);
    
    // Initialize session
    await this.client.initialize();
  }
  
  async listResources() {
    const response = await this.client.request(
      { method: 'resources/list' },
      {}
    );
    return response.resources;
  }
  
  async readResource(uri: string) {
    const response = await this.client.request(
      { method: 'resources/read' },
      { uri }
    );
    return response.contents;
  }
  
  async callTool(name: string, arguments: any) {
    const response = await this.client.request(
      { method: 'tools/call' },
      { name, arguments }
    );
    return response.content;
  }
}

// Usage
const client = new MCPClient('python', ['-m', 'my_mcp_server']);
await client.connect();

const resources = await client.listResources();
console.log('Available resources:', resources);
```

## Security and Authentication

### OAuth 2.1 Integration (June 2025 Updates)

MCP servers are now classified as OAuth Resource Servers:

```typescript
// Server with OAuth authentication
server.setRequestHandler('initialize', async (request, extra) => {
  // Extract authorization from transport
  const authHeader = extra.meta?.authorization;
  
  if (!authHeader) {
    throw new Error('Authorization required');
  }
  
  // Validate OAuth token
  const token = authHeader.replace('Bearer ', '');
  const userInfo = await validateOAuthToken(token);
  
  // Store user context for session
  extra.userInfo = userInfo;
  
  return {
    protocolVersion: '2025-03-26',
    capabilities: server.capabilities,
    serverInfo: server.serverInfo
  };
});
```

### Resource Indicators (RFC 8707)

Mandatory for preventing token misuse:

```typescript
// Client requesting token with resource indicator
const tokenRequest = {
  grant_type: 'authorization_code',
  code: authCode,
  resource: 'https://api.youtube.com/v3/'  // Resource indicator
};

// Server validating resource-scoped token
async function validateToken(token: string, resourceUri: string) {
  const tokenInfo = await introspectToken(token);
  
  if (!tokenInfo.aud.includes(resourceUri)) {
    throw new Error('Token not valid for this resource');
  }
  
  return tokenInfo;
}
```

### Security Best Practices

```typescript
// 1. Input validation
server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;
  
  // Validate tool name
  if (!ALLOWED_TOOLS.includes(name)) {
    throw new Error(`Tool not allowed: ${name}`);
  }
  
  // Validate arguments
  const validation = ajv.validate(toolSchemas[name], args);
  if (!validation) {
    throw new Error('Invalid arguments');
  }
  
  return await executeTool(name, args);
});

// 2. Rate limiting
const rateLimiter = new RateLimiter({
  windowMs: 60000,  // 1 minute
  max: 100         // 100 requests per minute
});

// 3. Capability-based access control
server.setRequestHandler('resources/read', async (request, extra) => {
  const { uri } = request.params;
  const userCapabilities = extra.userInfo?.capabilities || [];
  
  if (!userCapabilities.includes('read:' + getResourceType(uri))) {
    throw new Error('Insufficient permissions');
  }
  
  return await readResource(uri);
});
```

## Advanced Features

### Resource Subscriptions

Real-time updates when resources change:

```typescript
// Server: Notify clients of resource changes
server.notification({
  method: 'notifications/resources/updated',
  params: {
    uri: 'file:///project/config.json'
  }
});

// Client: Handle resource change notifications
client.setNotificationHandler('notifications/resources/updated', (notification) => {
  const { uri } = notification.params;
  console.log(`Resource updated: ${uri}`);
  
  // Re-read the resource
  client.readResource(uri);
});
```

### Batch Operations

Efficient multiple operations:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "batch",
  "params": {
    "requests": [
      {
        "method": "tools/call",
        "params": { "name": "get_weather", "arguments": { "location": "NYC" } }
      },
      {
        "method": "tools/call", 
        "params": { "name": "get_weather", "arguments": { "location": "LA" } }
      }
    ]
  }
}
```

### Roots and Discovery

Entry points for hierarchical resources:

```typescript
server.setRequestHandler('roots/list', async () => ({
  roots: [
    {
      uri: 'file:///',
      name: 'File System Root'
    },
    {
      uri: 'youtube://channels/',
      name: 'YouTube Channels'
    }
  ]
}));
```

## Real-World Examples

### File System Server

```python
import os
import json
from fastmcp import FastMCP
from pathlib import Path

mcp = FastMCP("Filesystem Server")

@mcp.resource("file://{path}")
def read_file(path: str) -> str:
    """Read a file from the filesystem"""
    try:
        file_path = Path(path)
        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {path}")
        
        return file_path.read_text()
    except Exception as e:
        return f"Error reading file: {str(e)}"

@mcp.tool()
def list_directory(path: str = ".") -> str:
    """List contents of a directory"""
    try:
        directory = Path(path)
        if not directory.is_dir():
            return f"Error: {path} is not a directory"
        
        items = []
        for item in directory.iterdir():
            items.append({
                "name": item.name,
                "type": "directory" if item.is_dir() else "file",
                "size": item.stat().st_size if item.is_file() else None
            })
        
        return json.dumps(items, indent=2)
    except Exception as e:
        return f"Error listing directory: {str(e)}"

@mcp.tool()
def create_file(path: str, content: str) -> str:
    """Create a new file with specified content"""
    try:
        file_path = Path(path)
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_text(content)
        return f"File created successfully: {path}"
    except Exception as e:
        return f"Error creating file: {str(e)}"
```

### Database Server

```typescript
import { Database } from 'sqlite3';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

class DatabaseMCPServer {
  private db: Database;
  private server: Server;
  
  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.server = new Server(
      { name: 'database-server', version: '1.0.0' },
      { capabilities: { tools: {} } }
    );
    
    this.setupHandlers();
  }
  
  private setupHandlers() {
    this.server.setRequestHandler('tools/list', async () => ({
      tools: [
        {
          name: 'query',
          description: 'Execute SQL query',
          inputSchema: {
            type: 'object',
            properties: {
              sql: { type: 'string', description: 'SQL query to execute' },
              params: { 
                type: 'array', 
                description: 'Query parameters',
                items: { type: 'string' }
              }
            },
            required: ['sql']
          }
        },
        {
          name: 'get_schema',
          description: 'Get database schema',
          inputSchema: { type: 'object', properties: {} }
        }
      ]
    }));
    
    this.server.setRequestHandler('tools/call', async (request) => {
      const { name, arguments: args } = request.params;
      
      switch (name) {
        case 'query':
          return await this.executeQuery(args.sql, args.params);
        
        case 'get_schema':
          return await this.getSchema();
        
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }
  
  private async executeQuery(sql: string, params: any[] = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          resolve({
            content: [{
              type: 'text',
              text: `Error: ${err.message}`
            }]
          });
        } else {
          resolve({
            content: [{
              type: 'text',
              text: JSON.stringify(rows, null, 2)
            }]
          });
        }
      });
    });
  }
  
  private async getSchema() {
    return new Promise((resolve, reject) => {
      const sql = "SELECT name, sql FROM sqlite_master WHERE type='table'";
      this.db.all(sql, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve({
            content: [{
              type: 'text',
              text: JSON.stringify(rows, null, 2)
            }]
          });
        }
      });
    });
  }
}
```

## Testing and Development

### Local Development Setup

```bash
# Install MCP SDK
npm install @modelcontextprotocol/sdk

# Create basic server structure
mkdir my-mcp-server
cd my-mcp-server
npm init -y
npm install @modelcontextprotocol/sdk typescript ts-node

# TypeScript configuration
echo '{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext", 
    "moduleResolution": "node",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "outDir": "./dist"
  }
}' > tsconfig.json
```

### Testing MCP Servers

```typescript
// Test client for MCP server
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function testMCPServer() {
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['./dist/server.js']
  });
  
  const client = new Client(
    { name: 'test-client', version: '1.0.0' },
    { capabilities: { resources: {}, tools: {}, prompts: {} } }
  );
  
  try {
    await client.connect(transport);
    console.log('Connected to MCP server');
    
    // Test listing tools
    const tools = await client.request({ method: 'tools/list' }, {});
    console.log('Available tools:', tools);
    
    // Test calling a tool
    if (tools.tools?.length > 0) {
      const result = await client.request(
        { method: 'tools/call' },
        { 
          name: tools.tools[0].name,
          arguments: {}
        }
      );
      console.log('Tool result:', result);
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await client.close();
  }
}

testMCPServer();
```

## Industry Adoption and Ecosystem

### Major Platform Support (2025)

- **Anthropic:** Native support in Claude Desktop
- **Microsoft:** Windows OS integration (May 2025)
- **OpenAI:** ChatGPT integration
- **Google:** DeepMind platform support
- **JetBrains:** IntelliJ IDEA integration
- **Replit:** Development environment support
- **Zed:** Editor integration

### Pre-built MCP Servers

Available community servers:

```bash
# Popular MCP servers
npm install @mcp-servers/google-drive    # Google Drive integration
npm install @mcp-servers/github          # GitHub integration  
npm install @mcp-servers/slack           # Slack integration
npm install @mcp-servers/postgres        # PostgreSQL integration
npm install @mcp-servers/puppeteer       # Web automation
npm install @mcp-servers/filesystem      # File system access
```

### Market Growth

- **2024:** Initial release and early adoption
- **2025:** Projected 90% enterprise adoption
- **Market Size:** Growing from $1.2B (2022) to $4.5B (2025)

## Future Roadmap

### Planned Enhancements

1. **Enhanced Security:** OAuth 2.1 full implementation
2. **Better Transport:** Streamable HTTP replacing HTTP+SSE
3. **Richer Metadata:** Tool annotations and capabilities
4. **Performance:** JSON-RPC batching optimization
5. **Ecosystem Growth:** More language SDKs and integrations

### Emerging Patterns

- **Agentic AI:** Multi-system autonomous interactions
- **Context Chaining:** Complex workflow orchestration
- **Real-time Updates:** Live data synchronization
- **Enterprise Integration:** Large-scale deployment patterns

## Resources

### Official Documentation

- **Specification:** https://spec.modelcontextprotocol.io/
- **GitHub:** https://github.com/modelcontextprotocol/
- **Community:** https://github.com/modelcontextprotocol/discussions

### SDKs and Tools

- **Python:** `pip install mcp`
- **TypeScript:** `npm install @modelcontextprotocol/sdk`
- **Java:** Available via Maven Central
- **C#:** NuGet package available
- **Go:** Official Google-maintained SDK
- **Kotlin:** JetBrains-maintained SDK

### Learning Resources

- **Tutorial Series:** Step-by-step implementation guides
- **Example Servers:** Reference implementations
- **Best Practices:** Security and performance guides
- **Community Examples:** Real-world use cases

---

*This documentation covers the Model Context Protocol as of September 2025. The protocol is actively maintained and updated. Always refer to the official specification for the most current information.*