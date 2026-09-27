import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import DevicePreview from '../components/DevicePreview';
import VideoGrid, {
  type GridParticipant,
} from '../components/VideoGrid';
import CallControls from '../components/CallControls';

import { getDisplayName } from '../services/auth';
import { useLocalMedia } from '../hooks/useLocalMedia';
import { useWebRTC } from '../hooks/useWebRTC';

export default function VideoRoomPage() {
  const { roomCode = '' } = useParams<{
    roomCode: string;
  }>();

  const navigate = useNavigate();

  const displayName =
    getDisplayName() ?? 'Guest';

  const [joined, setJoined] = useState(false);

  // Generate one stable ID for this participant.
  const userId = useMemo(
    () => crypto.randomUUID(),
    []
  );

  // ─────────────────────────────────────────────────────────────────────
  // Local media
  // ─────────────────────────────────────────────────────────────────────

  const {
    localStream,
    isMicEnabled,
    isCameraEnabled,
    toggleMic,
    toggleCamera,
    getCameraTrack,
    stopAll,
  } = useLocalMedia();

  // ─────────────────────────────────────────────────────────────────────
  // WebRTC
  //
  // useWebRTC internally creates:
  //
  // useSignaling({
  //   roomId: roomCode,
  //   userId,
  // })
  //
  // so this page does not need another WebSocket client.
  // ─────────────────────────────────────────────────────────────────────

  const {
    services,
    peerStates,
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
  // Register local stream with WebRTC
  // ─────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!localStream) {
      return;
    }

    registerLocalStream(localStream);
  }, [
    localStream,
    registerLocalStream,
  ]);

  // ─────────────────────────────────────────────────────────────────────
  // Join
  // ─────────────────────────────────────────────────────────────────────

  const handleJoin = useCallback(async () => {
    /*
     * DevicePreview is normally responsible for acquiring the preview
     * stream. If your useLocalMedia hook already starts media during
     * preview, this simply marks the room as joined.
     */
    setJoined(true);
  }, []);

  // ─────────────────────────────────────────────────────────────────────
  // Screen sharing
  // ─────────────────────────────────────────────────────────────────────

  const handleToggleScreenShare =
    useCallback(async () => {
      try {
        if (isSharing) {
          stopScreenShare();
        } else {
          await startScreenShare();
        }
      } catch (error) {
        console.error(
          '[VideoRoomPage] screen share failed:',
          error
        );
      }
    }, [
      isSharing,
      startScreenShare,
      stopScreenShare,
    ]);

  // ─────────────────────────────────────────────────────────────────────
  // Leave
  // ─────────────────────────────────────────────────────────────────────

  const handleLeave = useCallback(() => {
    // Stop camera/microphone.
    stopAll();

    // Stop screen sharing if active.
    if (isSharing) {
      stopScreenShare();
    }

    // Close all peer connections and clean up WebRTC.
    leaveCall();

    setJoined(false);

    navigate('/home');
  }, [
    stopAll,
    isSharing,
    stopScreenShare,
    leaveCall,
    navigate,
  ]);

  // ─────────────────────────────────────────────────────────────────────
  // Cleanup on unmount
  // ─────────────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      stopAll();

      if (isSharing) {
        stopScreenShare();
      }

      leaveCall();
    };
  }, [
    stopAll,
    isSharing,
    stopScreenShare,
    leaveCall,
  ]);

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
  // Build VideoGrid participants
  // ─────────────────────────────────────────────────────────────────────

  const participants: GridParticipant[] = [
    {
      userId,
      displayName,
      isLocal: true,

      stream: localStream,

      micEnabled: isMicEnabled,
      cameraEnabled: isCameraEnabled,

      peerState: undefined,
    },

    ...Array.from(services.entries()).map(
      ([peerId, service]) => {
        const remoteStream =
          service.remoteStream;

        const peerState =
          peerStates.get(peerId);

        return {
          userId: peerId,
          displayName: peerId,
          isLocal: false,

          stream: remoteStream,

          micEnabled:
            remoteStream
              .getAudioTracks()
              .some(
                (track) =>
                  track.readyState === 'live'
              ),

          cameraEnabled:
            remoteStream
              .getVideoTracks()
              .some(
                (track) =>
                  track.readyState === 'live'
              ),

          peerState,
        };
      }
    ),
  ];

  // ─────────────────────────────────────────────────────────────────────
  // Render call
  // ─────────────────────────────────────────────────────────────────────

  return (
    <div
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
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 24px',
          borderBottom: '1px solid #333',
        }}
      >
        <div>
          <strong>Room {roomCode}</strong>
        </div>

        <div>
          🟢 Connected ·{' '}
          {participants.length}{' '}
          {participants.length === 1
            ? 'participant'
            : 'participants'}
        </div>
      </header>

      {/* Video area */}
      <main
        style={{
          flex: 1,
          padding: 24,
        }}
      >
        <VideoGrid
          participants={participants}
        />
      </main>

      {/* Controls */}
      <footer
        style={{
          display: 'flex',
          justifyContent: 'center',
          padding: 16,
          borderTop: '1px solid #333',
        }}
      >
        <CallControls
          isMicEnabled={isMicEnabled}
          isCameraEnabled={isCameraEnabled}
          isScreenSharing={isSharing}
          onToggleMic={toggleMic}
          onToggleCamera={toggleCamera}
          onToggleScreenShare={
            () => {
              void handleToggleScreenShare();
            }
          }
          onLeave={handleLeave}
        />
      </footer>
    </div>
  );
}
