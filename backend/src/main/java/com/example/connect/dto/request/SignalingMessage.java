package com.example.connect.dto.request;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Generic envelope for ALL signaling messages (both directions).
 * 'payload' holds a type-specific object (e.g. participant list,
 * SDP offer/answer, ICE candidate) — it is decoded by the receiver
 * based on 'type'.
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class SignalingMessage {

    public enum Type {
        USER_JOIN,
        USER_JOINED,
        USER_LEFT,
        ROOM_STATE,
        OFFER,
        ANSWER,
        ICE_CANDIDATE
    }

    private Type type;
    private String roomId;
    /** userId of the sender (client → server) or the event subject (server → client) */
    private String from;
    /** userId of the intended recipient; null = broadcast to the room */
    private String to;
    private String senderName;
    /** type-specific payload (Map or nested object) */
    private Object payload;
}
