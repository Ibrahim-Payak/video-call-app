import { useCallback, useEffect, useRef, useState } from 'react';

/** Shape of every message exchanged over the wire. */
export interface SignalingMessage {
  type:
    | 'USER_JOIN'
    | 'USER_LEAVE'
    | 'OFFER'
    | 'ANSWER'
    | 'ICE_CANDIDATE'
    | 'SCREEN_SHARE_STARTED'
    | 'SCREEN_SHARE_STOPPED';
  from?: string;
  userId?: string;
  to?: string;
  roomId?: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  [key: string]: unknown;
}

interface UseSignalingOptions {
  roomId: string;
  userId: string;
}

export interface UseSignalingResult {
  /** True once the socket is open AND the room has been joined. */
  connected: boolean;

  /**
   * Subscribe to a signaling event.
   * Returns an unsubscribe function.
   */
  on: (
    event: SignalingMessage['type'],
    handler: (payload: SignalingMessage) => void
  ) => () => void;

  /** Send a message upstream to the WebSocket server. */
  send: (message: Partial<SignalingMessage>) => void;
}

/**
 * Manages the single WebSocket connection for the call:
 * - connect → join room
 * - expose on()/send() helpers for useWebRTC
 * - auto-reconnect with exponential backoff
 */
export function useSignaling({
  roomId,
  userId,
}: UseSignalingOptions): UseSignalingResult {
  const socketRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);

  // Keep subscriptions across renders.
  const handlersRef = useRef<
    Map<
      SignalingMessage['type'],
      Set<(payload: SignalingMessage) => void>
    >
  >(new Map());

  // Reconnect bookkeeping.
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closedByUserRef = useRef(false);

  // Register a handler.
  const on = useCallback(
    (
      event: SignalingMessage['type'],
      handler: (payload: SignalingMessage) => void
    ) => {
      let handlers = handlersRef.current.get(event);

      if (!handlers) {
        handlers = new Set();
        handlersRef.current.set(event, handlers);
      }

      handlers.add(handler);

      return () => {
        handlers!.delete(handler);

        if (handlers!.size === 0) {
          handlersRef.current.delete(event);
        }
      };
    },
    []
  );

  // Send a message upstream.
  const send = useCallback(
    (message: Partial<SignalingMessage>) => {
      const socket = socketRef.current;

      if (!socket || socket.readyState !== WebSocket.OPEN) {
        console.warn(
          '[useSignaling] send skipped — socket not open',
          message.type
        );
        return;
      }

      socket.send(
        JSON.stringify({
          ...message,
          from: userId,
          roomId,
        })
      );
    },
    [userId, roomId]
  );

  // Connect / reconnect lifecycle.
  useEffect(() => {
    closedByUserRef.current = false;

    const connect = () => {
      // Vite environment variable.
      const signalingUrl =
        (import.meta.env.VITE_SIGNALING_URL as string | undefined) ??
        'ws://localhost:3001';

      const url = new URL(signalingUrl);

      url.searchParams.set('roomId', roomId);
      url.searchParams.set('userId', userId);

      const socket = new WebSocket(url.toString());
      socketRef.current = socket;

      socket.onopen = () => {
        reconnectAttemptRef.current = 0;

        // Announce presence.
        socket.send(
          JSON.stringify({
            type: 'USER_JOIN',
            userId,
            roomId,
          })
        );

        setConnected(true);
      };

      socket.onmessage = (event) => {
        let msg: SignalingMessage;

        try {
          msg = JSON.parse(event.data as string);
        } catch {
          console.warn(
            '[useSignaling] unparseable message',
            event.data
          );
          return;
        }

        const handlers = handlersRef.current.get(msg.type);

        if (!handlers) return;

        handlers.forEach((handler) => {
          try {
            handler(msg);
          } catch (error) {
            console.error(
              `[useSignaling] handler for ${msg.type} threw`,
              error
            );
          }
        });
      };

      socket.onclose = () => {
        setConnected(false);

        if (socketRef.current === socket) {
          socketRef.current = null;
        }

        if (closedByUserRef.current) {
          return;
        }

        // Exponential backoff: 1s, 2s, 4s, ... capped at 10s.
        const attempt = reconnectAttemptRef.current++;
        const delay = Math.min(1000 * 2 ** attempt, 10_000);

        console.warn(
          `[useSignaling] closed — reconnecting in ${delay}ms`
        );

        reconnectTimerRef.current = setTimeout(() => {
          reconnectTimerRef.current = null;
          connect();
        }, delay);
      };

      socket.onerror = (error) => {
        console.error('[useSignaling] socket error', error);
        // onclose handles reconnection.
      };
    };

    connect();

    return () => {
      closedByUserRef.current = true;

      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      socketRef.current?.close();
      socketRef.current = null;

      setConnected(false);
    };
  }, [roomId, userId]);

  return {
    connected,
    on,
    send,
  };
}
