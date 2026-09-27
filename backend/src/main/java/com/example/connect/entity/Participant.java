package com.example.connect.entity;

import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * A participant currently connected inside a room.
 * userId is a client-generated UUID; sessionId is the WebSocket session id.
 */
@Getter
@AllArgsConstructor
public class Participant {

    private final String userId;
    private final String displayName;
    private final String roomId;
    private final String sessionId;
}

