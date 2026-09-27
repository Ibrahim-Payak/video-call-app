export type SignalMessageType =
  | 'USER_JOIN'
  | 'USER_JOINED'
  | 'USER_LEFT'
  | 'ROOM_STATE'
  | 'OFFER'
  | 'ANSWER'
  | 'ICE_CANDIDATE';

export interface ParticipantInfo {
  userId: string;
  displayName: string;
}

export interface SignalingMessage {
  type: SignalMessageType;
  roomId: string;
  from?: string;
  to?: string;
  senderName?: string;
  payload?: unknown;
}
