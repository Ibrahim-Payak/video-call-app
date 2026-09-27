import type { CreateRoomResponse, RoomResponse } from '../types/room';
import { config } from '../config';

// const API_BASE = 'http://localhost:8080/api';
const API_BASE = config.apiUrl;

export async function createRoom(): Promise<CreateRoomResponse> {
  const res = await fetch(`${API_BASE}/rooms`, {
    method: 'POST',
  });

  if (!res.ok) {
    throw new Error('Failed to create room');
  }

  return res.json();
}

export async function getRoom(
  roomCode: string
): Promise<RoomResponse | null> {
  const code = encodeURIComponent(roomCode.trim());

  const res = await fetch(`${API_BASE}/rooms/${code}`);

  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    throw new Error('Failed to look up room');
  }

  return res.json();
}
