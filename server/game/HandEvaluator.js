// Hand categories (higher = better)
const HAND_RANKS = {
  HIGH_CARD: 1,
  PAIR: 2,
  TWO_PAIR: 3,
  THREE_OF_A_KIND: 4,
  STRAIGHT: 5,
  FLUSH: 6,
  FULL_HOUSE: 7,
  FOUR_OF_A_KIND: 8,
  STRAIGHT_FLUSH: 9,
  ROYAL_FLUSH: 10,
};

/**
 * Evaluate the best 5-card hand from 5-7 cards.
 * Returns { rank, name, score } where score is an array for tiebreaking.
 */
function evaluate(cards) {
  if (cards.length < 5) throw new Error('Need at least 5 cards');

  // Try all C(n,5) combinations and pick the best
  const combos = getCombinations(cards, 5);
  let best = null;
  for (const combo of combos) {
    const result = evaluateFive(combo);
    if (!best || compareScores(result.score, best.score) > 0) {
      best = result;
    }
  }
  return best;
}

function evaluateFive(cards) {
  const values = cards.map(c => c.value).sort((a, b) => b - a);
  const suits = cards.map(c => c.suit);
  const rankCounts = {};
  for (const v of values) rankCounts[v] = (rankCounts[v] || 0) + 1;

  const counts = Object.values(rankCounts).sort((a, b) => b - a);
  const uniqueValues = [...new Set(values)].sort((a, b) => b - a);
  const isFlush = suits.every(s => s === suits[0]);
  const isStraight = checkStraight(values);
  const straightHigh = isStraight ? getStraightHigh(values) : null;

  if (isFlush && isStraight) {
    if (straightHigh === 14) return { rank: HAND_RANKS.ROYAL_FLUSH, name: 'Royal Flush', score: [HAND_RANKS.ROYAL_FLUSH, straightHigh] };
    return { rank: HAND_RANKS.STRAIGHT_FLUSH, name: 'Straight Flush', score: [HAND_RANKS.STRAIGHT_FLUSH, straightHigh] };
  }
  if (counts[0] === 4) {
    const quadVal = getValuesByCount(rankCounts, 4)[0];
    const kicker = getValuesByCount(rankCounts, 1)[0];
    return { rank: HAND_RANKS.FOUR_OF_A_KIND, name: 'Four of a Kind', score: [HAND_RANKS.FOUR_OF_A_KIND, quadVal, kicker] };
  }
  if (counts[0] === 3 && counts[1] === 2) {
    const tripVal = getValuesByCount(rankCounts, 3)[0];
    const pairVal = getValuesByCount(rankCounts, 2)[0];
    return { rank: HAND_RANKS.FULL_HOUSE, name: 'Full House', score: [HAND_RANKS.FULL_HOUSE, tripVal, pairVal] };
  }
  if (isFlush) {
    return { rank: HAND_RANKS.FLUSH, name: 'Flush', score: [HAND_RANKS.FLUSH, ...values] };
  }
  if (isStraight) {
    return { rank: HAND_RANKS.STRAIGHT, name: 'Straight', score: [HAND_RANKS.STRAIGHT, straightHigh] };
  }
  if (counts[0] === 3) {
    const tripVal = getValuesByCount(rankCounts, 3)[0];
    const kickers = getValuesByCount(rankCounts, 1).sort((a, b) => b - a);
    return { rank: HAND_RANKS.THREE_OF_A_KIND, name: 'Three of a Kind', score: [HAND_RANKS.THREE_OF_A_KIND, tripVal, ...kickers] };
  }
  if (counts[0] === 2 && counts[1] === 2) {
    const pairs = getValuesByCount(rankCounts, 2).sort((a, b) => b - a);
    const kicker = getValuesByCount(rankCounts, 1)[0];
    return { rank: HAND_RANKS.TWO_PAIR, name: 'Two Pair', score: [HAND_RANKS.TWO_PAIR, pairs[0], pairs[1], kicker] };
  }
  if (counts[0] === 2) {
    const pairVal = getValuesByCount(rankCounts, 2)[0];
    const kickers = getValuesByCount(rankCounts, 1).sort((a, b) => b - a);
    return { rank: HAND_RANKS.PAIR, name: 'Pair', score: [HAND_RANKS.PAIR, pairVal, ...kickers] };
  }
  return { rank: HAND_RANKS.HIGH_CARD, name: 'High Card', score: [HAND_RANKS.HIGH_CARD, ...values] };
}

function checkStraight(sortedValues) {
  const uniq = [...new Set(sortedValues)];
  if (uniq.length < 5) return false;
  // Normal straight
  if (uniq[0] - uniq[4] === 4 && uniq.length === 5) return true;
  // Wheel: A-2-3-4-5 (ace acts as 1)
  if (uniq[0] === 14 && uniq[1] === 5 && uniq[2] === 4 && uniq[3] === 3 && uniq[4] === 2) return true;
  return false;
}

function getStraightHigh(sortedValues) {
  const uniq = [...new Set(sortedValues)];
  // Wheel: A-2-3-4-5 high card is 5
  if (uniq[0] === 14 && uniq[1] === 5 && uniq[2] === 4 && uniq[3] === 3 && uniq[4] === 2) return 5;
  return uniq[0];
}

function getValuesByCount(rankCounts, count) {
  return Object.entries(rankCounts)
    .filter(([, c]) => c === count)
    .map(([v]) => Number(v))
    .sort((a, b) => b - a);
}

function compareScores(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const av = a[i] || 0;
    const bv = b[i] || 0;
    if (av !== bv) return av > bv ? 1 : -1;
  }
  return 0;
}

function getCombinations(arr, k) {
  const result = [];
  function helper(start, combo) {
    if (combo.length === k) { result.push([...combo]); return; }
    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i]);
      helper(i + 1, combo);
      combo.pop();
    }
  }
  helper(0, []);
  return result;
}

module.exports = { evaluate, compareScores, HAND_RANKS };
