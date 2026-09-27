import CallRoom from "./CallRoom";

export default function CallPage() {
  // For testing, hardcode or pull from the URL:
  const params = new URLSearchParams(window.location.search);
  const roomId = params.get('room') ?? 'test-room';
  const userId = params.get('user') ?? `user-${Math.random().toString(36).slice(2, 8)}`;

  return <CallRoom roomCode={roomId} userId={userId} />;
}
