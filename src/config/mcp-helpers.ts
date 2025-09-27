import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { MCPServerConfig, AppConfig } from './schemas.js';

/**
 * MCP server configuration utilities and helpers
 */

/**
 * Create MCP server instance with configuration
 */
export function createMCPServer(config: MCPServerConfig): Server {
  return new Server(
    {
      name: config.name,
      version: config.version,
    },
    {
      capabilities: config.capabilities,
    }
  );
}

/**
 * Get MCP server capabilities based on configuration
 */
export function getMCPCapabilities(config: AppConfig) {
  return {
    tools: {
      listChanged: config.mcpServer.capabilities.tools.listChanged,
    },
    resources: {
      listChanged: config.mcpServer.capabilities.resources.listChanged,
      subscribe: config.mcpServer.capabilities.resources.subscribe,
    },
    prompts: {
      listChanged: config.mcpServer.capabilities.prompts.listChanged,
    },
  };
}

/**
 * Tool definition interface for type safety
 */
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: any;
}

/**
 * Resource definition interface for type safety
 */
export interface ResourceDefinition {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

/**
 * Default tool definitions for the YouTube MCP server
 */
export const DEFAULT_TOOLS: ToolDefinition[] = [
  {
    name: 'start_oauth_flow',
    description: 'Generiert einen OAuth-Link zur Anmeldung bei Google und liefert PKCE-Verifier.',
    inputSchema: {}, // Will be replaced with actual schema
  },
  {
    name: 'complete_oauth_flow',
    description: 'Schliesst den OAuth-Prozess mit Code & State ab und speichert Tokens.',
    inputSchema: {},
  },
  {
    name: 'list_videos',
    description: 'Listet Videos des authentifizierten Kanals mit Metadaten.',
    inputSchema: {},
  },
  {
    name: 'get_video_transcript',
    description: 'Lädt das YouTube-Transkript (falls verfügbar).',
    inputSchema: {},
  },
  {
    name: 'generate_metadata_suggestions',
    description: 'Erzeugt Metadaten-Vorschläge basierend auf Beschreibung/Transkript.',
    inputSchema: {},
  },
  {
    name: 'apply_metadata',
    description: 'Wendet Metadaten auf ein Video an und erstellt optional ein Backup.',
    inputSchema: {},
  },
  {
    name: 'schedule_videos',
    description: 'Erstellt einen Veröffentlichungsplan und kann ihn optional anwenden.',
    inputSchema: {},
  },
  {
    name: 'create_playlist',
    description: 'Legt eine neue Playlist an.',
    inputSchema: {},
  },
  {
    name: 'add_videos_to_playlist',
    description: 'Fügt Videos zu einer bestehenden Playlist hinzu.',
    inputSchema: {},
  },
  {
    name: 'organize_playlists',
    description: 'Organisiert Videos automatisch in Playlists (manuell oder nach Kategorie).',
    inputSchema: {},
  },
  {
    name: 'backup_video_metadata',
    description: 'Erstellt JSON-Backups der Videometadaten.',
    inputSchema: {},
  },
  {
    name: 'restore_video_metadata',
    description: 'Stellt Metadaten aus einem Backup wieder her.',
    inputSchema: {},
  },
  {
    name: 'get_batch_status',
    description: 'Liest den Fortschritt eines Batch-Prozesses aus.',
    inputSchema: {},
  },
  {
    name: 'generate_thumbnail_concepts',
    description: 'Generiert Thumbnail-Konzeptvorschläge basierend auf Video-Inhalten und Transkript.',
    inputSchema: {},
  },
];

/**
 * Default resource definitions for the YouTube MCP server
 */
export const DEFAULT_RESOURCES: ResourceDefinition[] = [
  {
    uri: 'youtube://videos',
    name: 'YouTube Videos',
    description: 'Aktuelle Videoliste',
    mimeType: 'application/json',
  },
  {
    uri: 'youtube://channels/mine',
    name: 'Eigener Kanal',
    description: 'Kanalinformationen',
    mimeType: 'application/json',
  },
  {
    uri: 'youtube://playlists',
    name: 'Playlists',
    description: 'Playlists des Kanals',
    mimeType: 'application/json',
  },
  {
    uri: 'backups://list',
    name: 'Backups',
    description: 'Verfügbare Metadaten-Backups',
    mimeType: 'application/json',
  },
  {
    uri: 'batch://status/{batchId}',
    name: 'Batch Status',
    description: 'Status eines Batch-Vorgangs',
    mimeType: 'application/json',
  },
];

/**
 * Filter tools based on configuration
 */
export function filterToolsByEnvironment(
  tools: ToolDefinition[],
  config: AppConfig
): ToolDefinition[] {
  // In production, we might want to disable certain debugging tools
  if (config.env === 'production') {
    const productionBlacklist = ['debug_', 'test_'];
    return tools.filter(tool =>
      !productionBlacklist.some(prefix => tool.name.startsWith(prefix))
    );
  }

  return tools;
}

/**
 * Filter resources based on configuration
 */
export function filterResourcesByEnvironment(
  resources: ResourceDefinition[],
  config: AppConfig
): ResourceDefinition[] {
  // In production, we might want to disable certain debugging resources
  if (config.env === 'production') {
    const productionBlacklist = ['debug://', 'test://'];
    return resources.filter(resource =>
      !productionBlacklist.some(prefix => resource.uri.startsWith(prefix))
    );
  }

  return resources;
}

/**
 * Validate MCP server configuration
 */
export function validateMCPConfig(config: MCPServerConfig): void {
  if (!config.name || config.name.trim().length === 0) {
    throw new Error('MCP server name cannot be empty');
  }

  if (!config.version || config.version.trim().length === 0) {
    throw new Error('MCP server version cannot be empty');
  }

  // Validate semantic version format
  const semverRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9-]+)?$/;
  if (!semverRegex.test(config.version)) {
    throw new Error(`Invalid version format: ${config.version}. Expected semantic version (e.g., 1.0.0)`);
  }
}

/**
 * Create server info object for MCP initialization
 */
export function createServerInfo(config: MCPServerConfig) {
  validateMCPConfig(config);

  return {
    name: config.name,
    version: config.version,
  };
}

/**
 * Create capabilities object for MCP initialization
 */
export function createCapabilities(config: MCPServerConfig) {
  return {
    capabilities: config.capabilities,
  };
}

/**
 * Session management utilities
 */
export class SessionManager {
  private sessions = new Map<string, Set<string>>();

  /**
   * Add a subscription for a session
   */
  addSubscription(sessionId: string, uri: string): void {
    const subscriptions = this.sessions.get(sessionId) || new Set();
    subscriptions.add(uri);
    this.sessions.set(sessionId, subscriptions);
  }

  /**
   * Remove a subscription for a session
   */
  removeSubscription(sessionId: string, uri: string): void {
    const subscriptions = this.sessions.get(sessionId);
    if (subscriptions) {
      subscriptions.delete(uri);
      if (subscriptions.size === 0) {
        this.sessions.delete(sessionId);
      }
    }
  }

  /**
   * Get all subscriptions for a session
   */
  getSubscriptions(sessionId: string): Set<string> {
    return this.sessions.get(sessionId) || new Set();
  }

  /**
   * Check if a URI has any subscribers
   */
  hasSubscribers(uri: string): boolean {
    for (const subscriptions of this.sessions.values()) {
      if (subscriptions.has(uri)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Clean up expired sessions
   */
  cleanup(): void {
    // Remove empty sessions
    for (const [sessionId, subscriptions] of this.sessions.entries()) {
      if (subscriptions.size === 0) {
        this.sessions.delete(sessionId);
      }
    }
  }

  /**
   * Get session statistics
   */
  getStats() {
    return {
      totalSessions: this.sessions.size,
      totalSubscriptions: Array.from(this.sessions.values())
        .reduce((total, subscriptions) => total + subscriptions.size, 0),
    };
  }
}