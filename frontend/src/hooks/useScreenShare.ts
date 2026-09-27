import { useCallback, useEffect, useRef, useState } from 'react';

interface UseScreenShareOptions {
  /** Replace the outgoing video track on all peer connections. */
  replaceOutgoingVideoTrack: (track: MediaStreamTrack | null) => Promise<void>;
  /** The camera track to restore when sharing ends. */
  getCameraTrack: () => MediaStreamTrack | null;
}

export interface UseScreenShareResult {
  isScreenSharing: boolean;
  /** Stream to preview locally (your own screen). */
  screenStream: MediaStream | null;
  toggleScreenShare: () => Promise<void>;
  /** Full cleanup — called on leave. */
  stopSharing: () => Promise<void>;
}

/**
 * Screen-share facade:
 *  start → getDisplayMedia → replaceTrack(screen) on all peers
 *  stop  → replaceTrack(camera) → stop screen tracks
 * Also handles sharing stopped from the browser's own "Stop sharing" bar.
 */
export function useScreenShare(options: UseScreenShareOptions): UseScreenShareResult {
  const { replaceOutgoingVideoTrack, getCameraTrack } = options;

  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  /** Stops the screen capture and restores the camera track to all peers. */
  const stopSharing = useCallback(async () => {
    if (!screenStreamRef.current) return;
    screenStreamRef.current.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    setScreenStream(null);
    setIsScreenSharing(false);
    // Restore camera track to every peer connection
    const camera = getCameraTrack();
    if (camera) await replaceOutgoingVideoTrack(camera);
  }, [getCameraTrack, replaceOutgoingVideoTrack]);

  const startSharing = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      screenStreamRef.current = stream;
      setScreenStream(stream);
      setIsScreenSharing(true);
      const screenTrack = stream.getVideoTracks()[0];

      // Browser's built-in "Stop sharing" button fires 'ended' — treat like our own stop
      screenTrack.addEventListener('ended', () => { void stopSharing(); });

      await replaceOutgoingVideoTrack(screenTrack);
    } catch (err) {
      // User cancelled the browser picker — not an error
      console.info('Screen share cancelled or failed', err);
    }
  }, [replaceOutgoingVideoTrack, stopSharing]);

  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) await stopSharing();
    else await startSharing();
  }, [isScreenSharing, startSharing, stopSharing]);

  // Safety net: if the component unmounts while sharing, stop capture
  useEffect(() => () => {
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  return { isScreenSharing, screenStream, toggleScreenShare, stopSharing };
}
