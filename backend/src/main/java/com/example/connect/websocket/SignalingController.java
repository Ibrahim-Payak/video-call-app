package com.example.connect.websocket;

// websocket/SignalingController.java — placeholder

import com.example.connect.dto.request.SignalingMessage;
import com.example.connect.entity.Participant;
import com.example.connect.event.UserDisconnectedEvent;
import com.example.connect.service.ParticipantSessionService;
import com.example.connect.service.RoomService;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.stereotype.Controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Controller;

import java.util.List;
import java.util.Map;

/**
 * Entry point for all client → server signaling messages.
 * Clients send to /app/signaling (destination prefix /app configured in WebSocketConfig).
 * Server replies via SimpMessagingTemplate:
 *   - to a specific user: /topic/room/{roomId}/{userId}   (per-user queue)
 *   - broadcast:          /topic/room/{roomId}            (whole room)
 */
@Controller
public class SignalingController {

    private static final Logger log = LoggerFactory.getLogger(SignalingController.class);

    private final RoomService roomService;
    private final ParticipantSessionService participantSessionService;
    private final SimpMessagingTemplate messagingTemplate;


    public SignalingController(RoomService roomService,
                               ParticipantSessionService participantSessionService,
                               SimpMessagingTemplate messagingTemplate) {
        this.roomService = roomService;
        this.participantSessionService = participantSessionService;
        this.messagingTemplate = messagingTemplate;
    }

    /**
     * Handles all signaling message types. Routing by message type:
     * USER_JOIN → validate room, register participant, reply ROOM_STATE, broadcast USER_JOINED.
     * LEAVE (type USER_LEFT from client) → remove participant, broadcast USER_LEFT.
     * OFFER / ANSWER / ICE_CANDIDATE → validated relay to the target participant (WebRTC, next chunk).
     */
    @MessageMapping("/signaling")
    public void handleSignaling(@Payload SignalingMessage message, SimpMessageHeaderAccessor headerAccessor) {
        switch (message.getType()) {
            case USER_JOIN -> handleUserJoin(message, headerAccessor);
            case USER_LEFT -> handleUserLeave(message, headerAccessor);
            case OFFER, ANSWER, ICE_CANDIDATE -> relayPeerMessage(message, headerAccessor);
            default -> log.warn("Unsupported message type: {}", message.getType());
        }
    }

    /** Join flow: validate room → register → send existing participants → broadcast join. */
    private void handleUserJoin(SignalingMessage message, SimpMessageHeaderAccessor headerAccessor) {
        String roomCode = message.getRoomId(); // roomCode travels in roomId field from the client
        log.info("USER_JOIN received: room={} user={} name={}", roomCode, message.getFrom(), message.getSenderName());

        // 1. Validate the room exists
        if (!roomService.roomExists(roomCode)) {
            log.warn("USER_JOIN rejected: room not found: {}", roomCode);
            sendError(headerAccessor, "Room not found: " + roomCode);
            return;
        }

        String sessionId = headerAccessor.getSessionId();
        Participant participant = new Participant(
                message.getFrom(), message.getSenderName(), roomCode, sessionId);

        // 2. Register participant (reject duplicate userId in the same room)
        if (!participantSessionService.addParticipant(participant)) {
            log.warn("USER_JOIN rejected: user {} already in room {}", participant.getUserId(), roomCode);
            return;
        }
        WebSocketSessionInterceptor.attachParticipant(headerAccessor, participant);

        // 3. Send existing participants to the new user (personal topic)
        List<Participant> existing =
                participantSessionService.getParticipants(roomCode).stream()
                        .filter(p -> !p.getUserId().equals(participant.getUserId()))
                        .toList();
        sendToUser(roomCode, participant.getUserId(),
                SignalingMessageFactory.roomState(roomCode, participant.getUserId(), existing));
        log.info("ROOM_STATE sent: room={} → user={} existingParticipants={}",
                roomCode, participant.getUserId(), existing.size());

        // 4. Broadcast USER_JOINED to everyone in the room
        broadcast(roomCode, SignalingMessageFactory.userJoined(roomCode, participant));
        log.info("USER_JOINED broadcast: room={} user={} name={} totalInRoom={}",
                roomCode, participant.getUserId(), participant.getDisplayName(),
                existing.size() + 1);
    }

    /** Leave flow (explicit LEAVE from client): remove and broadcast. */
    private void handleUserLeave(SignalingMessage message, SimpMessageHeaderAccessor headerAccessor) {
        String sessionId = headerAccessor.getSessionId();
        participantSessionService.findBySessionId(sessionId).ifPresent(participant -> {
            participantSessionService.removeParticipant(participant.getRoomId(), participant.getUserId());
            log.info("USER_LEFT (explicit) room={} user={} name={}",
                    participant.getRoomId(), participant.getUserId(), participant.getDisplayName());
            broadcastUserLeft(participant);
        });
    }

    /**
     * Security check + relay for WebRTC messages:
     * the sender must be a registered participant of the room, and
     * the target must be in the SAME room. Cross-room signaling is rejected.
     */
    private void relayPeerMessage(SignalingMessage message, SimpMessageHeaderAccessor headerAccessor) {
        String sessionId = headerAccessor.getSessionId();
        var senderOpt = participantSessionService.findBySessionId(sessionId);

        if (senderOpt.isEmpty()) {
            log.warn("Relay rejected: sender has no active participant session (sessionId={})", sessionId);
            return;
        }
        Participant sender = senderOpt.get();

        // sender's room must match the message's room
        if (!sender.getRoomId().equals(message.getRoomId())) {
            log.warn("Relay rejected: sender room {} != message room {}", sender.getRoomId(), message.getRoomId());
            return;
        }

        // target must exist and be in the same room — no cross-room signaling
//        Map<String, Participant> check = Map.of(); // placeholder to keep structure clear
        boolean targetInSameRoom =
                participantSessionService.getParticipants(sender.getRoomId()).stream()
                        .anyMatch(p -> p.getUserId().equals(message.getTo()));

        if (!targetInSameRoom) {
            log.warn("Relay rejected: target {} not in room {}", message.getTo(), sender.getRoomId());
            return;
        }

        // strip sender identity and stamp it server-side (client cannot spoof 'from')
        SignalingMessage outbound = SignalingMessage.builder()
                .type(message.getType())
                .roomId(sender.getRoomId())
                .from(sender.getUserId())
                .to(message.getTo())
                .senderName(sender.getDisplayName())
                .payload(message.getPayload())
                .build();

        sendToUser(sender.getRoomId(), message.getTo(), outbound);
        log.debug("Relayed {} room={} from={} to={}",
                message.getType(), sender.getRoomId(), sender.getUserId(), message.getTo());
    }

    /** Broadcasts USER_LEFT to all remaining room members; called by the disconnect interceptor too. */
    private void broadcastUserLeft(Participant participant) {
        SignalingMessage message =
                SignalingMessageFactory.userLeft(
                        participant.getRoomId(),
                        participant
                );

        messagingTemplate.convertAndSend(
                "/topic/room/" + participant.getRoomId(),
                message
        );
    }



    /** Sends a message to one specific participant inside a room's topic. */
    private void sendToUser(String roomId, String userId, SignalingMessage message) {
        messagingTemplate.convertAndSend("/topic/room/" + roomId + "/" + userId, message);
    }

    /** Broadcasts a message to every subscriber of the room topic. */
    private void broadcast(String roomId, SignalingMessage message) {
        messagingTemplate.convertAndSend("/topic/room/" + roomId, message);
    }

    /** Sends an error message to the specific session's personal topic. */
    private void sendError(SimpMessageHeaderAccessor headerAccessor, String text) {
        String sessionId = headerAccessor.getSessionId();
        SignalingMessage error = SignalingMessage.builder()
                .type(SignalingMessage.Type.ROOM_STATE)
                .payload(Map.of("error", text))
                .build();
        messagingTemplate.convertAndSend("/topic/session/" + sessionId, error);
    }

    @EventListener
    public void handleUserDisconnected(
            UserDisconnectedEvent event) {

        Participant participant = event.participant();

        log.info(
                "Broadcasting USER_LEFT after disconnect: room={} user={}",
                participant.getRoomId(),
                participant.getUserId()
        );

        broadcastUserLeft(participant);
    }

}

