import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDisplayName, clearDisplayName } from '../services/auth';
import { createRoom } from '../services/api';

export default function HomePage() {
  const navigate = useNavigate();
  const displayName = getDisplayName() ?? 'Guest';
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateRoom = async () => {
    setCreating(true);
    setError(null);
    try {
      const room = await createRoom();

      console.log('🔥 CREATE ROOM RESPONSE:', room);
      console.log('🔥 CREATED ROOM CODE:', room.roomCode);

      navigate(`/room/${room.roomCode}`);
    } catch {
      setError('Could not create a room. Is the backend running?');
      setCreating(false);
    }
  };

  return (
    <div className="page-center">
      <div className="card">
        <h1>Welcome, {displayName}</h1>
        <div className="btn-group">
          <button className="btn-primary" onClick={handleCreateRoom} disabled={creating}>
            {creating ? 'Creating room...' : 'Create Room'}
          </button>
          <button className="btn-secondary" onClick={() => navigate('/join')}>
            Join Room
          </button>
        </div>
        {error && <p className="error">{error}</p>}
        <button
          className="btn-link"
          onClick={() => {
            clearDisplayName();
            navigate('/login');
          }}
        >
          Not you? Change name
        </button>
      </div>
    </div>
  );
}
