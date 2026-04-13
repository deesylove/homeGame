require('dotenv').config();
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const db = require('./db');

async function main() {
  await db.init();
  console.log('[db] initialized');

  const authRouter = require('./auth');
  const registerLobbyHandlers = require('./socket/lobbyHandlers');
  const registerGameHandlers = require('./socket/gameHandlers');

  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: 'http://localhost:5173', credentials: true }
  });

  const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET || 'fallback_secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 },
  });

  app.use(express.json());
  app.use(sessionMiddleware);

  app.use('/api/auth', authRouter);

  // Serve built client in production
  const distPath = path.join(__dirname, '..', 'client', 'dist');
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  // Share session with Socket.IO
  io.use((socket, next) => sessionMiddleware(socket.request, {}, next));

  // Auth guard
  io.use((socket, next) => {
    const sess = socket.request.session;
    if (!sess || !sess.userId) return next(new Error('Unauthorized'));
    socket.userId = sess.userId;
    socket.username = sess.username;
    next();
  });

  io.on('connection', (socket) => {
    console.log(`[socket] connected: ${socket.username} (${socket.userId})`);
    socket.join(`user:${socket.userId}`);

    registerLobbyHandlers(io, socket);
    registerGameHandlers(io, socket);

    socket.on('disconnect', () => {
      console.log(`[socket] disconnected: ${socket.username}`);
    });
  });

  const PORT = process.env.PORT || 3001;
  server.listen(PORT, () => {
    console.log(`HomeGame server running on http://localhost:${PORT}`);
  });
}

main().catch(err => { console.error(err); process.exit(1); });
