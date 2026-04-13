import { useState, useEffect, useRef } from 'react';
import socket from '../socket';

export default function ChatBox({ chat = [] }) {
  const [msg, setMsg] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat]);

  function send(e) {
    e.preventDefault();
    if (!msg.trim()) return;
    socket.emit('chatMessage', { message: msg.trim() });
    setMsg('');
  }

  return (
    <div className="chatbox">
      <div className="chat-messages">
        {chat.map((m, i) => (
          <div key={i} className="chat-line">
            <span className="chat-user">{m.username}:</span> {m.message}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form className="chat-input" onSubmit={send}>
        <input
          value={msg}
          onChange={e => setMsg(e.target.value)}
          placeholder="Chat..."
          maxLength={200}
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
