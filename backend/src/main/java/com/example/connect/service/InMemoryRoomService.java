package com.example.connect.service;

import com.example.connect.entity.Room;
import com.example.connect.exception.RoomNotFoundException;
import com.example.connect.repo.RoomRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

import java.security.SecureRandom;
import java.util.UUID;


/** In-memory RoomService — rooms live in a ConcurrentHashMap and vanish on restart. */
@Service
public class InMemoryRoomService implements RoomService {

    @Autowired
    ObjectMapper objectMapper;

    private static final Logger log = LoggerFactory.getLogger(InMemoryRoomService.class);
    private static final String CODE_CHARACTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final int CODE_LENGTH = 6;
    private static final int MAX_GENERATION_ATTEMPTS = 10;

    private final RoomRepository roomRepository;
    private final SecureRandom random = new SecureRandom();

    public InMemoryRoomService(RoomRepository roomRepository) {
        this.roomRepository = roomRepository;
    }

    @Override
    public Room createRoom() {
        String roomCode = generateUniqueRoomCode();
        Room room = new Room(UUID.randomUUID().toString(), roomCode);
        roomRepository.save(room);
        log.info("Room created: code={} id={}", roomCode, room.getRoomId());
        return room;
    }

    @Override
    public Room getRoomByCode(String roomCode) {
        return roomRepository.findByRoomCode(normalize(roomCode))
                .orElseThrow(() -> new RoomNotFoundException(roomCode));
    }

    @Override
    public boolean roomExists(String roomCode) {
        return roomRepository.existsByRoomCode(normalize(roomCode));
    }

    private String generateUniqueRoomCode() {
        for (int i = 0; i < MAX_GENERATION_ATTEMPTS; i++) {
            String code = generateRandomCode();
            if (!roomRepository.existsByRoomCode(code)) {
                return code;
            }
        }
        throw new IllegalStateException("Could not generate a unique room code");
    }

    private String generateRandomCode() {
        StringBuilder sb = new StringBuilder(CODE_LENGTH);
        for (int i = 0; i < CODE_LENGTH; i++) {
            sb.append(CODE_CHARACTERS.charAt(random.nextInt(CODE_CHARACTERS.length())));
        }
        return sb.toString();
    }

    private String normalize(String roomCode) {
        return roomCode == null ? "" : roomCode.trim().toUpperCase();
    }
}
