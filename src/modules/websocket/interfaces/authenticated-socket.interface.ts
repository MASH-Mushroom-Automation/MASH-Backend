import { Socket } from 'socket.io';

/**
 * User information extracted from JWT/Firebase token
 */
export interface SocketUser {
  id: string;
  email: string;
  roles: string[];
  name?: string;
  firebaseUid?: string;
}

/**
 * Extended Socket interface with authenticated user information
 */
export interface AuthenticatedSocket extends Socket {
  user: SocketUser;
  lastActivity?: number;
  subscriptions?: Set<string>;
}

/**
 * Connection information for monitoring and management
 */
export interface ConnectionInfo {
  socketId: string;
  userId: string;
  connectedAt: Date;
  lastActivity: Date;
  rooms: string[];
  userAgent?: string;
  ipAddress?: string;
}

/**
 * Connection statistics for monitoring
 */
export interface ConnectionStats {
  activeConnections: number;
  totalRooms: number;
  messagesPerSecond: number;
  averageLatency: number;
  errorRate: number;
  memoryUsage: number;
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  connections: number;
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  redis: {
    connected: boolean;
    latency?: number;
  };
}

/**
 * WebSocket event payload base interface
 */
export interface WebSocketEvent<T = any> {
  event: string;
  data: T;
  timestamp: Date;
  userId?: string;
}

/**
 * Room subscription payload
 */
export interface RoomSubscription {
  room: string;
  userId: string;
  joinedAt: Date;
}

/**
 * Message metrics for monitoring
 */
export interface MessageMetrics {
  event: string;
  timestamp: Date;
  latency: number;
  size: number;
  success: boolean;
  error?: string;
}

/**
 * Connection event for logging
 */
export interface ConnectionEvent {
  type: 'connect' | 'disconnect' | 'error' | 'reconnect';
  socketId: string;
  userId?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}
