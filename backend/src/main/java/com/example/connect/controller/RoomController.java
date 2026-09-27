package com.example.connect.controller;

import com.example.connect.dto.response.CreateRoomResponse;
import com.example.connect.dto.response.RoomResponse;
import com.example.connect.entity.Room;
import com.example.connect.exception.RoomNotFoundException;
import com.example.connect.service.InMemoryRoomService;
import com.example.connect.service.RoomService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.JsonNode;

@RestController
@RequestMapping("/api/rooms")
@CrossOrigin(origins = "http://localhost:5174")
public class RoomController {

    private final InMemoryRoomService roomService;

    public RoomController(InMemoryRoomService roomService) {
        this.roomService = roomService;
    }

    @PostMapping
    public ResponseEntity<CreateRoomResponse> createRoom() {
        Room room = roomService.createRoom();
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(new CreateRoomResponse(room.getRoomId(), room.getRoomCode()));
    }

    @GetMapping("/{roomCode}")
    public ResponseEntity<RoomResponse> getRoom(@PathVariable String roomCode) {
        try {
            Room room = roomService.getRoomByCode(roomCode);
            return ResponseEntity.ok(
                    new RoomResponse(room.getRoomId(), room.getRoomCode(), room.getCreatedAt()));
        } catch (RoomNotFoundException e) {
            return ResponseEntity.notFound().build();
        }
    }
}

