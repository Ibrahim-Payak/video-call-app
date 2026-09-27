package com.example.connect.websocket;


import com.example.connect.dto.request.ParticipantPayload;
import com.example.connect.dto.request.SignalingMessage;
import com.example.connect.entity.Participant;

import java.util.List;

/**
 * Factory that builds server → client signaling messages.
 * Keeps message construction rules in one place.
 */
public final class SignalingMessageFactory {

    private SignalingMessageFactory() {}

    /** ROOM_STATE — sent to the joining user with everyone already in the room. */
    public static SignalingMessage roomState(String roomId, String toUserId, List<Participant> participants) {
        List<ParticipantPayload> payload = participants.stream()
                .map(p -> new ParticipantPayload(p.getUserId(), p.getDisplayName()))
                .toList();
        return SignalingMessage.builder()
                .type(SignalingMessage.Type.ROOM_STATE)
                .roomId(roomId)
                .to(toUserId)
                .payload(payload)
                .build();
    }

    /** USER_JOINED — broadcast to the room about a newly joined participant. */
    public static SignalingMessage userJoined(String roomId, Participant participant) {
        return SignalingMessage.builder()
                .type(SignalingMessage.Type.USER_JOINED)
                .roomId(roomId)
                .from(participant.getUserId())
                .senderName(participant.getDisplayName())
                .payload(new ParticipantPayload(participant.getUserId(), participant.getDisplayName()))
                .build();
    }

    /** USER_LEFT — broadcast to the room when someone leaves/disconnects. */
    public static SignalingMessage userLeft(String roomId, Participant participant) {
        return SignalingMessage.builder()
                .type(SignalingMessage.Type.USER_LEFT)
                .roomId(roomId)
                .from(participant.getUserId())
                .senderName(participant.getDisplayName())
                .payload(new ParticipantPayload(participant.getUserId(), participant.getDisplayName()))
                .build();
    }
}
