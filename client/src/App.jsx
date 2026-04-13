import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { GameProvider, useGame } from './store/gameStore';
import socket from './socket';
import LoginPage from './pages/LoginPage';
import LobbyPage from './pages/LobbyPage';
import TablePage from './pages/TablePage';
import './App.css';

function AppRoutes() {
  const { state, dispatch } = useGame();

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(user => {
        if (user) {
          dispatch({ type: 'SET_USER', payload: user });
          socket.connect();
        }
      });
  }, []);

  useEffect(() => {
    socket.on('tableState', (data) => dispatch({ type: 'TABLE_STATE', payload: data }));
    socket.on('lobbyUpdate', (data) => dispatch({ type: 'LOBBY_UPDATE', payload: data }));
    socket.on('joinedTable', ({ tableId }) => dispatch({ type: 'SET_TABLE', payload: tableId }));
    socket.on('error', ({ message }) => dispatch({ type: 'SET_ERROR', payload: message }));
    return () => {
      socket.off('tableState');
      socket.off('lobbyUpdate');
      socket.off('joinedTable');
      socket.off('error');
    };
  }, []);

  if (!state.user) return <LoginPage />;

  return (
    <Routes>
      <Route path="/" element={state.tableId ? <Navigate to="/table" /> : <LobbyPage />} />
      <Route path="/table" element={state.tableId ? <TablePage /> : <Navigate to="/" />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <GameProvider>
        <AppRoutes />
      </GameProvider>
    </BrowserRouter>
  );
}
