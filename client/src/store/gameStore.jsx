import { createContext, useContext, useReducer } from 'react';

const initialState = {
  user: null,         // { id, username, chips }
  tableId: null,
  tableState: null,   // full GameState public snapshot
  lobbyList: [],
  error: null,
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_USER':     return { ...state, user: action.payload };
    case 'SET_TABLE':    return { ...state, tableId: action.payload };
    case 'TABLE_STATE':  return { ...state, tableState: action.payload };
    case 'LOBBY_UPDATE': return { ...state, lobbyList: action.payload };
    case 'SET_ERROR':    return { ...state, error: action.payload };
    case 'CLEAR_ERROR':  return { ...state, error: null };
    case 'LEAVE_TABLE':  return { ...state, tableId: null, tableState: null };
    default:             return state;
  }
}

const GameContext = createContext(null);

export function GameProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return <GameContext.Provider value={{ state, dispatch }}>{children}</GameContext.Provider>;
}

export function useGame() {
  return useContext(GameContext);
}
