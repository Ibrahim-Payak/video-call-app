package com.example.connect.service;


import com.example.connect.entity.Participant;
import tools.jackson.databind.JsonNode;

import java.util.List;
import java.util.Optional;

/**
 * Tracks which participants are in which room, and maps
 * WebSocket session ids ↔ participants (needed for disconnect handling).
 */
public interface ParticipantSessionService {

    /** Adds a participant to a room. Returns false if the userId already exists in the room. */
    boolean addParticipant(Participant participant);

    /** Removes a participant from a room. Returns the removed participant, if present. */
    Optional<Participant> removeParticipant(String roomId, String userId);

    /** Finds a participant by WebSocket session id (used on disconnect). */
    Optional<Participant> findBySessionId(String sessionId);

    /** Removes a participant by WebSocket session id (disconnect cleanup). */
    Optional<Participant> removeBySessionId(String sessionId);

    /** All participants currently in the given room. */
    List<Participant> getParticipants(String roomId);

    void transformPartnerData(JsonNode partner);
}

