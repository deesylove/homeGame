// Renders a playing card as pure CSS/text — no image files needed

const SUIT_SYMBOLS = { s: '♠', h: '♥', d: '♦', c: '♣' };
const RED_SUITS = new Set(['h', 'd']);

export function Card({ card, faceDown = false, small = false }) {
  if (faceDown || !card) {
    return <div className={`card face-down ${small ? 'small' : ''}`}><span>🂠</span></div>;
  }
  const isRed = RED_SUITS.has(card.suit);
  return (
    <div className={`card ${isRed ? 'red' : 'black'} ${small ? 'small' : ''}`}>
      <span className="card-rank">{card.rank}</span>
      <span className="card-suit">{SUIT_SYMBOLS[card.suit]}</span>
    </div>
  );
}

export function CardRow({ cards, faceDown = false, small = false }) {
  return (
    <div className="card-row">
      {cards.map((c, i) => <Card key={i} card={c} faceDown={faceDown || !c} small={small} />)}
    </div>
  );
}
