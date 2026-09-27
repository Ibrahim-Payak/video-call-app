package com.example.connect.dto.response;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.time.Instant;

@Getter
@AllArgsConstructor
public class RoomResponse {
    private String roomId;
    private String roomCode;
    private Instant createdAt;
}

