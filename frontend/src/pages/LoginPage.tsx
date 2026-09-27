import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { saveDisplayName } from '../services/auth';

export default function LoginPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    const trimmed = name.trim();

    if (!trimmed) {
      setError('Display name is required.');
      return;
    }
    if (trimmed.length < 2 || trimmed.length > 30) {
      setError('Display name must be between 2 and 30 characters.');
      return;
    }

    setError(null);
    saveDisplayName(trimmed);
    navigate('/home');
  };

  return (
    <div className="page-center">
      <div className="card">
        <h1>Welcome to Video Call</h1>
        <form onSubmit={handleSubmit}>
          <label htmlFor="displayName">Display Name</label>
          <input
            id="displayName"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            autoFocus
          />
          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn-primary">
            Continue
          </button>
        </form>
      </div>
    </div>
  );
}
