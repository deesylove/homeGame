import { useEffect, useState } from 'react';
import { useGame } from '../store/gameStore';
import socket from '../socket';
import './LobbyPage.css';

export default function LobbyPage() {
  const { state, dispatch } = useGame();
  const [showCreate, setShowCreate] = useState(false);
  const [smallBlind, setSmallBlind] = useState(5);
  const [bigBlind, setBigBlind] = useState(10);
  const [startingChips, setStartingChips] = useState(1000);

  useEffect(() => {
    socket.emit('getLobby');
  }, []);

  function createTable() {
    socket.emit('createTable', { smallBlind: +smallBlind, bigBlind: +bigBlind, startingChips: +startingChips });
    setShowCreate(false);
  }

  function joinTable(tableId) {
    socket.emit('joinTable', { tableId });
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    socket.disconnect();
    dispatch({ type: 'SET_USER', payload: null });
  }

  return (
    <div className="lobby-page">
      <header className="lobby-header">
        <h1>HomeGame Poker</h1>
        <div className="user-info">
          <span>{state.user?.username}</span>
          <span className="chips">{state.user?.chips?.toLocaleString()} chips</span>
          <button onClick={logout} className="btn-logout">Logout</button>
        </div>
      </header>

      {state.error && (
        <div className="error-banner" onClick={() => dispatch({ type: 'CLEAR_ERROR' })}>
          {state.error}
        </div>
      )}

      <div className="lobby-content">
        <div className="lobby-actions">
          <h2>Tables</h2>
          <button className="btn-create" onClick={() => setShowCreate(!showCreate)}>
            + Create Table
          </button>
        </div>

        {showCreate && (
          <div className="create-form">
            <h3>New Table Settings</h3>
            <div className="form-row">
              <label>Small Blind</label>
              <input type="number" value={smallBlind} onChange={e => setSmallBlind(e.target.value)} min="1" />
            </div>
            <div className="form-row">
              <label>Big Blind</label>
              <input type="number" value={bigBlind} onChange={e => setBigBlind(e.target.value)} min="2" />
            </div>
            <div className="form-row">
              <label>Starting Chips</label>
              <input type="number" value={startingChips} onChange={e => setStartingChips(e.target.value)} min="100" />
            </div>
            <button className="btn-create" onClick={createTable}>Create</button>
          </div>
        )}

        {state.lobbyList.length === 0 ? (
          <div className="empty-lobby">No tables open. Create one!</div>
        ) : (
          <div className="table-list">
            {state.lobbyList.map(table => (
              <div key={table.tableId} className="table-card">
                <div className="table-info">
                  <span className="table-blinds">{table.smallBlind}/{table.bigBlind}</span>
                  <span className="table-players">{table.playerCount}/{table.maxPlayers} players</span>
                  <span className={`table-phase ${table.phase}`}>{table.phase}</span>
                  <div className="table-names">{table.players.join(', ')}</div>
                </div>
                <button
                  onClick={() => joinTable(table.tableId)}
                  disabled={table.playerCount >= table.maxPlayers || table.phase !== 'waiting'}
                  className="btn-join"
                >
                  {table.phase !== 'waiting' ? 'In Progress' : 'Join'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
