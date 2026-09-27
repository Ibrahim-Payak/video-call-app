import '../CallControls.css';

interface CallControlsProps {
  isMicEnabled: boolean;
  isCameraEnabled: boolean;
  isScreenSharing: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  onLeave: () => void;
}

/** Bottom control bar. Pure presentation — all behavior is injected. */
export default function CallControls({
  isMicEnabled, isCameraEnabled, isScreenSharing,
  onToggleMic, onToggleCamera, onToggleScreenShare, onLeave,
}: CallControlsProps) {
  return (
    <div className="call-controls">
      <button
        className={`control-btn ${isMicEnabled ? 'control-on' : 'control-off'}`}
        onClick={onToggleMic}
        title={isMicEnabled ? 'Mute microphone' : 'Unmute microphone'}
      >
        {isMicEnabled ? '🎤' : '🔇'}
      </button>

      <button
        className={`control-btn ${isCameraEnabled ? 'control-on' : 'control-off'}`}
        onClick={onToggleCamera}
        title={isCameraEnabled ? 'Turn camera off' : 'Turn camera on'}
      >
        {isCameraEnabled ? '📹' : '🚫'}
      </button>

      <button
        className={`control-btn ${isScreenSharing ? 'control-active' : 'control-on'}`}
        onClick={onToggleScreenShare}
        title={isScreenSharing ? 'Stop screen share' : 'Share your screen'}
      >
        {isScreenSharing ? '🛑' : '🖥️'}
      </button>

      <button className="control-btn control-leave" onClick={onLeave} title="Leave call">
        📞 Leave
      </button>
    </div>
  );
}
