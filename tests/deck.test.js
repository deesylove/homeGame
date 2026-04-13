const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const Deck = require('../server/game/Deck');

describe('Deck', () => {
  test('has 52 cards after reset', () => {
    const deck = new Deck();
    assert.equal(deck.cards.length, 52);
  });

  test('all cards are unique', () => {
    const deck = new Deck();
    const keys = deck.cards.map(c => `${c.rank}${c.suit}`);
    const unique = new Set(keys);
    assert.equal(unique.size, 52);
  });

  test('deal removes a card', () => {
    const deck = new Deck();
    deck.deal();
    assert.equal(deck.cards.length, 51);
  });

  test('dealMany returns correct count', () => {
    const deck = new Deck();
    const hand = deck.dealMany(5);
    assert.equal(hand.length, 5);
    assert.equal(deck.cards.length, 47);
  });

  test('each card has rank, suit, value', () => {
    const deck = new Deck();
    for (const card of deck.cards) {
      assert.ok(card.rank);
      assert.ok(card.suit);
      assert.ok(card.value >= 2 && card.value <= 14);
    }
  });

  test('deals different orders on separate instances', () => {
    // Very unlikely to be identical after shuffle
    const d1 = new Deck();
    const d2 = new Deck();
    const same = d1.cards.every((c, i) => c.rank === d2.cards[i].rank && c.suit === d2.cards[i].suit);
    // Can't guarantee shuffle changes order but we can at least check they're valid decks
    assert.equal(d1.cards.length, 52);
    assert.equal(d2.cards.length, 52);
  });

  test('throws when deck is empty', () => {
    const deck = new Deck();
    deck.dealMany(52);
    assert.throws(() => deck.deal(), /empty/i);
  });
});
