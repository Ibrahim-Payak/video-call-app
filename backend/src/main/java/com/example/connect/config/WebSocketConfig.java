package com.example.connect.config;


import com.example.connect.websocket.WebSocketSessionInterceptor;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final WebSocketSessionInterceptor webSocketSessionInterceptor;

    public WebSocketConfig(WebSocketSessionInterceptor webSocketSessionInterceptor) {
        this.webSocketSessionInterceptor = webSocketSessionInterceptor;
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // Frontend connects here via SockJS/WebSocket
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("http://localhost:5174")
                .withSockJS();
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        // Prefixes used in later signaling chunks
        registry.setApplicationDestinationPrefixes("/app");
        registry.enableSimpleBroker("/topic");
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        // Interceptor handles DISCONNECT cleanup on the inbound channel
        registration.interceptors(webSocketSessionInterceptor);
    }
}
