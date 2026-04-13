import { CardRow } from './CardDisplay';

const STATUS_LABELS = {
  active: '',
  folded: 'FOLDED',
  allin: 'ALL IN',
  waiting: 'WAITING',
  out: 'OUT',
};

export default function PlayerSeat({ seat, isMe, isAction, isDealer, isBigBlind, isSmallBlind }) {
  if (!seat) return <div className="seat empty" />;

  const { username, chips, bet, status, holeCards } = seat;
  const folded = status === 'folded';
  const out = status === 'out';

  return (
    <div className={`seat occupied ${isAction ? 'action' : ''} ${folded ? 'folded' : ''} ${out ? 'out' : ''} ${isMe ? 'me' : ''}`}>
      {isDealer && <span className="badge dealer">D</span>}
      {isSmallBlind && <span className="badge sb">SB</span>}
      {isBigBlind && <span className="badge bb">BB</span>}

      <div className="seat-name">{username}</div>
      <div className="seat-chips">{chips?.toLocaleString()}</div>

      {holeCards && holeCards.length > 0 && (
        <CardRow cards={holeCards} faceDown={!isMe && holeCards[0] === null} small />
      )}

      {bet > 0 && <div className="seat-bet">Bet: {bet}</div>}
      {STATUS_LABELS[status] && <div className="seat-status">{STATUS_LABELS[status]}</div>}
    </div>
  );
}
