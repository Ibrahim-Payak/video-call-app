import { useCallback, useEffect, useRef, useState } from 'react';
import { useWebRTC } from '../hooks/useWebRTC';
import  DevicePreview from '../components/DevicePreview';
import VideoTile from '../components/VideoTile';

interface CallRoomProps {
  roomCode: string;
  userId: string;
}

export default function CallRoom({
  roomCode,
  userId,
}: CallRoomProps) {
  // ─────────────────────────────────────────────────────────────────────
  // Local media
  // ─────────────────────────────────────────────────────────────────────

  const [localStream, setLocalStream] =
    useState<MediaStream | null>(null);

  const localStreamRef =
    useRef<MediaStream | null>(null);

  // ─────────────────────────────────────────────────────────────────────
  // WebRTC
  //
  // useWebRTC internally uses useSignaling({
  //   roomId,
  //   userId,
  // })
  // ─────────────────────────────────────────────────────────────────────

  const {
    services,
    registerLocalStream,
    startScreenShare,
    stopScreenShare,
    isSharing,
    sharingUserId,
    leaveCall,
  } = useWebRTC({
    roomId: roomCode,
    userId,
  });

  // ─────────────────────────────────────────────────────────────────────
  // Join
  // ─────────────────────────────────────────────────────────────────────

  const [joined, setJoined] = useState(false);

  const handleJoin = useCallback(async () => {
    try {
      const stream =
        await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

      localStreamRef.current = stream;
      setLocalStream(stream);

      // Register camera/microphone with WebRTC.
      registerLocalStream(stream);

      setJoined(true);
    } catch (error) {
      console.error(
        '[CallRoom] Failed to get local media:',
        error
      );
    }
  }, [registerLocalStream]);

  // ─────────────────────────────────────────────────────────────────────
  // Leave
  // ─────────────────────────────────────────────────────────────────────

  const handleLeave = useCallback(() => {
    // Close all peer connections and stop screen sharing.
    leaveCall();

    // Stop camera/microphone.
    localStreamRef.current
      ?.getTracks()
      .forEach((track) => track.stop());

    localStreamRef.current = null;

    setLocalStream(null);
    setJoined(false);

    // If you use React Router:
    //
    // navigate('/');
  }, [leaveCall]);

  // ─────────────────────────────────────────────────────────────────────
  // Screen sharing
  // ─────────────────────────────────────────────────────────────────────

  const handleScreenShare = useCallback(async () => {
    if (isSharing) {
      stopScreenShare();
      return;
    }

    try {
      await startScreenShare();
    } catch (error) {
      console.error(
        '[CallRoom] Failed to start screen sharing:',
        error
      );
    }
  }, [
    isSharing,
    startScreenShare,
    stopScreenShare,
  ]);

  // ─────────────────────────────────────────────────────────────────────
  // Cleanup
  // ─────────────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      localStreamRef.current
        ?.getTracks()
        .forEach((track) => track.stop());

      localStreamRef.current = null;

      // useWebRTC performs peer/screen-share cleanup itself.
      leaveCall();
    };
  }, [leaveCall]);

  // ─────────────────────────────────────────────────────────────────────
  // Pre-join screen
  // ─────────────────────────────────────────────────────────────────────

  if (!joined) {
    return (
      <DevicePreview
        onJoin={handleJoin}
        joinLabel={`Join room ${roomCode}`}
      />
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // In-call screen
  // ─────────────────────────────────────────────────────────────────────

  return (
    <div
      className="call-room"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: '#111',
        color: '#fff',
      }}
    >
      {/* Header */}
      <header
        className="room-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid #333',
        }}
      >
        <div>
          Room:{' '}
          <strong>{roomCode}</strong>
        </div>

        <div>
          {services.size === 0
            ? 'Waiting for others…'
            : `${services.size} ${
                services.size === 1
                  ? 'participant'
                  : 'participants'
              }`}
        </div>
      </header>

      {/* Video area */}
      <main
        className="video-grid"
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 8,
          padding: 8,
          alignContent: 'start',
        }}
      >
        {/* Local video */}
        <VideoTile
          stream={localStream}
          userId={userId}
          isLocal
          label={
            isSharing
              ? 'You · sharing screen'
              : 'You'
          }
        />

        {/* Remote videos */}
        {Array.from(services.entries()).map(
          ([peerId, service]) => (
            <VideoTile
              key={peerId}
              stream={service.remoteStream}
              userId={peerId}
              label={
                sharingUserId === peerId
                  ? `${peerId} · sharing screen`
                  : peerId
              }
            />
          )
        )}
      </main>

      {/* Controls */}
      <footer
        className="call-controls"
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 8,
          padding: 16,
          borderTop: '1px solid #333',
        }}
      >
        <button
          type="button"
          onClick={handleScreenShare}
        >
          {isSharing
            ? '🛑 Stop sharing'
            : '🖥️ Share screen'}
        </button>

        <button
          type="button"
          onClick={handleLeave}
          style={{
            background: '#dc2626',
            color: '#fff',
            border: 'none',
            padding: '8px 16px',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          📞 Leave
        </button>
      </footer>
    </div>
  );
}
