import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRoom } from '../services/api';

export default function JoinRoomPage() {
  const navigate = useNavigate();
  const [roomId, setRoomId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const code = roomId.trim().toUpperCase();
    if (!code) {
      setError('Room code is required.');
      return;
    }

    setChecking(true);
    setError(null);
    try {
      const room = await getRoom(code);
      if (!room) {
        setError('Room not found');
        setChecking(false);
        return;
      }
      navigate(`/room/${room.roomCode}`);
    } catch {
      setError('Could not check the room. Is the backend running?');
      setChecking(false);
    }
  };

  return (
    <div className="page-center">
      <div className="card">
        <h1>Join a Room</h1>
        <form onSubmit={handleSubmit}>
          <label htmlFor="roomCode">Room Code</label>
          <input
            id="roomCode"
            type="text"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            placeholder="e.g. ABC123"
            maxLength={6}
            style={{ textTransform: 'uppercase' }}
          />
          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn-primary" disabled={checking}>
            {checking ? 'Checking room...' : 'Join Room'}
          </button>
          <button type="button" className="btn-link" onClick={() => navigate('/home')}>
            Back
          </button>
        </form>
      </div>
    </div>
  );
}
