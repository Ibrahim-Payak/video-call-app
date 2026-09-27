package com.example.connect.entity;

import lombok.Getter;

import java.time.Instant;

@Getter
public class Room {

    private final String roomId;
    private final String roomCode;
    private final Instant createdAt;

    public Room(String roomId, String roomCode) {
        this.roomId = roomId;
        this.roomCode = roomCode;
        this.createdAt = Instant.now();
    }
}

