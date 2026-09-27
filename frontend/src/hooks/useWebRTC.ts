import { useCallback, useEffect, useRef, useState } from 'react';
import { PeerConnectionService } from '../webrtc/PeerConnectionService';
import type { PeerConnectionState } from '../webrtc/PeerConnectionService';
import { useSignaling } from './useSignaling';

interface UseWebRTCOptions {
  roomId: string;
  userId: string;
}

export interface UseWebRTCResult {
  services: Map<string, PeerConnectionService>;
  peerStates: Map<string, PeerConnectionState>;
  registerLocalStream: (stream: MediaStream) => void;
  toggleLocalAudio: (enabled: boolean) => void;
  toggleLocalVideo: (enabled: boolean) => void;
  startScreenShare: () => Promise<void>;
  stopScreenShare: () => void;
  isSharing: boolean;
  sharingUserId: string | null;
  leaveCall: () => void;
}

export function useWebRTC({
  roomId,
  userId,
}: UseWebRTCOptions): UseWebRTCResult {
  const { on, send, connected } = useSignaling({
    roomId,
    userId,
  });

  const servicesRef = useRef<Map<string, PeerConnectionService>>(new Map());

  const [services, setServices] = useState<
    Map<string, PeerConnectionService>
  >(new Map());

  const [peerStates, setPeerStates] = useState<
    Map<string, PeerConnectionState>
  >(new Map());

  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  const [isSharing, setIsSharing] = useState(false);
  const [sharingUserId, setSharingUserId] = useState<string | null>(null);

  // ─────────────────────────────────────────────────────────────────────
  // Local media
  // ─────────────────────────────────────────────────────────────────────

  const registerLocalStream = useCallback((stream: MediaStream) => {
    localStreamRef.current = stream;

    // Attach the stream to peers that already exist.
    servicesRef.current.forEach((service) => {
      service.addLocalStream(stream);
    });
  }, []);

  const toggleLocalAudio = useCallback((enabled: boolean) => {
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = enabled;
    });
  }, []);

  const toggleLocalVideo = useCallback((enabled: boolean) => {
    localStreamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = enabled;
    });
  }, []);

  // ─────────────────────────────────────────────────────────────────────
  // Peer state
  // ─────────────────────────────────────────────────────────────────────

  const updatePeerState = useCallback(
    (peerId: string, state: PeerConnectionState) => {
      setPeerStates((previous) => {
        const next = new Map(previous);
        next.set(peerId, state);
        return next;
      });
    },
    []
  );

  // ─────────────────────────────────────────────────────────────────────
  // Create/remove peer connections
  // ─────────────────────────────────────────────────────────────────────

  const createService = useCallback(
    (peerId: string): PeerConnectionService => {
      const existing = servicesRef.current.get(peerId);

      if (existing) {
        return existing;
      }

      const service = new PeerConnectionService(peerId, send);

      service.onStateChange((state) => {
        updatePeerState(peerId, state);

        if (state === 'failed') {
          service.closeConnection();

          servicesRef.current.delete(peerId);

          setServices(new Map(servicesRef.current));

          setPeerStates((previous) => {
            const next = new Map(previous);
            next.delete(peerId);
            return next;
          });
        }
      });

      service.onRemoteStream(() => {
        // Force VideoGrid/components consuming `services` to re-render.
        setServices(new Map(servicesRef.current));
      });

      // If the local camera/mic already exists, attach it immediately.
      if (localStreamRef.current) {
        service.addLocalStream(localStreamRef.current);
      }

      servicesRef.current.set(peerId, service);

      setServices(new Map(servicesRef.current));
      updatePeerState(peerId, 'connecting');

      return service;
    },
    [send, updatePeerState]
  );

  const removeService = useCallback((peerId: string) => {
    const service = servicesRef.current.get(peerId);

    if (service) {
      service.closeConnection();
      servicesRef.current.delete(peerId);
    }

    setServices(new Map(servicesRef.current));

    setPeerStates((previous) => {
      const next = new Map(previous);
      next.delete(peerId);
      return next;
    });
  }, []);

  // ─────────────────────────────────────────────────────────────────────
  // Screen sharing
  // ─────────────────────────────────────────────────────────────────────

  const stopScreenShare = useCallback(() => {
    const screenStream = screenStreamRef.current;

    if (!screenStream) {
      return;
    }

    screenStream.getTracks().forEach((track) => {
      track.stop();
    });

    screenStreamRef.current = null;

    setIsSharing(false);

    setSharingUserId((currentUserId) => {
      if (currentUserId === userId) {
        return null;
      }

      return currentUserId;
    });

    send({
      type: 'SCREEN_SHARE_STOPPED',
    });

    // Restore the camera track.
    const cameraTrack =
      localStreamRef.current?.getVideoTracks()[0] ?? null;

    void Promise.all(
      Array.from(servicesRef.current.values()).map((service) =>
        service.replaceOutgoingVideoTrack(cameraTrack)
      )
    ).catch((error) => {
      console.error(
        '[useWebRTC] failed to restore camera track',
        error
      );
    });
  }, [send, userId]);

  const startScreenShare = useCallback(async () => {
    if (screenStreamRef.current) {
      return;
    }

    try {
      const screenStream =
        await navigator.mediaDevices.getDisplayMedia({
          video: {
            frameRate: {
              ideal: 15,
            },
          },
          audio: false,
        });

      const screenTrack = screenStream.getVideoTracks()[0];

      if (!screenTrack) {
        screenStream.getTracks().forEach((track) => track.stop());
        return;
      }

      screenStreamRef.current = screenStream;

      setIsSharing(true);
      setSharingUserId(userId);

      send({
        type: 'SCREEN_SHARE_STARTED',
      });

      // Replace camera video with the screen video on every peer.
      await Promise.all(
        Array.from(servicesRef.current.values()).map((service) =>
          service.replaceOutgoingVideoTrack(screenTrack)
        )
      );

      // Handles the browser's built-in "Stop sharing" button.
      screenTrack.addEventListener('ended', () => {
        stopScreenShare();
      });
    } catch (error) {
      console.error(
        '[useWebRTC] getDisplayMedia failed',
        error
      );
    }
  }, [send, stopScreenShare, userId]);

  // ─────────────────────────────────────────────────────────────────────
  // Signaling message handlers
  // ─────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!connected) {
      return;
    }

    const offJoin = on('USER_JOIN', (payload) => {
      const peerId = payload.userId;

      if (!peerId || peerId === userId) {
        return;
      }

      // Existing peer creates the offer.
      const service = createService(peerId);

      void service.createOffer().catch((error) => {
        console.error(
          '[useWebRTC] failed to create offer',
          error
        );
      });
    });

    const offOffer = on('OFFER', (payload) => {
      const peerId = payload.from;
      const sdp = payload.sdp;

      if (!peerId || !sdp || peerId === userId) {
        return;
      }

      const service = createService(peerId);

      void service.handleOffer(sdp).catch((error) => {
        console.error(
          '[useWebRTC] failed to handle offer',
          error
        );
      });
    });

    const offAnswer = on('ANSWER', (payload) => {
      const peerId = payload.from;
      const sdp = payload.sdp;

      if (!peerId || !sdp || peerId === userId) {
        return;
      }

      const service = servicesRef.current.get(peerId);

      if (!service) {
        return;
      }

      void service.handleAnswer(sdp).catch((error) => {
        console.error(
          '[useWebRTC] failed to handle answer',
          error
        );
      });
    });

    const offCandidate = on('ICE_CANDIDATE', (payload) => {
      const peerId = payload.from;
      const candidate = payload.candidate;

      if (!peerId || !candidate || peerId === userId) {
        return;
      }

      const service = servicesRef.current.get(peerId);

      if (!service) {
        return;
      }

      void service.addIceCandidate(candidate).catch((error) => {
        console.error(
          '[useWebRTC] failed to add ICE candidate',
          error
        );
      });
    });

    const offLeave = on('USER_LEAVE', (payload) => {
      const peerId = payload.userId;

      if (!peerId || peerId === userId) {
        return;
      }

      removeService(peerId);

      setSharingUserId((currentUserId) =>
        currentUserId === peerId ? null : currentUserId
      );
    });

    const offShareStart = on('SCREEN_SHARE_STARTED', (payload) => {
      const peerId = payload.from;

      if (!peerId || peerId === userId) {
        return;
      }

      setSharingUserId(peerId);
    });

    const offShareStop = on('SCREEN_SHARE_STOPPED', (payload) => {
      const peerId = payload.from;

      if (!peerId) {
        return;
      }

      setSharingUserId((currentUserId) =>
        currentUserId === peerId ? null : currentUserId
      );
    });

    return () => {
      offJoin();
      offOffer();
      offAnswer();
      offCandidate();
      offLeave();
      offShareStart();
      offShareStop();
    };
  }, [
    connected,
    createService,
    on,
    removeService,
    userId,
  ]);

  // ─────────────────────────────────────────────────────────────────────
  // Leave / cleanup
  // ─────────────────────────────────────────────────────────────────────

  const leaveCall = useCallback(() => {
    // Tell other participants that we are leaving.
    send({
      type: 'USER_LEAVE',
      userId,
    });

    servicesRef.current.forEach((service) => {
      service.closeConnection();
    });

    servicesRef.current.clear();

    setServices(new Map());
    setPeerStates(new Map());

    screenStreamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });

    screenStreamRef.current = null;

    setIsSharing(false);
    setSharingUserId(null);

    localStreamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });

    localStreamRef.current = null;
  }, [send, userId]);

  useEffect(() => {
    return () => {
      // Don't call setState during unmount.
      servicesRef.current.forEach((service) => {
        service.closeConnection();
      });

      servicesRef.current.clear();

      screenStreamRef.current?.getTracks().forEach((track) => {
        track.stop();
      });

      screenStreamRef.current = null;

      localStreamRef.current?.getTracks().forEach((track) => {
        track.stop();
      });

      localStreamRef.current = null;
    };
  }, []);

  return {
    services,
    peerStates,
    registerLocalStream,
    toggleLocalAudio,
    toggleLocalVideo,
    startScreenShare,
    stopScreenShare,
    isSharing,
    sharingUserId,
    leaveCall,
  };
}
