package com.example.connect.event;

import com.example.connect.entity.Participant;

public record UserDisconnectedEvent(Participant participant) {
}

