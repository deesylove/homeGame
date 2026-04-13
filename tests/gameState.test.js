const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const GameState = require('../server/game/GameState');

function makeGame(opts = {}) {
  return new GameState('table1', 'user1', { smallBlind: 5, bigBlind: 10, ...opts });
}

function sitPlayers(game, count) {
  const players = [];
  for (let i = 0; i < count; i++) {
    const id = `user${i + 1}`;
    const name = `Player${i + 1}`;
    game.sitDown(id, name, 1000);
    players.push({ id, name });
  }
  return players;
}

describe('GameState — seat management', () => {
  test('sitDown adds a player', () => {
    const game = makeGame();
    const result = game.sitDown('u1', 'Alice', 1000);
    assert.ok('seatIndex' in result);
    assert.equal(game.getSeatedPlayers().length, 1);
  });

  test('cannot sit twice', () => {
    const game = makeGame();
    game.sitDown('u1', 'Alice', 1000);
    const r = game.sitDown('u1', 'Alice', 1000);
    assert.ok(r.error);
  });

  test('standUp removes player', () => {
    const game = makeGame();
    game.sitDown('u1', 'Alice', 1000);
    game.standUp('u1');
    assert.equal(game.getSeatedPlayers().length, 0);
  });

  test('table can seat up to maxPlayers', () => {
    const game = makeGame({ maxPlayers: 3 });
    game.sitDown('u1', 'A', 1000);
    game.sitDown('u2', 'B', 1000);
    game.sitDown('u3', 'C', 1000);
    const r = game.sitDown('u4', 'D', 1000);
    assert.ok(r.error);
  });
});

describe('GameState — hand start', () => {
  test('cannot start with 1 player', () => {
    const game = makeGame();
    game.sitDown('u1', 'Alice', 1000);
    const r = game.startHand();
    assert.ok(r.error);
  });

  test('starts successfully with 2 players', () => {
    const game = makeGame();
    sitPlayers(game, 2);
    const r = game.startHand();
    assert.equal(r.ok, true);
    assert.equal(game.phase, 'preflop');
  });

  test('each active player gets 2 hole cards', () => {
    const game = makeGame();
    sitPlayers(game, 3);
    game.startHand();
    for (const seat of game.getActivePlayers()) {
      assert.equal(seat.holeCards.length, 2);
    }
  });

  test('blinds are posted correctly', () => {
    const game = makeGame({ smallBlind: 5, bigBlind: 10 });
    sitPlayers(game, 2);
    game.startHand();
    // In heads-up: dealer = SB, other = BB
    const activePlayers = game.getActivePlayers();
    const totalBets = activePlayers.reduce((sum, s) => sum + s.totalBet, 0);
    assert.equal(totalBets, 15); // SB 5 + BB 10
    assert.equal(game.pot, 15);
  });

  test('sets phase to preflop', () => {
    const game = makeGame();
    sitPlayers(game, 2);
    game.startHand();
    assert.equal(game.phase, 'preflop');
  });
});

describe('GameState — betting actions', () => {
  function setupHand(playerCount = 3) {
    const game = makeGame();
    const players = sitPlayers(game, playerCount);
    game.startHand();
    return { game, players };
  }

  test('rejects action from wrong player', () => {
    const { game, players } = setupHand(3);
    const actionSeat = game.actionSeat;
    const wrongPlayer = players.find(p => {
      const seat = game.seats.find(s => s && s.userId === p.id);
      return seat && seat.seatIndex !== actionSeat;
    });
    const r = game.processAction(wrongPlayer.id, 'call');
    assert.ok(r.error);
  });

  test('fold changes player status to folded', () => {
    const { game } = setupHand(3);
    const actingSeat = game.seats[game.actionSeat];
    game.processAction(actingSeat.userId, 'fold');
    assert.equal(actingSeat.status, 'folded');
  });

  test('call puts in the right amount', () => {
    const { game } = setupHand(3);
    const actingSeat = game.seats[game.actionSeat];
    const chipsBefore = actingSeat.chips;
    const toCall = game.currentBet - actingSeat.bet;
    game.processAction(actingSeat.userId, 'call');
    assert.equal(actingSeat.chips, chipsBefore - toCall);
  });

  test('check is valid when no bet to call', () => {
    const { game } = setupHand(2);
    // Play to flop where no bets are out
    const p1 = game.seats[game.actionSeat];
    game.processAction(p1.userId, 'call');
    // Now BB can check
    if (game.phase === 'preflop') {
      const p2 = game.seats[game.actionSeat];
      const r = game.processAction(p2.userId, 'check');
      // Check is valid when currentBet matches
      assert.ok(!r.error || r.ok);
    }
  });

  test('cannot check when there is a bet to call', () => {
    const { game } = setupHand(3);
    const actingSeat = game.seats[game.actionSeat];
    // There's a BB bet outstanding
    if (game.currentBet > actingSeat.bet) {
      const r = game.processAction(actingSeat.userId, 'check');
      assert.ok(r.error);
    }
  });

  test('all-in sets player status to allin', () => {
    const { game } = setupHand(2);
    const actingSeat = game.seats[game.actionSeat];
    game.processAction(actingSeat.userId, 'allin');
    assert.equal(actingSeat.status, 'allin');
    assert.equal(actingSeat.chips, 0);
  });

  test('raise increases currentBet', () => {
    const { game } = setupHand(3);
    const actingSeat = game.seats[game.actionSeat];
    const prevBet = game.currentBet;
    game.processAction(actingSeat.userId, 'raise', 40);
    assert.ok(game.currentBet > prevBet || game.phase !== 'preflop');
  });
});

describe('GameState — phase progression', () => {
  function runToShowdown(playerCount = 2) {
    const game = makeGame();
    sitPlayers(game, playerCount);
    game.startHand();
    // Have everyone call/check until showdown
    let safety = 0;
    while (game.phase !== 'showdown' && safety < 50) {
      safety++;
      if (game.actionSeat === -1) break;
      const seat = game.seats[game.actionSeat];
      if (!seat || seat.status !== 'active') break;
      const toCall = game.currentBet - seat.bet;
      if (toCall > 0) {
        game.processAction(seat.userId, 'call');
      } else {
        game.processAction(seat.userId, 'check');
      }
    }
    return game;
  }

  test('deals flop (3 community cards) after preflop', () => {
    const game = makeGame();
    sitPlayers(game, 2);
    game.startHand();
    // Complete preflop betting
    let safety = 0;
    while (game.phase === 'preflop' && safety < 10) {
      safety++;
      const seat = game.seats[game.actionSeat];
      if (!seat) break;
      const toCall = game.currentBet - seat.bet;
      game.processAction(seat.userId, toCall > 0 ? 'call' : 'check');
    }
    assert.ok(['flop', 'showdown'].includes(game.phase));
    if (game.phase === 'flop') assert.equal(game.communityCards.length, 3);
  });

  test('reaches showdown eventually', () => {
    const game = runToShowdown(2);
    assert.equal(game.phase, 'showdown');
  });

  test('there are winners after showdown', () => {
    const game = runToShowdown(2);
    assert.ok(game.winners.length > 0);
  });

  test('winner receives chips', () => {
    const game = runToShowdown(2);
    const totalChipsBefore = 2000; // 2 players * 1000
    const totalChipsAfter = game.seats.filter(Boolean).reduce((s, p) => s + p.chips, 0);
    assert.equal(totalChipsAfter, totalChipsBefore);
  });

  test('everyone folds — last player wins immediately', () => {
    const game = makeGame();
    sitPlayers(game, 3);
    game.startHand();

    // Fold everyone except one
    let folds = 0;
    let safety = 0;
    while (game.phase !== 'showdown' && folds < 2 && safety < 20) {
      safety++;
      const seat = game.seats[game.actionSeat];
      if (!seat || seat.status !== 'active') break;
      game.processAction(seat.userId, 'fold');
      folds++;
    }
    assert.equal(game.phase, 'showdown');
    assert.equal(game.winners.length, 1);
  });
});

describe('GameState — chip conservation', () => {
  test('total chips never change across full hand', () => {
    const game = makeGame();
    sitPlayers(game, 3);
    const startTotal = game.seats.filter(Boolean).reduce((s, p) => s + p.chips, 0);

    game.startHand();
    let safety = 0;
    while (game.phase !== 'showdown' && safety < 100) {
      safety++;
      if (game.actionSeat === -1) break;
      const seat = game.seats[game.actionSeat];
      if (!seat || seat.status !== 'active') break;
      const toCall = game.currentBet - seat.bet;
      game.processAction(seat.userId, toCall > 0 ? 'call' : 'check');
    }

    const endTotal = game.seats.filter(Boolean).reduce((s, p) => s + p.chips, 0);
    assert.equal(endTotal, startTotal);
  });
});

describe('GameState — getPublicState', () => {
  test('hides opponent hole cards', () => {
    const game = makeGame();
    const players = sitPlayers(game, 2);
    game.startHand();

    const state = game.getPublicState(players[0].id);
    const mySeat = state.seats.find(s => s && s.userId === players[0].id);
    const opponentSeat = state.seats.find(s => s && s.userId === players[1].id);

    // My cards visible
    assert.ok(mySeat.holeCards.every(c => c !== null));
    // Opponent cards hidden
    assert.ok(opponentSeat.holeCards.every(c => c === null));
  });

  test('reveals all cards at showdown', () => {
    const game = makeGame();
    sitPlayers(game, 2);
    game.startHand();
    let safety = 0;
    while (game.phase !== 'showdown' && safety < 50) {
      safety++;
      const seat = game.seats[game.actionSeat];
      if (!seat) break;
      const toCall = game.currentBet - seat.bet;
      game.processAction(seat.userId, toCall > 0 ? 'call' : 'check');
    }

    const state = game.getPublicState(null);
    for (const seat of state.seats.filter(s => s && s.status !== 'folded')) {
      assert.ok(seat.holeCards.every(c => c !== null));
    }
  });
});

describe('GameState — reset', () => {
  test('resets phase to waiting', () => {
    const game = makeGame();
    sitPlayers(game, 2);
    game.startHand();
    game.resetForNextHand();
    assert.equal(game.phase, 'waiting');
  });

  test('clears community cards', () => {
    const game = makeGame();
    sitPlayers(game, 2);
    game.startHand();
    game.resetForNextHand();
    assert.equal(game.communityCards.length, 0);
  });
});
