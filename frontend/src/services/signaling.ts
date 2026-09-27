import { Client, type StompSubscription, type IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import type { SignalingMessage } from '../types/signal';
import { config } from '../config';

// const WS_URL = 'http://localhost:8080/ws';
const WS_URL = config.wsUrl;

export type WsStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

/** Creates a STOMP client over SockJS (not yet activated). */
export function createSignalingClient(): Client {
  return new Client({
    webSocketFactory: () => new SockJS(WS_URL) as unknown as WebSocket,
    reconnectDelay: 3000,
    onStompError: (frame) => console.error('[WS] STOMP error', frame.headers),
  });
}

/** Subscribes to one topic; returns the subscription for later unsubscribe. */
export function subscribeTopic(
  client: Client,
  topic: string,
  onMessage: (msg: SignalingMessage) => void
): StompSubscription {
  return client.subscribe(topic, (frame: IMessage) =>
    onMessage(JSON.parse(frame.body) as SignalingMessage)
  );
}

/** Publishes a signaling message to the server's /app/signaling endpoint. */
export function sendSignaling(client: Client, message: SignalingMessage): void {
  client.publish({ destination: '/app/signaling', body: JSON.stringify(message) });
}


export function attachStatusListeners(
    client: Client,
    onStatus: (s: WsStatus) => void
  ): void {
    client.onConnect = () => onStatus('connected');
    client.onWebSocketClose = (evt) =>
      // wasConnectAttempted + not intentional → STOMP will retry
      onStatus(evt.wasClean && !client.connected ? 'disconnected' : 'connecting');
    client.onWebSocketError = () => onStatus('connecting');
  }