import { useEffect, useRef } from 'react';
import type { PeerConnectionState } from '../webrtc/PeerConnectionService';

export interface GridParticipant {
  userId: string;
  displayName: string;
  isLocal: boolean;
  stream: MediaStream | null;
  micEnabled: boolean;
  cameraEnabled: boolean;
  peerState?: PeerConnectionState;
  isSharing?: boolean;
}

interface VideoTileProps {
  participant: GridParticipant;
}

// ─────────────────────────────────────────────────────────────────────────────
// Single video tile
// ─────────────────────────────────────────────────────────────────────────────

function VideoTile({
  participant,
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const {
    userId,
    displayName,
    isLocal,
    stream,
    micEnabled,
    cameraEnabled,
    peerState,
    isSharing = false,
  } = participant;

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }

    if (!stream) {
      video.pause();
      return;
    }

    void video.play().catch(() => {
      // Browser autoplay policy may prevent playback.
    });
  }, [stream]);

  const stateLabel = peerState
    ? formatPeerState(peerState)
    : undefined;

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        minWidth: 0,
        background: '#000',
        borderRadius: 8,
        overflow: 'hidden',
        aspectRatio: isSharing
          ? '16 / 9'
          : '4 / 3',
        gridColumn: isSharing
          ? '1 / -1'
          : undefined,
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          objectFit: isSharing
            ? 'contain'
            : 'cover',
          transform:
            isLocal && !isSharing
              ? 'scaleX(-1)'
              : undefined,
        }}
      />

      {/* Camera-off / unavailable placeholder */}
      {!cameraEnabled && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#1f1f1f',
            color: '#fff',
            fontSize: 28,
            fontWeight: 600,
          }}
        >
          {getInitials(displayName || userId)}
        </div>
      )}

      {/* Waiting for remote stream */}
      {!stream && !isLocal && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#1f1f1f',
            color: '#aaa',
            fontSize: 14,
          }}
        >
          Connecting…
        </div>
      )}

      {/* Bottom status bar */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 8px',
          background:
            'linear-gradient(transparent, rgba(0,0,0,0.7))',
          color: '#fff',
          fontSize: 12,
        }}
      >
        <span>
          {isLocal
            ? 'You'
            : displayName || userId}
        </span>

        {isSharing && (
          <span
            aria-label="screen sharing"
            title="Screen sharing"
          >
            🖥️ sharing
          </span>
        )}

        {!micEnabled && (
          <span
            title="Muted"
            aria-label="muted"
          >
            🔇
          </span>
        )}

        {stateLabel && (
          <span
            style={{
              marginLeft: 'auto',
              opacity: 0.75,
            }}
          >
            {stateLabel}
          </span>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getInitials(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return '?';
  }

  const parts = trimmed.split(/\s+/);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return trimmed.slice(0, 2).toUpperCase();
}

function formatPeerState(
  state: PeerConnectionState
): string {
  switch (state) {
    case 'new':
      return 'New';

    case 'connecting':
      return 'Connecting…';

    case 'connected':
      return 'Connected';

    case 'disconnected':
      return 'Disconnected';

    case 'failed':
      return 'Connection failed';

    case 'closed':
      return 'Closed';

    default:
      return '';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Grid
// ─────────────────────────────────────────────────────────────────────────────

interface VideoGridProps {
  participants: GridParticipant[];
}

export default function VideoGrid({
  participants,
}: VideoGridProps) {
  if (participants.length === 0) {
    return (
      <div
        style={{
          width: '100%',
          minHeight: 300,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#999',
        }}
      >
        No participants
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'grid',
        gap: 8,
        width: '100%',
        gridTemplateColumns:
          'repeat(auto-fit, minmax(280px, 1fr))',
        alignItems: 'stretch',
      }}
    >
      {participants.map((participant) => (
        <VideoTile
          key={participant.userId}
          participant={participant}
        />
      ))}
    </div>
  );
}
