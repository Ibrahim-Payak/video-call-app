import { useCallback, useEffect, useRef, useState } from 'react';

interface DevicePreviewProps {
  /** Called when the user clicks Join — CallRoom re-acquires media and joins. */
  onJoin: () => void;
  /** Label for the join button. */
  joinLabel: string;
}

interface MediaDeviceInfoLite {
  deviceId: string;
  label: string;
}

export default function DevicePreview({ onJoin, joinLabel }: DevicePreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewStreamRef = useRef<MediaStream | null>(null);

  const [cameras, setCameras] = useState<MediaDeviceInfoLite[]>([]);
  const [microphones, setMicrophones] = useState<MediaDeviceInfoLite[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [selectedMicId, setSelectedMicId] = useState<string>('');
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  // ── Start (or restart) the preview with the selected devices ──────────

  const startPreview = useCallback(async (cameraId?: string, micId?: string) => {
    setStarting(true);
    setError(null);
    try {
      // Stop any previous preview tracks before re-acquiring
      previewStreamRef.current?.getTracks().forEach((t) => t.stop());

      const stream = await navigator.mediaDevices.getUserMedia({
        video: cameraId
          ? { deviceId: { exact: cameraId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : true,
        audio: micId
          ? { deviceId: { exact: micId }, echoCancellation: true, noiseSuppression: true }
          : { echoCancellation: true, noiseSuppression: true },
      });

      previewStreamRef.current = stream;

      // Honor current mute toggles
      stream.getVideoTracks().forEach((t) => (t.enabled = cameraEnabled));
      stream.getAudioTracks().forEach((t) => (t.enabled = micEnabled));

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // ── Populate device lists (labels are available after permission) ──
      const devices = await navigator.mediaDevices.enumerateDevices();
      const camList = devices
        .filter((d) => d.kind === 'videoinput')
        .map((d) => ({ deviceId: d.deviceId, label: d.label || `Camera ${d.deviceId.slice(0, 5)}` }));
      const micList = devices
        .filter((d) => d.kind === 'audioinput')
        .map((d) => ({ deviceId: d.deviceId, label: d.label || `Microphone ${d.deviceId.slice(0, 5)}` }));

      setCameras(camList);
      setMicrophones(micList);

      // Auto-select the active device if the user hasn't picked one
      const activeCam = stream.getVideoTracks()[0]?.getSettings().deviceId;
      const activeMic = stream.getAudioTracks()[0]?.getSettings().deviceId;
      setSelectedCameraId((prev) => prev || cameraId || activeCam || camList[0]?.deviceId || '');
      setSelectedMicId((prev) => prev || micId || activeMic || micList[0]?.deviceId || '');
    } catch (e) {
      console.error('[DevicePreview] getUserMedia failed', e);
      const name = (e as DOMException).name;
      setError(
        name === 'NotAllowedError'
          ? 'Camera/microphone permission denied. Please allow access and retry.'
          : name === 'NotFoundError'
          ? 'No camera or microphone found.'
          : 'Failed to start camera/microphone.'
      );
    } finally {
      setStarting(false);
    }
  }, [cameraEnabled, micEnabled]);

  // ── Initial start + device-plug/unplug handling ───────────────────────

  useEffect(() => {
    void startPreview();

    const handleDeviceChange = () => {
      // Re-enumerate; if the active device disappeared, fall back to default
      void startPreview(selectedCameraId || undefined, selectedMicId || undefined);
    };
    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);

    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
      previewStreamRef.current?.getTracks().forEach((t) => t.stop());
      previewStreamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Device switching (restart preview with the newly chosen device) ───

  const handleCameraChange = (deviceId: string) => {
    setSelectedCameraId(deviceId);
    void startPreview(deviceId, selectedMicId || undefined);
  };

  const handleMicChange = (deviceId: string) => {
    setSelectedMicId(deviceId);
    void startPreview(selectedCameraId || undefined, deviceId);
  };

  // ── Mute toggles (no re-acquisition needed) ───────────────────────────

  const toggleCamera = () => {
    const next = !cameraEnabled;
    setCameraEnabled(next);
    previewStreamRef.current?.getVideoTracks().forEach((t) => (t.enabled = next));
  };

  const toggleMic = () => {
    const next = !micEnabled;
    setMicEnabled(next);
    previewStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = next));
  };

  // ── Join: stop the preview stream; CallRoom re-acquires for the call ──

  const handleJoinClick = () => {
    previewStreamRef.current?.getTracks().forEach((t) => t.stop());
    previewStreamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    onJoin();
  };

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="device-preview" style={{ maxWidth: 640, margin: '0 auto', padding: 16 }}>
      <h2>Ready to join?</h2>

      <div
        style={{
          position: 'relative',
          background: '#000',
          borderRadius: 8,
          aspectRatio: '16 / 9',
          overflow: 'hidden',
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
        />
        {!cameraEnabled && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 14,
            }}
          >
            📷 Camera off
          </div>
        )}
        {starting && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
            }}
          >
            Starting camera…
          </div>
        )}
      </div>

      {error && (
        <p style={{ color: '#e5484d', marginTop: 8 }}>
          {error}{' '}
          <button onClick={() => void startPreview(selectedCameraId || undefined, selectedMicId || undefined)}>
            Retry
          </button>
        </p>
      )}

      {/* ── Device pickers ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
        <label>
          Camera
          <select
            value={selectedCameraId}
            onChange={(e) => handleCameraChange(e.target.value)}
            disabled={cameras.length === 0}
            style={{ width: '100%', marginTop: 4 }}
          >
            {cameras.map((cam) => (
              <option key={cam.deviceId} value={cam.deviceId}>
                {cam.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Microphone
          <select
            value={selectedMicId}
            onChange={(e) => handleMicChange(e.target.value)}
            disabled={microphones.length === 0}
            style={{ width: '100%', marginTop: 4 }}
          >
            {microphones.map((mic) => (
              <option key={mic.deviceId} value={mic.deviceId}>
                {mic.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* ── Controls ── */}
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button onClick={toggleCamera}>{cameraEnabled ? '📷 Camera on' : '📷 Camera off'}</button>
        <button onClick={toggleMic}>{micEnabled ? '🎙️ Mic on' : '🎙️ Mic muted'}</button>
      </div>

      <button
        onClick={handleJoinClick}
        disabled={starting || !!error}
        style={{ marginTop: 16, width: '100%', padding: 12, fontSize: 16 }}
      >
        {joinLabel}
      </button>
    </div>
  );
}
