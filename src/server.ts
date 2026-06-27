import http from 'http';
import app from './app';
import env from './config/env';
import connectDatabase from './config/database';
import redis from './config/redis';
import { startCronJobs, stopCronJobs } from './jobs/alertCron';
import { initializeSocket } from './socket';

const startServer = async (): Promise<void> => {
  try {
    // Connect to database
    await connectDatabase();

    // Verify Redis connection
    await redis.ping();
    console.log('Redis connected successfully');

    // Start cron jobs
    startCronJobs();

    // Create HTTP server and attach Socket.IO
    const httpServer = http.createServer(app);
    initializeSocket(httpServer);

    // Start server
    httpServer.listen(env.PORT, () => {
      console.log(`\n🚀 Server is running on port ${env.PORT}`);
      console.log(`📋 Environment: ${env.NODE_ENV}`);
      console.log(`🌐 API URL: http://localhost:${env.PORT}/api/v1`);
      console.log(`🔌 WebSocket: ws://localhost:${env.PORT}`);
      console.log(`❤️  Health: http://localhost:${env.PORT}/health\n`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle unhandled rejections
process.on('unhandledRejection', (reason: any) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  stopCronJobs();
  redis.quit();
  process.exit(0);
});

startServer();
