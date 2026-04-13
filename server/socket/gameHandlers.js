const gameManager = require('../game/GameManager');
const db = require('../db');

function broadcastTableState(io, tableId) {
  const game = gameManager.getTable(tableId);
  if (!game) return;

  // Send personalized state (with own hole cards) to each seated player
  game.seats.forEach(seat => {
    if (!seat) return;
    const state = game.getPublicState(seat.userId);
    io.to(`user:${seat.userId}`).emit('tableState', state);
  });
}

module.exports = function registerGameHandlers(io, socket) {
  const { userId, username } = socket;

  socket.on('startGame', () => {
    const tableId = socket.currentTable;
    if (!tableId) return socket.emit('error', { message: 'Not at a table' });

    const game = gameManager.getTable(tableId);
    if (!game) return socket.emit('error', { message: 'Table not found' });
    if (game.hostId !== userId) return socket.emit('error', { message: 'Only the host can start' });

    const result = game.startHand();
    if (result.error) return socket.emit('error', { message: result.error });

    broadcastTableState(io, tableId);
  });

  socket.on('gameAction', ({ action, amount }) => {
    const tableId = socket.currentTable;
    if (!tableId) return socket.emit('error', { message: 'Not at a table' });

    const game = gameManager.getTable(tableId);
    if (!game) return socket.emit('error', { message: 'Table not found' });

    const result = game.processAction(userId, action, amount || 0);
    if (result.error) return socket.emit('error', { message: result.error });

    broadcastTableState(io, tableId);

    // After showdown, save hand history and persist chip counts
    if (game.phase === 'showdown') {
      _saveHandAndChips(game, tableId);
    }
  });

  socket.on('nextHand', () => {
    const tableId = socket.currentTable;
    if (!tableId) return;

    const game = gameManager.getTable(tableId);
    if (!game) return;
    if (game.hostId !== userId) return socket.emit('error', { message: 'Only the host can start next hand' });
    if (game.phase !== 'showdown') return;

    game.resetForNextHand();

    // Auto-start if enough players
    if (game.canStart()) {
      const result = game.startHand();
      if (!result.error) {
        broadcastTableState(io, tableId);
        return;
      }
    }

    broadcastTableState(io, tableId);
  });

  socket.on('chatMessage', ({ message }) => {
    const tableId = socket.currentTable;
    if (!tableId) return;
    const game = gameManager.getTable(tableId);
    if (!game) return;

    const trimmed = String(message).slice(0, 200);
    game.addChat(userId, username, trimmed);
    broadcastTableState(io, tableId);
  });
};

function _saveHandAndChips(game, tableId) {
  try {
    const players = game.seats
      .filter(Boolean)
      .map(s => ({ userId: s.userId, username: s.username, chips: s.chips }));

    db.saveHandHistory.run(
      tableId,
      JSON.stringify(players),
      JSON.stringify(game.winners)
    );

    // Persist chip counts
    for (const seat of game.seats) {
      if (seat) db.updateChips.run(seat.chips, seat.userId);
    }
  } catch (e) {
    console.error('Failed to save hand history:', e);
  }
}
