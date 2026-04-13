const GameState = require('./GameState');
const { v4: uuidv4 } = require('crypto');

// Simple UUID without external dep
function generateId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

class GameManager {
  constructor() {
    this.tables = new Map(); // tableId -> GameState
  }

  createTable(hostId, hostUsername, options = {}) {
    const tableId = generateId();
    const game = new GameState(tableId, hostId, options);
    game.sitDown(hostId, hostUsername, options.startingChips || 1000);
    this.tables.set(tableId, game);
    return tableId;
  }

  getTable(tableId) {
    return this.tables.get(tableId) || null;
  }

  deleteTable(tableId) {
    this.tables.delete(tableId);
  }

  getLobbyList() {
    const list = [];
    for (const [tableId, game] of this.tables) {
      const seated = game.getSeatedPlayers();
      list.push({
        tableId,
        phase: game.phase,
        playerCount: seated.length,
        maxPlayers: game.maxPlayers,
        smallBlind: game.smallBlind,
        bigBlind: game.bigBlind,
        players: seated.map(s => s.username),
      });
    }
    return list;
  }
}

module.exports = new GameManager(); // singleton
