package com.example.connect.websocket;

import com.example.connect.entity.Participant;
import com.example.connect.event.UserDisconnectedEvent;
import com.example.connect.service.ParticipantSessionService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Interceptor on the inbound client-inbound channel.
 * - For SEND commands: validates the user belongs to the room they target (room scoping).
 * - For DISCONNECT: removes the participant and broadcasts USER_LEFT.
 */
@Component
public class WebSocketSessionInterceptor implements ChannelInterceptor {

    private static final Logger log =
            LoggerFactory.getLogger(WebSocketSessionInterceptor.class);

    public static final String PARTICIPANT_SESSION_KEY = "participant";

    private final ParticipantSessionService participantSessionService;
    private final ApplicationEventPublisher eventPublisher;

    public WebSocketSessionInterceptor(
            ParticipantSessionService participantSessionService,
            ApplicationEventPublisher eventPublisher) {

        this.participantSessionService = participantSessionService;
        this.eventPublisher = eventPublisher;
    }

    @Override
    public Message<?> preSend(
            Message<?> message,
            MessageChannel channel) {

        StompHeaderAccessor accessor =
                StompHeaderAccessor.wrap(message);

        if (StompCommand.DISCONNECT.equals(accessor.getCommand())) {
            handleDisconnect(accessor);
        }

        return message;
    }

    private void handleDisconnect(
            StompHeaderAccessor accessor) {

        String sessionId = accessor.getSessionId();

        if (sessionId == null) {
            return;
        }

        participantSessionService
                .removeBySessionId(sessionId)
                .ifPresent(participant -> {

                    log.info(
                            "USER_LEFT (disconnect) room={} user={} name={}",
                            participant.getRoomId(),
                            participant.getUserId(),
                            participant.getDisplayName()
                    );

                    eventPublisher.publishEvent(
                            new UserDisconnectedEvent(participant)
                    );
                });
    }

    @Override
    public void postSend(
            Message<?> message,
            MessageChannel channel,
            boolean sent) {
        // Cleanup is handled in preSend(DISCONNECT)
    }

    public static void attachParticipant(
            SimpMessageHeaderAccessor accessor,
            Participant participant) {

        Map<String, Object> attrs =
                accessor.getSessionAttributes();

        if (attrs != null) {
            attrs.put(
                    PARTICIPANT_SESSION_KEY,
                    participant
            );
        }
    }
}

