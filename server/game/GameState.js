const Deck = require('./Deck');
const { evaluate, compareScores } = require('./HandEvaluator');

const PHASES = ['waiting', 'preflop', 'flop', 'turn', 'river', 'showdown'];

class GameState {
  constructor(tableId, hostId, options = {}) {
    this.tableId = tableId;
    this.hostId = hostId;
    this.smallBlind = options.smallBlind || 5;
    this.bigBlind = options.bigBlind || 10;
    this.maxPlayers = options.maxPlayers || 9;
    this.startingChips = options.startingChips || 1000;

    // seats[i] = null | { userId, username, chips, holeCards, bet, totalBet, status, seatIndex }
    // status: 'waiting' | 'active' | 'folded' | 'allin' | 'out'
    this.seats = Array(this.maxPlayers).fill(null);
    this.phase = 'waiting';
    this.communityCards = [];
    this.pot = 0;
    this.sidePots = []; // [{ amount, eligible: [seatIndex] }]
    this.currentBet = 0;
    this.actionSeat = -1;
    this.dealerSeat = -1;
    this.deck = null;
    this.handNumber = 0;
    this.lastAction = null;
    this.winners = [];
    this.chat = [];
  }

  // --- Seat management ---

  sitDown(userId, username, chips) {
    const emptyIndex = this.seats.findIndex(s => s === null);
    if (emptyIndex === -1) return { error: 'Table is full' };
    if (this.seats.some(s => s && s.userId === userId)) return { error: 'Already seated' };

    this.seats[emptyIndex] = {
      userId,
      username,
      chips,
      holeCards: [],
      bet: 0,
      totalBet: 0,
      status: 'waiting',
      seatIndex: emptyIndex,
    };
    return { seatIndex: emptyIndex };
  }

  standUp(userId) {
    const idx = this.seats.findIndex(s => s && s.userId === userId);
    if (idx === -1) return { error: 'Not seated' };
    if (this.phase !== 'waiting') return { error: 'Cannot leave mid-hand' };
    const chips = this.seats[idx].chips;
    this.seats[idx] = null;
    return { chips };
  }

  getActivePlayers() {
    return this.seats.filter(s => s && (s.status === 'active' || s.status === 'allin'));
  }

  getSeatedPlayers() {
    return this.seats.filter(s => s !== null);
  }

  // --- Hand lifecycle ---

  canStart() {
    return this.getSeatedPlayers().length >= 2 && this.phase === 'waiting';
  }

  startHand() {
    const seated = this.getSeatedPlayers();
    if (seated.length < 2) return { error: 'Need at least 2 players' };

    this.handNumber++;
    this.communityCards = [];
    this.pot = 0;
    this.sidePots = [];
    this.currentBet = 0;
    this.winners = [];
    this.deck = new Deck();

    // Reset seats
    for (const seat of this.seats) {
      if (seat) {
        seat.holeCards = [];
        seat.bet = 0;
        seat.totalBet = 0;
        seat.status = seat.chips > 0 ? 'active' : 'out';
      }
    }

    // Advance dealer button
    this._advanceDealer();

    // Post blinds
    this._postBlinds();

    // Deal hole cards
    const activePlayers = this.getActivePlayers();
    for (const seat of activePlayers) {
      seat.holeCards = this.deck.dealMany(2);
    }

    this.phase = 'preflop';

    // Action starts left of big blind
    const bbSeat = this._getBigBlindSeat();
    this.actionSeat = this._nextActiveFrom(bbSeat);

    return { ok: true };
  }

  _advanceDealer() {
    const seated = this.getSeatedPlayers();
    if (this.dealerSeat === -1) {
      this.dealerSeat = seated[0].seatIndex;
      return;
    }
    this.dealerSeat = this._nextSeatedFrom(this.dealerSeat);
  }

  _postBlinds() {
    const seated = this.getSeatedPlayers().filter(s => s.chips > 0);
    if (seated.length < 2) return;

    const heads_up = seated.length === 2;
    let sbSeat, bbSeat;

    if (heads_up) {
      sbSeat = this.dealerSeat;
      bbSeat = this._nextSeatedFrom(sbSeat);
    } else {
      sbSeat = this._nextSeatedFrom(this.dealerSeat);
      bbSeat = this._nextSeatedFrom(sbSeat);
    }

    this._placeBet(sbSeat, Math.min(this.smallBlind, this.seats[sbSeat].chips));
    this._placeBet(bbSeat, Math.min(this.bigBlind, this.seats[bbSeat].chips));
    this.currentBet = this.bigBlind;
  }

  _getSmallBlindSeat() {
    const seated = this.getSeatedPlayers();
    if (seated.length === 2) return this.dealerSeat;
    return this._nextSeatedFrom(this.dealerSeat);
  }

  _getBigBlindSeat() {
    return this._nextSeatedFrom(this._getSmallBlindSeat());
  }

  _placeBet(seatIndex, amount) {
    const seat = this.seats[seatIndex];
    if (!seat) return 0;
    const actual = Math.min(amount, seat.chips);
    seat.chips -= actual;
    seat.bet += actual;
    seat.totalBet += actual;
    this.pot += actual;
    if (seat.chips === 0) seat.status = 'allin';
    return actual;
  }

  // --- Actions ---

  processAction(userId, action, amount = 0) {
    const seat = this.seats[this.actionSeat];
    if (!seat || seat.userId !== userId) return { error: 'Not your turn' };
    if (this.phase === 'waiting' || this.phase === 'showdown') return { error: 'No action phase active' };

    const toCall = this.currentBet - seat.bet;

    switch (action) {
      case 'fold':
        seat.status = 'folded';
        break;

      case 'check':
        if (toCall > 0) return { error: 'Cannot check, must call or raise' };
        break;

      case 'call': {
        const callAmount = Math.min(toCall, seat.chips);
        this._placeBet(this.actionSeat, callAmount);
        break;
      }

      case 'raise': {
        const minRaise = this.currentBet * 2;
        if (amount < minRaise && amount < seat.chips + seat.bet) return { error: `Minimum raise is ${minRaise}` };
        const raiseExtra = Math.min(amount - seat.bet, seat.chips);
        this._placeBet(this.actionSeat, raiseExtra);
        if (seat.status !== 'allin') this.currentBet = seat.bet;
        // Reset action so everyone must respond
        this.lastRaiseSeat = this.actionSeat;
        break;
      }

      case 'allin': {
        this._placeBet(this.actionSeat, seat.chips);
        if (seat.bet > this.currentBet) {
          this.currentBet = seat.bet;
          this.lastRaiseSeat = this.actionSeat;
        }
        break;
      }

      default:
        return { error: 'Unknown action' };
    }

    this.lastAction = { userId, action, amount: seat.bet, seatIndex: this.actionSeat };
    this._advanceAction();
    return { ok: true };
  }

  _advanceAction() {
    // Check for immediate win (everyone else folded)
    const active = this.getActivePlayers();
    const notFolded = this.seats.filter(s => s && s.status !== 'folded' && s.status !== 'out');

    if (notFolded.length === 1) {
      this._awardPotNoShowdown(notFolded[0].seatIndex);
      return;
    }

    // Find next player who needs to act
    const next = this._findNextToAct();
    if (next === -1) {
      // Betting round over
      this._nextPhase();
    } else {
      this.actionSeat = next;
    }
  }

  _findNextToAct() {
    // Look for an active (not allin, not folded) player who hasn't matched currentBet
    // or who hasn't acted yet this round
    let seat = this._nextActiveFrom(this.actionSeat);
    const startSeat = seat;

    // We do a full loop — if nobody needs to act, return -1
    let checked = 0;
    while (checked < this.maxPlayers) {
      const s = this.seats[seat];
      if (s && s.status === 'active') {
        if (s.bet < this.currentBet) return seat; // needs to call
        // Has everyone acted? We use a simple heuristic:
        // if this seat is the last raiser or BB and currentBet was just set, they've acted
      }
      seat = this._nextActiveFrom(seat);
      if (seat === startSeat) break;
      checked++;
    }

    // Second pass: check if anyone is active and hasn't put in currentBet
    for (let i = 0; i < this.maxPlayers; i++) {
      const s = this.seats[i];
      if (s && s.status === 'active' && s.bet < this.currentBet) return i;
    }

    return -1;
  }

  _nextPhase() {
    // Calculate side pots before moving on
    this._calculateSidePots();

    // Reset bets for new round
    for (const seat of this.seats) {
      if (seat) seat.bet = 0;
    }
    this.currentBet = 0;

    const phasesInOrder = ['preflop', 'flop', 'turn', 'river', 'showdown'];
    const currentIndex = phasesInOrder.indexOf(this.phase);
    const nextPhase = phasesInOrder[currentIndex + 1];

    if (nextPhase === 'flop') {
      this.communityCards = this.deck.dealMany(3);
    } else if (nextPhase === 'turn' || nextPhase === 'river') {
      this.communityCards.push(this.deck.deal());
    } else if (nextPhase === 'showdown') {
      this._evaluateShowdown();
      return;
    }

    this.phase = nextPhase;

    // Action starts left of dealer
    const firstActive = this._nextActiveFrom(this.dealerSeat);
    this.actionSeat = firstActive;

    // Skip if only all-ins remain
    const canAct = this.seats.filter(s => s && s.status === 'active');
    if (canAct.length === 0) {
      this._nextPhase();
    }
  }

  _calculateSidePots() {
    // Rebuild side pots from totalBet amounts
    const contributors = this.seats
      .filter(s => s && s.totalBet > 0)
      .map(s => ({ seatIndex: s.seatIndex, totalBet: s.totalBet, status: s.status }))
      .sort((a, b) => a.totalBet - b.totalBet);

    if (contributors.length === 0) return;

    this.sidePots = [];
    let previous = 0;

    for (let i = 0; i < contributors.length; i++) {
      const level = contributors[i].totalBet;
      if (level === previous) continue;

      const eligible = contributors.slice(i).map(c => c.seatIndex);
      // Include non-allin players who contributed at least this level
      const allEligible = this.seats
        .filter(s => s && s.totalBet >= level && s.status !== 'folded' && s.status !== 'out')
        .map(s => s.seatIndex);

      const potSlice = (level - previous) * contributors.filter(c => c.totalBet >= level).length;
      this.sidePots.push({ amount: potSlice, eligible: allEligible });
      previous = level;
    }
  }

  _evaluateShowdown() {
    this.phase = 'showdown';
    this.winners = [];

    const notFolded = this.seats.filter(s => s && s.status !== 'folded' && s.status !== 'out');
    if (notFolded.length === 0) return;

    // Evaluate each player's best hand
    const playerHands = notFolded.map(seat => ({
      seat,
      result: evaluate([...seat.holeCards, ...this.communityCards]),
    }));

    if (this.sidePots.length === 0) this._calculateSidePots();

    // Award each side pot
    for (const pot of this.sidePots) {
      const eligible = playerHands.filter(ph => pot.eligible.includes(ph.seat.seatIndex));
      if (eligible.length === 0) continue;

      eligible.sort((a, b) => compareScores(b.result.score, a.result.score));
      const bestScore = eligible[0].result.score;
      const potWinners = eligible.filter(ph => compareScores(ph.result.score, bestScore) === 0);

      const share = Math.floor(pot.amount / potWinners.length);
      const remainder = pot.amount - share * potWinners.length;

      potWinners.forEach((pw, i) => {
        pw.seat.chips += share + (i === 0 ? remainder : 0);
        this.winners.push({
          seatIndex: pw.seat.seatIndex,
          userId: pw.seat.userId,
          username: pw.seat.username,
          amount: share + (i === 0 ? remainder : 0),
          handName: pw.result.name,
        });
      });
    }
  }

  _awardPotNoShowdown(seatIndex) {
    this.phase = 'showdown';
    const seat = this.seats[seatIndex];
    seat.chips += this.pot;
    this.winners = [{
      seatIndex,
      userId: seat.userId,
      username: seat.username,
      amount: this.pot,
      handName: 'Last player standing',
    }];
  }

  resetForNextHand() {
    for (const seat of this.seats) {
      if (seat && seat.chips <= 0) seat.status = 'out';
      else if (seat) seat.status = 'waiting';
    }
    this.phase = 'waiting';
    this.communityCards = [];
    this.pot = 0;
    this.sidePots = [];
    this.currentBet = 0;
    this.actionSeat = -1;
    this.lastAction = null;
    this.winners = [];
  }

  // --- Helpers ---

  _nextSeatedFrom(seatIndex) {
    for (let i = 1; i <= this.maxPlayers; i++) {
      const idx = (seatIndex + i) % this.maxPlayers;
      if (this.seats[idx]) return idx;
    }
    return seatIndex;
  }

  _nextActiveFrom(seatIndex) {
    for (let i = 1; i <= this.maxPlayers; i++) {
      const idx = (seatIndex + i) % this.maxPlayers;
      const s = this.seats[idx];
      if (s && s.status === 'active') return idx;
    }
    return seatIndex;
  }

  // Returns public state, withholding other players' hole cards
  getPublicState(forUserId = null) {
    return {
      tableId: this.tableId,
      phase: this.phase,
      communityCards: this.communityCards,
      pot: this.pot,
      sidePots: this.sidePots,
      currentBet: this.currentBet,
      actionSeat: this.actionSeat,
      dealerSeat: this.dealerSeat,
      smallBlind: this.smallBlind,
      bigBlind: this.bigBlind,
      handNumber: this.handNumber,
      lastAction: this.lastAction,
      winners: this.winners,
      seats: this.seats.map(seat => {
        if (!seat) return null;
        return {
          userId: seat.userId,
          username: seat.username,
          chips: seat.chips,
          bet: seat.bet,
          status: seat.status,
          seatIndex: seat.seatIndex,
          // Show hole cards only at showdown or to the owner
          holeCards: (this.phase === 'showdown' && seat.status !== 'folded')
            ? seat.holeCards
            : (seat.userId === forUserId ? seat.holeCards : seat.holeCards.map(() => null)),
        };
      }),
      chat: this.chat.slice(-50),
    };
  }

  addChat(userId, username, message) {
    this.chat.push({ userId, username, message, time: Date.now() });
    if (this.chat.length > 200) this.chat.shift();
  }
}

module.exports = GameState;
