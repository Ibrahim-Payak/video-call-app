import type { MediaError } from '../hooks/useLocalMedia';

export default function MediaErrorBanner({ error, onRetry }: { error: MediaError; onRetry: () => void }) {
  return (
    <div className="media-error-banner" role="alert">
      <span>⚠️ {error.message}</span>
      {error.kind === 'PERMISSION_DENIED' && (
        <button className="btn-secondary" onClick={onRetry}>Retry</button>
      )}
    </div>
  );
}
