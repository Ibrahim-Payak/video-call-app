import { useState } from 'react';
import { createSignalingClient, attachStatusListeners, type WsStatus } from '../services/signaling';
import type { Client } from '@stomp/stompjs';

/** Owns the client + its status label. One client per call, one owner. */
export function useSignalingClient(): { client: Client; status: WsStatus } {
  const [client] = useState<Client>(() => {
    const c = createSignalingClient();
    c.reconnectDelay = 3000;   // auto-reconnect forever, 3s backoff
    attachStatusListeners(c, setStatus);
    return c;
  });
  const [status, setStatus] = useState<WsStatus>('connecting');
  return { client, status };
}
