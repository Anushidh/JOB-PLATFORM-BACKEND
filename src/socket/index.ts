import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import env from '../config/env';
import { TokenPayload, UserRole } from '../types';
import redis from '../config/redis';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: UserRole;
}

let io: Server;

/** Initializes Socket.IO server with JWT auth and registers event handlers */
export function initializeSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: env.CORS_ORIGIN,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // JWT authentication middleware for socket connections
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];

      if (!token) {
        return next(new Error('Authentication required'));
      }

      // Check blacklist
      const isBlacklisted = await redis.get(`blacklist:${token}`);
      if (isBlacklisted) {
        return next(new Error('Token revoked'));
      }

      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as TokenPayload;
      socket.userId = decoded.userId;
      socket.userRole = decoded.role;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    const userId = socket.userId!;
    const userRole = socket.userRole!;

    console.log(`[Socket] User connected: ${userId} (${userRole})`);

    // Join personal room (for direct messaging)
    socket.join(`user:${userId}`);

    // Mark user as online in Redis
    setUserOnline(userId);

    // Broadcast online status to others
    socket.broadcast.emit('user:online', { userId });

    // Handle joining a conversation room
    socket.on('conversation:join', (conversationId: string) => {
      socket.join(`conversation:${conversationId}`);
    });

    // Handle leaving a conversation room
    socket.on('conversation:leave', (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
    });

    // Handle typing indicator
    socket.on('typing:start', (data: { conversationId: string }) => {
      socket.to(`conversation:${data.conversationId}`).emit('typing:start', {
        userId,
        conversationId: data.conversationId,
      });
    });

    socket.on('typing:stop', (data: { conversationId: string }) => {
      socket.to(`conversation:${data.conversationId}`).emit('typing:stop', {
        userId,
        conversationId: data.conversationId,
      });
    });

    // Handle read receipt
    socket.on('message:read', (data: { conversationId: string; messageId: string }) => {
      socket.to(`conversation:${data.conversationId}`).emit('message:read', {
        userId,
        conversationId: data.conversationId,
        messageId: data.messageId,
      });
    });

    // Handle check if user is online
    socket.on('user:check-online', async (targetUserId: string, callback: (online: boolean) => void) => {
      const online = await isUserOnline(targetUserId);
      callback(online);
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`[Socket] User disconnected: ${userId}`);
      setUserOffline(userId);
      socket.broadcast.emit('user:offline', { userId });
    });
  });

  return io;
}

/** Gets the Socket.IO server instance */
export function getIO(): Server {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
}

/** Emits a new message event to the recipient's personal room */
export function emitNewMessage(recipientId: string, message: any): void {
  if (io) {
    io.to(`user:${recipientId}`).emit('message:new', message);
  }
}

/** Emits a message to a conversation room (for users currently viewing that conversation) */
export function emitToConversation(conversationId: string, event: string, data: any): void {
  if (io) {
    io.to(`conversation:${conversationId}`).emit(event, data);
  }
}

/** Emits a notification to a specific user */
export function emitNotification(userId: string, notification: any): void {
  if (io) {
    io.to(`user:${userId}`).emit('notification:new', notification);
  }
}

// --- Online presence tracking via Redis ---

const ONLINE_KEY_PREFIX = 'online:';
const ONLINE_TTL = 300; // 5 minutes TTL (refreshed on activity)

/** Marks a user as online in Redis */
async function setUserOnline(userId: string): Promise<void> {
  await redis.set(`${ONLINE_KEY_PREFIX}${userId}`, '1', 'EX', ONLINE_TTL);
}

/** Marks a user as offline by removing their Redis key */
async function setUserOffline(userId: string): Promise<void> {
  await redis.del(`${ONLINE_KEY_PREFIX}${userId}`);
}

/** Checks if a user is currently online */
async function isUserOnline(userId: string): Promise<boolean> {
  const result = await redis.get(`${ONLINE_KEY_PREFIX}${userId}`);
  return result !== null;
}
