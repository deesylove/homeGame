const gameManager = require('../game/GameManager');

function broadcastLobby(io) {
  io.emit('lobbyUpdate', gameManager.getLobbyList());
}

function broadcastTableState(io, tableId) {
  const game = gameManager.getTable(tableId);
  if (!game) return;

  game.seats.forEach(seat => {
    if (!seat) return;
    const state = game.getPublicState(seat.userId);
    io.to(`user:${seat.userId}`).emit('tableState', state);
  });

  // Also send to spectators in the table room (no hole cards)
  io.to(`table:${tableId}`).emit('tableState', game.getPublicState(null));
}

module.exports = function registerLobbyHandlers(io, socket) {
  const { userId, username } = socket;

  socket.on('getLobby', () => {
    socket.emit('lobbyUpdate', gameManager.getLobbyList());
  });

  socket.on('createTable', ({ smallBlind = 5, bigBlind = 10, startingChips = 1000 } = {}) => {
    const user = socket.request.session;
    const db = require('../db');
    const userRow = db.getUserById(userId);
    if (!userRow || userRow.chip_balance < startingChips) {
      return socket.emit('error', { message: 'Not enough chips' });
    }

    const tableId = gameManager.createTable(userId, username, { smallBlind, bigBlind, startingChips });
    socket.join(`table:${tableId}`);
    socket.join(`user:${userId}`);
    socket.currentTable = tableId;

    socket.emit('joinedTable', { tableId });
    broadcastLobby(io);
    broadcastTableState(io, tableId);
  });

  socket.on('joinTable', ({ tableId }) => {
    const game = gameManager.getTable(tableId);
    if (!game) return socket.emit('error', { message: 'Table not found' });

    const db = require('../db');
    const userRow = db.getUserById(userId);
    if (!userRow) return socket.emit('error', { message: 'User not found' });

    const chips = Math.min(userRow.chip_balance, game.startingChips || 1000);
    const result = game.sitDown(userId, username, chips);
    if (result.error) return socket.emit('error', { message: result.error });

    socket.join(`table:${tableId}`);
    socket.join(`user:${userId}`);
    socket.currentTable = tableId;

    socket.emit('joinedTable', { tableId });
    broadcastLobby(io);
    broadcastTableState(io, tableId);
  });

  socket.on('leaveTable', () => {
    const tableId = socket.currentTable;
    if (!tableId) return;

    const game = gameManager.getTable(tableId);
    if (game) {
      const result = game.standUp(userId);
      if (!result.error) {
        // Return chips to DB
        const db = require('../db');
        db.adjustChips(result.chips, userId);
      }

      if (game.getSeatedPlayers().length === 0) {
        gameManager.deleteTable(tableId);
      }
    }

    socket.leave(`table:${tableId}`);
    socket.currentTable = null;

    broadcastLobby(io);
    if (game && gameManager.getTable(tableId)) broadcastTableState(io, tableId);
  });

  socket.on('rejoinTable', ({ tableId }) => {
    const game = gameManager.getTable(tableId);
    if (!game) return socket.emit('error', { message: 'Table no longer exists' });

    socket.join(`table:${tableId}`);
    socket.join(`user:${userId}`);
    socket.currentTable = tableId;

    const state = game.getPublicState(userId);
    socket.emit('tableState', state);
  });
};
