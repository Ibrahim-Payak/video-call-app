import type { SignalingMessage } from '../hooks/useSignaling';

export type PeerConnectionState =
  | 'new'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'failed'
  | 'closed';

export interface PeerConnectionCallbacks {
  onRemoteStream?: (stream: MediaStream) => void;
  onConnectionStateChange?: (state: PeerConnectionState) => void;
}

type SignalingSend = (message: Partial<SignalingMessage>) => void;

const ICE_SERVERS: RTCIceServer[] = [
  {
    urls: 'stun:stun.l.google.com:19302',
  },

  // Add TURN in production:
  //
  // {
  //   urls: 'turn:turn.example.com:3478',
  //   username: 'username',
  //   credential: 'password',
  // },
];

export class PeerConnectionService {
  private readonly peerId: string;
  private readonly send: SignalingSend;

  private pc: RTCPeerConnection | null = null;

remoteStream: MediaStream = new MediaStream();

  private pendingCandidates: RTCIceCandidateInit[] = [];

  private remoteDescriptionSet = false;

  private makingOffer = false;

  private failTimeout: ReturnType<typeof setTimeout> | null = null;

  private onRemoteStreamCallback:
    | ((stream: MediaStream) => void)
    | undefined;

  private onConnectionStateChangeCallback:
    | ((state: PeerConnectionState) => void)
    | undefined;

  constructor(peerId: string, send: SignalingSend) {
    this.peerId = peerId;
    this.send = send;

    this.createConnection();
  }

  // ─────────────────────────────────────────────────────────────────────
  // Event registration
  // ─────────────────────────────────────────────────────────────────────

  onRemoteStream(
    callback: (stream: MediaStream) => void
  ): void {
    this.onRemoteStreamCallback = callback;

    // If the stream already contains tracks, immediately notify the caller.
    if (this.remoteStream.getTracks().length > 0) {
      callback(this.remoteStream);
    }
  }

  onStateChange(
    callback: (state: PeerConnectionState) => void
  ): void {
    this.onConnectionStateChangeCallback = callback;

    if (this.pc) {
      callback(this.mapConnectionState(this.pc.connectionState));
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // Connection creation
  // ─────────────────────────────────────────────────────────────────────

  private createConnection(): void {
    this.clearFailTimeout();

    this.remoteStream = new MediaStream();
    this.pendingCandidates = [];
    this.remoteDescriptionSet = false;
    this.makingOffer = false;

    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
    });

    this.pc = pc;

    // ── Remote media ──────────────────────────────────────────────────

    pc.ontrack = (event) => {
      const streams = event.streams;

      if (streams.length > 0) {
        const incomingStream = streams[0];

        incomingStream.getTracks().forEach((track) => {
          const alreadyExists = this.remoteStream
            .getTracks()
            .some((existingTrack) => existingTrack.id === track.id);

          if (!alreadyExists) {
            this.remoteStream.addTrack(track);
          }
        });
      } else {
        // Some browsers may provide a track without event.streams.
        const alreadyExists = this.remoteStream
          .getTracks()
          .some((track) => track.id === event.track.id);

        if (!alreadyExists) {
          this.remoteStream.addTrack(event.track);
        }
      }

      this.onRemoteStreamCallback?.(this.remoteStream);
    };

    // ── Local ICE candidates ───────────────────────────────────────────

    pc.onicecandidate = (event) => {
      if (!event.candidate) {
        return;
      }

      this.send({
        type: 'ICE_CANDIDATE',
        to: this.peerId,
        candidate: event.candidate.toJSON(),
      });
    };

    // ── Connection state ──────────────────────────────────────────────

    pc.onconnectionstatechange = () => {
      const state = this.mapConnectionState(pc.connectionState);

      this.onConnectionStateChangeCallback?.(state);

      if (state === 'connected') {
        this.clearFailTimeout();
      }

      if (state === 'failed') {
        this.clearFailTimeout();
      }
    };

    // ── ICE connection state ──────────────────────────────────────────

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;

      if (state === 'connected' || state === 'completed') {
        this.clearFailTimeout();
        return;
      }

      if (state === 'disconnected') {
        this.clearFailTimeout();

        this.failTimeout = setTimeout(() => {
          if (
            this.pc === pc &&
            pc.iceConnectionState === 'disconnected'
          ) {
            this.onConnectionStateChangeCallback?.('failed');
          }
        }, 5000);

        return;
      }

      if (state === 'failed') {
        this.clearFailTimeout();
        this.onConnectionStateChangeCallback?.('failed');
      }
    };

    // ── ICE errors ────────────────────────────────────────────────────

    pc.onicecandidateerror = (event) => {
      console.warn(
        '[PeerConnectionService] ICE candidate error',
        event
      );
    };
  }

  private mapConnectionState(
    state: RTCPeerConnectionState
  ): PeerConnectionState {
    switch (state) {
      case 'new':
        return 'new';

      case 'connecting':
        return 'connecting';

      case 'connected':
        return 'connected';

      case 'disconnected':
        return 'disconnected';

      case 'failed':
        return 'failed';

      case 'closed':
        return 'closed';

      default:
        return 'new';
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // Local media
  // ─────────────────────────────────────────────────────────────────────

  addLocalStream(stream: MediaStream): void {
    const pc = this.getPeerConnection();

    stream.getTracks().forEach((track) => {
      const sender = pc
        .getSenders()
        .find((existingSender) => existingSender.track?.kind === track.kind);

      if (sender) {
        void sender.replaceTrack(track);
      } else {
        pc.addTrack(track, stream);
      }
    });
  }

  async replaceOutgoingVideoTrack(
    track: MediaStreamTrack | null
  ): Promise<void> {
    const pc = this.getPeerConnection();

    const sender = pc
      .getSenders()
      .find((existingSender) => existingSender.track?.kind === 'video');

    if (sender) {
      await sender.replaceTrack(track);
      return;
    }

    if (track) {
      // No video sender exists yet.
      //
      // Use a small stream containing the video track. Do NOT use
      // remoteStream here because this is an outgoing track.
      const stream = new MediaStream([track]);

      pc.addTrack(track, stream);
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // Offer / answer
  // ─────────────────────────────────────────────────────────────────────

  async createOffer(): Promise<void> {
    const pc = this.getPeerConnection();

    if (this.makingOffer) {
      return;
    }

    this.makingOffer = true;

    try {
      const offer = await pc.createOffer();

      await pc.setLocalDescription(offer);

      if (!pc.localDescription) {
        throw new Error(
          'Local description was not created'
        );
      }

      this.send({
        type: 'OFFER',
        to: this.peerId,
        sdp: pc.localDescription.toJSON(),
      });
    } finally {
      this.makingOffer = false;
    }
  }

  async createAnswer(): Promise<void> {
    const pc = this.getPeerConnection();

    const answer = await pc.createAnswer();

    await pc.setLocalDescription(answer);

    if (!pc.localDescription) {
      throw new Error(
        'Local description was not created'
      );
    }

    this.send({
      type: 'ANSWER',
      to: this.peerId,
      sdp: pc.localDescription.toJSON(),
    });
  }

  // ─────────────────────────────────────────────────────────────────────
  // Incoming offer / answer
  // ─────────────────────────────────────────────────────────────────────

  async handleOffer(
    description: RTCSessionDescriptionInit
  ): Promise<void> {
    const pc = this.getPeerConnection();

    await this.setRemoteDescription(description);

    await this.createAnswer();
  }

  async handleAnswer(
    description: RTCSessionDescriptionInit
  ): Promise<void> {
    await this.setRemoteDescription(description);
  }

  async setRemoteDescription(
    description: RTCSessionDescriptionInit
  ): Promise<void> {
    const pc = this.getPeerConnection();

    await pc.setRemoteDescription(description);

    this.remoteDescriptionSet = true;

    await this.flushPendingCandidates();
  }

  // ─────────────────────────────────────────────────────────────────────
  // Remote ICE candidates
  // ─────────────────────────────────────────────────────────────────────

  async addIceCandidate(
    candidate: RTCIceCandidateInit
  ): Promise<void> {
    const pc = this.getPeerConnection();

    if (!this.remoteDescriptionSet || !pc.remoteDescription) {
      this.pendingCandidates.push(candidate);
      return;
    }

    try {
      await pc.addIceCandidate(candidate);
    } catch (error) {
      console.warn(
        '[PeerConnectionService] failed to add ICE candidate',
        error
      );
    }
  }

  private async flushPendingCandidates(): Promise<void> {
    const pc = this.getPeerConnection();

    if (!pc.remoteDescription) {
      return;
    }

    const candidates = [...this.pendingCandidates];

    this.pendingCandidates = [];

    for (const candidate of candidates) {
      try {
        await pc.addIceCandidate(candidate);
      } catch (error) {
        console.warn(
          '[PeerConnectionService] failed to apply buffered ICE candidate',
          error
        );
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // Teardown
  // ─────────────────────────────────────────────────────────────────────

  closeConnection(): void {
    this.clearFailTimeout();

    if (this.pc) {
      this.pc.ontrack = null;
      this.pc.onicecandidate = null;
      this.pc.onconnectionstatechange = null;
      this.pc.oniceconnectionstatechange = null;
      this.pc.onicecandidateerror = null;

      this.pc.close();
      this.pc = null;
    }

    this.pendingCandidates = [];
    this.remoteDescriptionSet = false;
    this.makingOffer = false;

    this.remoteStream.getTracks().forEach((track) => {
      track.stop();
    });

    this.remoteStream = new MediaStream();

    this.onRemoteStreamCallback = undefined;
    this.onConnectionStateChangeCallback = undefined;
  }

  // ─────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────

  private getPeerConnection(): RTCPeerConnection {
    if (!this.pc) {
      throw new Error(
        `PeerConnection for ${this.peerId} is closed`
      );
    }

    return this.pc;
  }

  private clearFailTimeout(): void {
    if (this.failTimeout) {
      clearTimeout(this.failTimeout);
      this.failTimeout = null;
    }
  }
}
