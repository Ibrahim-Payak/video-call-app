import type { SignalingMessage } from '../types/signal';

const DEFAULT_STUN = 'stun:stun.l.google.com:19302';

export interface WebRTCServiceOptions {
  /** Sends a signaling message to the remote peer via WebSocket */
  sendSignal: (msg: SignalingMessage) => void;
  roomId: string;
  localUserId: string;
  remoteUserId: string;
}

export type ConnectionState =
  | 'new'
  | 'connecting'
  | 'connected'
  | 'failed'
  | 'closed';

/**
 * WebRTCService — manages one peer-to-peer connection to one remote user.
 *
 * Responsibilities:
 *  - create/close the RTCPeerConnection
 *  - add local tracks
 *  - create/send OFFER and ANSWER
 *  - exchange ICE candidates
 *  - expose the remote MediaStream via callback
 *
 * Media NEVER passes through the server — only SDP and ICE via sendSignal().
 */
export class WebRTCService {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private readonly opts: WebRTCServiceOptions;

  /** Called whenever the remote stream is received/updated */
  onRemoteStream: ((stream: MediaStream) => void) | null = null;
  /** Called when the ICE connection state changes */
  onConnectionStateChange: ((state: ConnectionState) => void) | null = null;

  constructor(options: WebRTCServiceOptions) {
    this.opts = options;
  }

  /** Builds the RTCPeerConnection with STUN, adds local tracks, wires event handlers. */
  createConnection(localStream: MediaStream): void {
    if (this.pc) return; // already created

    this.localStream = localStream;

    const stunServer = import.meta.env.VITE_STUN_SERVER || DEFAULT_STUN;
    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: stunServer }],
    });

    // 1. Add all local tracks (audio + video) to the connection
    localStream.getTracks().forEach((track) => {
      this.pc!.addTrack(track, localStream);
    });

    // 2. When remote tracks arrive, assemble and expose the remote stream
    this.pc.ontrack = (event) => {
      // event.streams[0] is the remote peer's MediaStream
      const remoteStream = event.streams[0];
      if (remoteStream && this.onRemoteStream) {
        this.onRemoteStream(remoteStream);
      }
    };

    // 3. Local ICE candidates → send to the remote peer via signaling
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.opts.sendSignal({
          type: 'ICE_CANDIDATE',
          roomId: this.opts.roomId,
          from: this.opts.localUserId,
          to: this.opts.remoteUserId,
          payload: event.candidate.toJSON(),
        });
      }
    };

    // 4. Connection state reporting
    this.pc.onconnectionstatechange = () => {
      if (this.onConnectionStateChange && this.pc) {
        this.onConnectionStateChange(this.pc.connectionState as ConnectionState);
      }
    };
  }

     /**
   * Screen sharing: swap the outgoing video track on sender WITHOUT
   * renegotiation. The camera track object stays alive so we can swap back.
   */
  async replaceVideoTrack(newTrack: MediaStreamTrack): Promise<void> {
    if (!this.pc) throw new Error('Connection not created');
    const videoSender = this.pc.getSenders().find((s) => s.track?.kind === 'video');
    if (videoSender) {
      await videoSender.replaceTrack(newTrack);
    } else {
      // Edge case: no video was negotiated — fall back to addTrack (rare with camera on)
      this.pc.addTrack(newTrack, thisStream ?? new MediaStream());
    }
  }


  /** Caller side: create + set local offer, send OFFER to the remote peer. */
  async createOffer(): Promise<void> {
    if (!this.pc) throw new Error('Connection not created');
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    this.opts.sendSignal({
      type: 'OFFER',
      roomId: this.opts.roomId,
      from: this.opts.localUserId,
      to: this.opts.remoteUserId,
      payload: { sdp: this.pc.localDescription!.sdp, type: this.pc.localDescription!.type },
    });
  }

  /** Callee side: apply the received OFFER, create + set answer, send ANSWER back. */
  async handleOffer(sdp: { type: RTCSdpType; sdp: string }): Promise<void> {
    if (!this.pc) throw new Error('Connection not created');
    await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    this.opts.sendSignal({
      type: 'ANSWER',
      roomId: this.opts.roomId,
      from: this.opts.localUserId,
      to: this.opts.remoteUserId,
      payload: { sdp: this.pc.localDescription!.sdp, type: this.pc.localDescription!.type },
    });
  }

  /** Caller side: apply the received ANSWER to complete SDP negotiation. */
  async handleAnswer(sdp: { type: RTCSdpType; sdp: string }): Promise<void> {
    if (!this.pc) throw new Error('Connection not created');
    await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
  }

  /** Apply a remote ICE candidate (the other browser's network address). */
  async handleIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.pc) throw new Error('Connection not created');
    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.error('Failed to add ICE candidate', err);
    }
  }

  /** Full teardown: close the peer connection and drop references. */
    /** Full teardown: close the peer connection. Does NOT stop local tracks —
   *  the local stream is owned by useLocalMedia, which cleans it up. */
    closeConnection(): void {
        this.pc?.close();
        this.pc = null;
        this.onRemoteStream = null;
        this.onConnectionStateChange = null;
      }

        /** Reconnection: closes the broken PC and rebuilds it with the same local stream.
   *  Only called by the pair's initiator (deterministic rule). */
  restart(): void {
    this.pc?.close();
    this.pc = null;
    if (this.localStream) {
      this.createConnection(this.localStream);
      void this.createOffer();
    }
  }

    
}
