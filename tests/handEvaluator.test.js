const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { evaluate, compareScores, HAND_RANKS } = require('../server/game/HandEvaluator');

function c(rank, suit) {
  const VALUES = { '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'T':10,'J':11,'Q':12,'K':13,'A':14 };
  return { rank, suit, value: VALUES[rank] };
}

describe('HandEvaluator — hand recognition', () => {
  test('Royal Flush', () => {
    const cards = [c('A','s'), c('K','s'), c('Q','s'), c('J','s'), c('T','s')];
    const r = evaluate(cards);
    assert.equal(r.rank, HAND_RANKS.ROYAL_FLUSH);
    assert.equal(r.name, 'Royal Flush');
  });

  test('Straight Flush', () => {
    const cards = [c('9','h'), c('8','h'), c('7','h'), c('6','h'), c('5','h')];
    const r = evaluate(cards);
    assert.equal(r.rank, HAND_RANKS.STRAIGHT_FLUSH);
  });

  test('Four of a Kind', () => {
    const cards = [c('A','s'), c('A','h'), c('A','d'), c('A','c'), c('K','s')];
    const r = evaluate(cards);
    assert.equal(r.rank, HAND_RANKS.FOUR_OF_A_KIND);
  });

  test('Full House', () => {
    const cards = [c('K','s'), c('K','h'), c('K','d'), c('Q','s'), c('Q','h')];
    const r = evaluate(cards);
    assert.equal(r.rank, HAND_RANKS.FULL_HOUSE);
  });

  test('Flush', () => {
    const cards = [c('A','d'), c('9','d'), c('7','d'), c('4','d'), c('2','d')];
    const r = evaluate(cards);
    assert.equal(r.rank, HAND_RANKS.FLUSH);
  });

  test('Straight (normal)', () => {
    const cards = [c('9','s'), c('8','h'), c('7','d'), c('6','c'), c('5','s')];
    const r = evaluate(cards);
    assert.equal(r.rank, HAND_RANKS.STRAIGHT);
  });

  test('Straight — wheel (A-2-3-4-5)', () => {
    const cards = [c('A','s'), c('2','h'), c('3','d'), c('4','c'), c('5','s')];
    const r = evaluate(cards);
    assert.equal(r.rank, HAND_RANKS.STRAIGHT);
    // wheel high card is 5
    assert.equal(r.score[1], 5);
  });

  test('Three of a Kind', () => {
    const cards = [c('J','s'), c('J','h'), c('J','d'), c('9','s'), c('2','c')];
    const r = evaluate(cards);
    assert.equal(r.rank, HAND_RANKS.THREE_OF_A_KIND);
  });

  test('Two Pair', () => {
    const cards = [c('A','s'), c('A','h'), c('K','d'), c('K','c'), c('Q','s')];
    const r = evaluate(cards);
    assert.equal(r.rank, HAND_RANKS.TWO_PAIR);
  });

  test('Pair', () => {
    const cards = [c('T','s'), c('T','h'), c('9','d'), c('4','c'), c('2','s')];
    const r = evaluate(cards);
    assert.equal(r.rank, HAND_RANKS.PAIR);
  });

  test('High Card', () => {
    const cards = [c('A','s'), c('K','h'), c('Q','d'), c('J','c'), c('9','s')];
    const r = evaluate(cards);
    assert.equal(r.rank, HAND_RANKS.HIGH_CARD);
  });
});

describe('HandEvaluator — best hand from 7 cards', () => {
  test('picks straight flush from 7 cards', () => {
    const cards = [
      c('9','h'), c('8','h'), c('7','h'), c('6','h'), c('5','h'), // straight flush
      c('A','s'), c('A','h'), // pair of aces
    ];
    const r = evaluate(cards);
    assert.equal(r.rank, HAND_RANKS.STRAIGHT_FLUSH);
  });

  test('picks two pair from 7 cards (no straight/flush possible)', () => {
    // A A K K 9 5 2 — best hand is two pair (aces and kings), no straight/flush
    const cards = [
      c('A','s'), c('A','h'), c('K','d'), c('K','c'),
      c('9','s'), c('5','h'), c('2','d'),
    ];
    const r = evaluate(cards);
    assert.equal(r.rank, HAND_RANKS.TWO_PAIR);
  });
});

describe('HandEvaluator — tiebreaking', () => {
  test('higher pair beats lower pair', () => {
    const aces = evaluate([c('A','s'), c('A','h'), c('K','d'), c('Q','c'), c('J','s')]);
    const kings = evaluate([c('K','s'), c('K','h'), c('A','d'), c('Q','c'), c('J','h')]);
    assert.equal(compareScores(aces.score, kings.score), 1);
  });

  test('same pair, better kicker wins', () => {
    const highKick = evaluate([c('A','s'), c('A','h'), c('K','d'), c('Q','c'), c('J','s')]);
    const lowKick  = evaluate([c('A','d'), c('A','c'), c('K','h'), c('Q','s'), c('9','d')]);
    assert.equal(compareScores(highKick.score, lowKick.score), 1);
  });

  test('identical hands tie', () => {
    const h1 = evaluate([c('A','s'), c('A','h'), c('K','d'), c('Q','c'), c('J','s')]);
    const h2 = evaluate([c('A','d'), c('A','c'), c('K','h'), c('Q','s'), c('J','h')]);
    assert.equal(compareScores(h1.score, h2.score), 0);
  });

  test('higher straight beats lower straight', () => {
    const ten  = evaluate([c('T','s'), c('9','h'), c('8','d'), c('7','c'), c('6','s')]);
    const nine = evaluate([c('9','s'), c('8','h'), c('7','d'), c('6','c'), c('5','s')]);
    assert.equal(compareScores(ten.score, nine.score), 1);
  });

  test('wheel straight loses to 2-6 straight', () => {
    const wheel = evaluate([c('A','s'), c('2','h'), c('3','d'), c('4','c'), c('5','s')]);
    const low   = evaluate([c('2','s'), c('3','h'), c('4','d'), c('5','c'), c('6','s')]);
    assert.equal(compareScores(low.score, wheel.score), 1);
  });
});
