package com.example.connect.service;

// service/RoomService.java — placeholder

import com.example.connect.entity.Room;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;


/**
 * Room lifecycle operations. Interface allows swapping
 * the in-memory implementation for a persistent one later.
 */
@Service
public interface RoomService {
    /** Creates a new room with a unique short room code. */
    Room createRoom();

    /** Finds a room by its (case-insensitive) room code, or throws RoomNotFoundException. */
    Room getRoomByCode(String roomCode);

    /** Checks whether a room exists for the given code. */
    boolean roomExists(String roomCode);
}

