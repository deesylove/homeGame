import { useState } from 'react';
import socket from '../socket';

export default function ActionPanel({ tableState, myUserId }) {
  const [raiseAmount, setRaiseAmount] = useState(0);

  const mySeat = tableState.seats.find(s => s && s.userId === myUserId);
  if (!mySeat) return null;

  const isMyTurn = tableState.seats[tableState.actionSeat]?.userId === myUserId;
  if (!isMyTurn) return <div className="action-panel waiting">Waiting for your turn...</div>;

  const toCall = tableState.currentBet - mySeat.bet;
  const minRaise = tableState.currentBet * 2;
  const maxRaise = mySeat.chips + mySeat.bet;

  function act(action, amount) {
    socket.emit('gameAction', { action, amount });
  }

  return (
    <div className="action-panel active">
      <div className="action-info">
        <span>Pot: <strong>{tableState.pot}</strong></span>
        {toCall > 0 && <span>To call: <strong>{Math.min(toCall, mySeat.chips)}</strong></span>}
        <span>Your chips: <strong>{mySeat.chips}</strong></span>
      </div>

      <div className="action-buttons">
        <button className="btn-fold" onClick={() => act('fold')}>Fold</button>

        {toCall === 0
          ? <button className="btn-check" onClick={() => act('check')}>Check</button>
          : <button className="btn-call" onClick={() => act('call')}>
              Call {Math.min(toCall, mySeat.chips)}
            </button>
        }

        {mySeat.chips > toCall && (
          <>
            <button className="btn-allin" onClick={() => act('allin')}>All In</button>
            <div className="raise-row">
              <input
                type="range"
                min={minRaise}
                max={maxRaise}
                step={tableState.bigBlind}
                value={raiseAmount || minRaise}
                onChange={e => setRaiseAmount(+e.target.value)}
              />
              <span>{raiseAmount || minRaise}</span>
              <button className="btn-raise" onClick={() => act('raise', raiseAmount || minRaise)}>
                Raise
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
