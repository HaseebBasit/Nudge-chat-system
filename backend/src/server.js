import http from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
dotenv.config();

import app from './app.js';
import { connectDB } from './config/db.js';
import { socketAuthMiddleware } from './sockets/socketAuth.js';
import { registerSocketHandlers } from './sockets/socketHandler.js';
import { setIO } from './sockets/socketEmitter.js';

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // 1. Connect to MongoDB database
    await connectDB();

    // 2. Create HTTP server wrapping Express
    const server = http.createServer(app);

    // 3. Initialize Socket.IO with CORS
    const io = new Server(server, {
      cors: {
        origin: (origin, callback) => {
          callback(null, true);
        },
        credentials: true
      },
      pingTimeout: 60000,
      pingInterval: 25000
    });

    // 4. Attach Socket.IO authentication middleware
    io.use(socketAuthMiddleware);

    // 5. Register real-time event handlers & set global emitter
    setIO(io);
    registerSocketHandlers(io);

    // 6. Start listening
    server.listen(PORT, () => {
      console.log(`\n======================================================`);
      console.log(`🎉 NUDGE CHAT BACKEND RUNNING ON PORT ${PORT}`);
      console.log(`📡 Socket.IO initialized with secure JWT authentication`);
      console.log(`💾 MongoDB GridFS enabled for persistent binary storage`);
      console.log(`======================================================\n`);
    });

    return server;
  } catch (error) {
    console.error('Fatal error starting server:', error);
    process.exit(1);
  }
};

startServer();
