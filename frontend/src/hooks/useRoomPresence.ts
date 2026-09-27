import { useEffect, useRef, useState, useCallback } from 'react';
import type { Client } from '@stomp/stompjs';
import { subscribeTopic, sendSignaling } from '../services/signaling';
import type { ParticipantInfo, SignalingMessage } from '../types/signal';

export interface RoomPresenceCallbacks {
  /** Fired once when the server sends ROOM_STATE (list of people already in the room). */
  onRoomState?: (existingPeers: ParticipantInfo[]) => void;
}

export interface RoomPresenceResult {
  participants: ParticipantInfo[];
  connected: boolean;
  myUserId: string;
  /** Explicit leave: sends USER_LEFT and disconnects. */
  leave: () => void;
}

/**
 * Presence hook: connects (client must already be activated by the caller),
 * subscribes to room + personal topics, sends USER_JOIN, and keeps the
 * participant list in sync via ROOM_STATE / USER_JOINED / USER_LEFT.
 */
export function useRoomPresence(
  client: Client | null,
  roomCode: string,
  displayName: string,
  callbacks?: RoomPresenceCallbacks
): RoomPresenceResult {
  const [participants, setParticipants] = useState<ParticipantInfo[]>([]);
  const [connected, setConnected] = useState(false);
  const myUserIdRef = useRef(crypto.randomUUID());
  const myUserId = myUserIdRef.current;
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

  useEffect(() => {
    if (!client) return;
  
    const unsubscribeFns: (() => void)[] = [];
  
    client.onConnect = () => {
      setConnected(true);
  
      // Personal queue: ROOM_STATE, relayed WebRTC messages, errors
      const personalSubscription = subscribeTopic(
        client,
        `/topic/room/roomCode/${roomCode}/roomCode/${myUserId}`,
        handlePersonal
      );
  
      unsubscribeFns.push(() => personalSubscription.unsubscribe());
  
      // Room broadcast: USER_JOINED / USER_LEFT
      const broadcastSubscription = subscribeTopic(
        client,
        `/topic/room/${roomCode}`,
        handleBroadcast
      );
  
      unsubscribeFns.push(() => broadcastSubscription.unsubscribe());
  
      // Announce myself
      sendSignaling(client, {
        type: 'USER_JOIN',
        roomId: roomCode,
        from: myUserId,
        senderName: displayName,
      });
    };
  
    client.activate();
  
    function handlePersonal(msg: SignalingMessage) {
      if (msg.type === 'ROOM_STATE') {
        const list = (msg.payload as ParticipantInfo[]) ?? [];
        setParticipants(list);
        cbRef.current?.onRoomState?.(list);
      }
    }
  
    function handleBroadcast(msg: SignalingMessage) {
      if (msg.type === 'USER_JOINED') {
        const p = msg.payload as ParticipantInfo;
  
        if (p && p.userId !== myUserId) {
          setParticipants((prev) =>
            prev.some((x) => x.userId === p.userId)
              ? prev
              : [...prev, p]
          );
        }
      } else if (msg.type === 'USER_LEFT') {
        const p = msg.payload as ParticipantInfo;
  
        if (p) {
          setParticipants((prev) =>
            prev.filter((x) => x.userId !== p.userId)
          );
        }
      }
    }
  
    return () => {
      unsubscribeFns.forEach((unsubscribe) => unsubscribe());
  
      if (client.connected) {
        sendSignaling(client, {
          type: 'USER_LEFT',
          roomId: roomCode,
          from: myUserId,
        });
      }
  
      setConnected(false);
    };
  }, [client, roomCode, displayName, myUserId]);
  

  const leave = () => {
    if (client?.connected) {
      sendSignaling(client, { type: 'USER_LEFT', roomId: roomCode, from: myUserId });
    }
    setParticipants([]);
  };

  return { participants, connected, myUserId, leave };
}
