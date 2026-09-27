import { useCallback, useEffect, useRef, useState } from 'react';

export type MediaErrorKind =
  | 'PERMISSION_DENIED'
  | 'NOT_READABLE'
  | 'NO_DEVICES'
  | 'UNKNOWN';

export interface MediaError {
  kind: MediaErrorKind;
  /** User-facing message — render this directly. */
  message: string;
  /** Which device class failed: both | video | audio */
  missing: 'both' | 'video' | 'audio';
}

export interface UseLocalMediaResult {
  localStream: MediaStream | null;
  isMicEnabled: boolean;
  isCameraEnabled: boolean;
  mediaError: MediaError | null;
  retry: () => void;
  toggleMic: () => void;
  toggleCamera: () => void;
  getCameraTrack: () => MediaStreamTrack | null;
  getMicTrack: () => MediaStreamTrack | null;
  stopAll: () => void;
}

function translateMediaError(err: DOMException): MediaError {
  switch (err.name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return {
        kind: 'PERMISSION_DENIED',
        missing: 'both',
        message:
          'Camera and microphone access was blocked. ' +
          'Click the lock/camera icon in your browser\'s address bar, ' +
          'allow access, then retry.',
      };

    case 'NotReadableError':
    case 'TrackStartError':
      return {
        kind: 'NOT_READABLE',
        missing: 'both',
        message:
          'Your camera or microphone is being used by another application. ' +
          'Close other apps (Zoom, Teams, OBS…) and try again.',
      };

    case 'NotFoundError':
      return {
        kind: 'NO_DEVICES',
        missing: 'both',
        message:
          'No camera or microphone was found. Connect a device and retry.',
      };

    case 'OverconstrainedError':
      return {
        kind: 'NO_DEVICES',
        missing: 'both',
        message: 'The requested camera or microphone was not found.',
      };

    default:
      return {
        kind: 'UNKNOWN',
        missing: 'both',
        message: err.message
          ? `Media error: ${err.message}`
          : 'Unable to access your camera or microphone.',
      };
  }
}

function isDomException(err: unknown): err is DOMException {
  return (
    err instanceof DOMException ||
    (typeof err === 'object' &&
      err !== null &&
      'name' in err &&
      typeof (err as { name?: unknown }).name === 'string')
  );
}

/**
 * Captures local camera + microphone.
 *
 * Behavior:
 * - Tries camera + microphone first.
 * - If one device class is missing, falls back to the other.
 * - Permission/readability errors are reported directly.
 * - Supports retry after the user fixes the problem.
 * - Detects video track ending/disconnection.
 */
export function useLocalMedia(): UseLocalMediaResult {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [mediaError, setMediaError] = useState<MediaError | null>(null);

  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);

  const streamRef = useRef<MediaStream | null>(null);
  const [attempt, setAttempt] = useState(0);

  const stopStream = useCallback((stream: MediaStream | null) => {
    stream?.getTracks().forEach((track) => {
      track.stop();
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let stopWatch: ReturnType<typeof setInterval> | null = null;

    const mediaDevices = navigator.mediaDevices;

    if (!mediaDevices?.getUserMedia) {
      setMediaError({
        kind: 'UNKNOWN',
        missing: 'both',
        message:
          'Camera and microphone access is not supported by this browser.',
      });

      return () => {
        cancelled = true;
      };
    }

    async function capture() {
      // Clear the previous stream before retrying.
      stopStream(streamRef.current);
      streamRef.current = null;

      setLocalStream(null);
      setMediaError(null);

      try {
        // First attempt: camera + microphone.
        stream = await mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
      } catch (firstError: unknown) {
        if (cancelled) return;

        const error = isDomException(firstError)
          ? firstError
          : new DOMException('Unable to access media devices.');

        /*
         * Only degrade when the browser reports that a requested
         * device does not exist.
         *
         * Do NOT fall back on NotAllowedError or NotReadableError,
         * because those indicate permission/device-access problems.
         */
        if (error.name !== 'NotFoundError') {
          setMediaError(translateMediaError(error));
          return;
        }

        // Try camera only.
        try {
          stream = await mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });

          if (!cancelled) {
            setMediaError({
              kind: 'NO_DEVICES',
              missing: 'audio',
              message:
                'No microphone found — you can watch and chat, but not speak.',
            });
          }
        } catch {
          if (cancelled) return;

          // Try microphone only.
          try {
            stream = await mediaDevices.getUserMedia({
              video: false,
              audio: true,
            });

            if (!cancelled) {
              setMediaError({
                kind: 'NO_DEVICES',
                missing: 'video',
                message:
                  'No camera found — you can hear and speak, but not be seen.',
              });
            }
          } catch (finalError: unknown) {
            if (cancelled) return;

            const translated = isDomException(finalError)
              ? translateMediaError(finalError)
              : {
                  kind: 'UNKNOWN' as const,
                  missing: 'both' as const,
                  message: 'Unable to access your camera or microphone.',
                };

            setMediaError(translated);
            return;
          }
        }
      }

      if (!stream || cancelled) {
        stopStream(stream);
        return;
      }

      streamRef.current = stream;
      setLocalStream(stream);

      const audioTrack = stream.getAudioTracks()[0];
      const videoTrack = stream.getVideoTracks()[0];

      setIsMicEnabled(audioTrack?.enabled ?? false);
      setIsCameraEnabled(videoTrack?.enabled ?? false);

      /*
       * Detect devices being disconnected while the stream is active.
       *
       * `track.onended` is the primary mechanism. The interval is only
       * a best-effort fallback for browsers/OS combinations where the
       * ended event is unreliable.
       */
    //   const videoTrack = stream.getVideoTracks()[0];

      if (videoTrack) {
        videoTrack.addEventListener('ended', handleVideoEnded);
      }

      let lastVideoCount: number | null = null;

      try {
        const devices = await mediaDevices.enumerateDevices();
        lastVideoCount = devices.filter(
          (device) => device.kind === 'videoinput',
        ).length;
      } catch {
        // enumerateDevices may fail or be restricted; ignore it.
      }

      stopWatch = setInterval(async () => {
        if (cancelled) return;

        try {
          const devices = await mediaDevices.enumerateDevices();

          const videoCount = devices.filter(
            (device) => device.kind === 'videoinput',
          ).length;

          if (
            lastVideoCount !== null &&
            videoCount < lastVideoCount &&
            videoTrack?.readyState === 'ended'
          ) {
            setMediaError({
              kind: 'NO_DEVICES',
              missing: 'video',
              message:
                'Your camera was disconnected. Reconnect it and retry.',
            });

            setIsCameraEnabled(false);
          }

          lastVideoCount = videoCount;
        } catch {
          // Best-effort check; don't turn enumeration failures into UI errors.
        }
      }, 5000);
    }

    function handleVideoEnded() {
      if (cancelled) return;

      setIsCameraEnabled(false);

      setMediaError({
        kind: 'NO_DEVICES',
        missing: 'video',
        message: 'Your camera stopped working or was disconnected.',
      });
    }

    void capture();

    return () => {
      cancelled = true;

      if (stopWatch) {
        clearInterval(stopWatch);
      }

      const videoTrack = stream?.getVideoTracks()[0];

      if (videoTrack) {
        videoTrack.removeEventListener('ended', handleVideoEnded);
      }

      stopStream(stream);

      if (streamRef.current === stream) {
        streamRef.current = null;
      }
    };
  }, [attempt, stopStream]);

  const retry = useCallback(() => {
    setAttempt((value) => value + 1);
  }, []);

  const toggleMic = useCallback(() => {
    const stream = streamRef.current;

    if (!stream) return;

    const tracks = stream.getAudioTracks();

    if (tracks.length === 0) return;

    const nextEnabled = !tracks[0].enabled;

    tracks.forEach((track) => {
      track.enabled = nextEnabled;
    });

    setIsMicEnabled(nextEnabled);
  }, []);

  const toggleCamera = useCallback(() => {
    const stream = streamRef.current;

    if (!stream) return;

    const tracks = stream.getVideoTracks();

    if (tracks.length === 0) return;

    const nextEnabled = !tracks[0].enabled;

    tracks.forEach((track) => {
      track.enabled = nextEnabled;
    });

    setIsCameraEnabled(nextEnabled);
  }, []);

  const getCameraTrack = useCallback((): MediaStreamTrack | null => {
    return streamRef.current?.getVideoTracks()[0] ?? null;
  }, []);

  const getMicTrack = useCallback((): MediaStreamTrack | null => {
    return streamRef.current?.getAudioTracks()[0] ?? null;
  }, []);

  const stopAll = useCallback(() => {
    const stream = streamRef.current;

    if (!stream) return;

    stream.getTracks().forEach((track) => {
      track.stop();
    });

    streamRef.current = null;
    setLocalStream(null);
    setIsMicEnabled(false);
    setIsCameraEnabled(false);
  }, []);

  return {
    localStream,
    isMicEnabled,
    isCameraEnabled,
    mediaError,
    retry,
    toggleMic,
    toggleCamera,
    getCameraTrack,
    getMicTrack,
    stopAll,
  };
}
