package com.example.connect.repo;

import com.example.connect.entity.Room;
import org.springframework.stereotype.Repository;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;



import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Repository
public class RoomRepository {

    private final Map<String, Room> roomsByCode = new ConcurrentHashMap<>();

    public Room save(Room room) {
        roomsByCode.put(room.getRoomCode(), room);
        return room;
    }

    public Optional<Room> findByRoomCode(String roomCode) {
        return Optional.ofNullable(roomsByCode.get(roomCode));
    }

    public boolean existsByRoomCode(String roomCode) {
        return roomsByCode.containsKey(roomCode);
    }
}

