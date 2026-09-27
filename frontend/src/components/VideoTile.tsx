import { useEffect, useRef } from 'react';

export interface VideoTileProps {
  stream: MediaStream | null;
  userId: string;
  isLocal?: boolean;
  label?: string;
  muted?: boolean;
  isSharing?: boolean;
}

export function VideoTile({
  stream,
  userId,
  isLocal = false,
  label,
  muted,
  isSharing = false,
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

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
      // Autoplay may be blocked by the browser.
    });
  }, [stream]);

  const displayLabel =
    label ??
    (isLocal ? 'You' : userId);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: isSharing
          ? '16 / 9'
          : '4 / 3',
        background: '#000',
        borderRadius: 8,
        overflow: 'hidden',
        gridColumn: isSharing
          ? '1 / -1'
          : undefined,
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted ?? isLocal}
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

      {/* No video / waiting state */}
      {!stream && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#1f1f1f',
            color: '#fff',
            fontSize: 14,
          }}
        >
          {getInitials(userId)}
        </div>
      )}

      {/* Label */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          padding: '6px 8px',
          background: 'rgba(0, 0, 0, 0.55)',
          color: '#fff',
          fontSize: 12,
        }}
      >
        {displayLabel}
      </div>
    </div>
  );
}

function getInitials(userId: string): string {
  const value = userId.trim();

  if (!value) {
    return '?';
  }

  const parts = value.split(/\s+/);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return value.slice(0, 2).toUpperCase();
}
