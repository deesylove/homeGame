import { useGame } from '../store/gameStore';
import socket from '../socket';
import PlayerSeat from '../components/PlayerSeat';
import ActionPanel from '../components/ActionPanel';
import ChatBox from '../components/ChatBox';
import { CardRow } from '../components/CardDisplay';
import './TablePage.css';

// Positions for up to 9 seats arranged around an oval table (percentages)
const SEAT_POSITIONS = [
  { bottom: '4%',  left: '50%',  transform: 'translateX(-50%)' }, // 0 - bottom center (hero)
  { bottom: '18%', left: '18%'  },  // 1
  { top:    '35%', left: '4%'   },  // 2
  { top:    '8%',  left: '18%'  },  // 3
  { top:    '2%',  left: '50%',  transform: 'translateX(-50%)' }, // 4 - top center
  { top:    '8%',  right: '18%' },  // 5
  { top:    '35%', right: '4%'  },  // 6
  { bottom: '18%', right: '18%' },  // 7
  { bottom: '4%',  right: '18%' },  // 8
];

export default function TablePage() {
  const { state, dispatch } = useGame();
  const { tableState, user } = state;

  if (!tableState) return <div className="table-loading">Connecting to table...</div>;

  const { seats, phase, communityCards, pot, currentBet, actionSeat, dealerSeat, winners, chat, handNumber } = tableState;
  const isHost = seats.some(s => s && s.userId === user.id) && tableState.tableId && true;
  const myUserId = user.id;
  const canStart = phase === 'waiting' && seats.filter(Boolean).length >= 2;
  const isShowdown = phase === 'showdown';

  // Find SB/BB seats relative to dealer
  const seatedIndices = seats.map((s, i) => s ? i : -1).filter(i => i >= 0);
  function nextSeatedFrom(idx) {
    for (let i = 1; i <= 9; i++) {
      const next = (idx + i) % 9;
      if (seats[next]) return next;
    }
    return idx;
  }
  const sbSeat = seatedIndices.length > 1 ? nextSeatedFrom(dealerSeat) : -1;
  const bbSeat = seatedIndices.length > 1 ? nextSeatedFrom(sbSeat) : -1;

  function leaveTable() {
    socket.emit('leaveTable');
    dispatch({ type: 'LEAVE_TABLE' });
  }

  function startGame() {
    socket.emit('startGame');
  }

  function nextHand() {
    socket.emit('nextHand');
  }

  return (
    <div className="table-page">
      <div className="table-top-bar">
        <span className="phase-label">{phase.toUpperCase()} {handNumber > 0 ? `· Hand #${handNumber}` : ''}</span>
        <span className="pot-label">Pot: {pot}</span>
        {state.error && (
          <span className="error-banner inline" onClick={() => dispatch({ type: 'CLEAR_ERROR' })}>
            {state.error}
          </span>
        )}
        <button className="btn-leave" onClick={leaveTable}>Leave</button>
      </div>

      <div className="felt-area">
        {/* Seats */}
        {seats.map((seat, i) => (
          <div key={i} className="seat-wrapper" style={SEAT_POSITIONS[i] || {}}>
            <PlayerSeat
              seat={seat}
              isMe={seat?.userId === myUserId}
              isAction={actionSeat === i}
              isDealer={dealerSeat === i}
              isSmallBlind={sbSeat === i}
              isBigBlind={bbSeat === i}
            />
          </div>
        ))}

        {/* Center of table */}
        <div className="table-center">
          <div className="community-cards">
            {communityCards.length > 0
              ? <CardRow cards={communityCards} />
              : <span className="waiting-text">{phase === 'waiting' ? 'Waiting for players...' : ''}</span>
            }
          </div>

          {isShowdown && winners.length > 0 && (
            <div className="winners-display">
              {winners.map((w, i) => (
                <div key={i} className="winner">
                  {w.username} wins {w.amount} chips ({w.handName})
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="table-bottom">
        {phase === 'waiting' && canStart && (
          <button className="btn-start" onClick={startGame}>Start Hand</button>
        )}
        {isShowdown && (
          <button className="btn-next" onClick={nextHand}>Next Hand</button>
        )}
        {phase !== 'waiting' && phase !== 'showdown' && (
          <ActionPanel tableState={tableState} myUserId={myUserId} />
        )}
      </div>

      <ChatBox chat={chat} />
    </div>
  );
}
