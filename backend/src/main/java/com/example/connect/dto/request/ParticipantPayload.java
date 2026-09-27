package com.example.connect.dto.request;

import lombok.AllArgsConstructor;
import lombok.Getter;

/** Small DTO embedded in message payloads describing a participant. */
@Getter
@AllArgsConstructor
public class ParticipantPayload {
    private String userId;
    private String displayName;
}

