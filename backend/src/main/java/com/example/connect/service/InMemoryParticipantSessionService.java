package com.example.connect.service;


import com.example.connect.entity.Participant;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory implementation of ParticipantSessionService.
 * Structure: Map<roomId, Map<userId, Participant>>  (your required shape)
 * plus a reverse index Map<sessionId, Participant> for disconnect lookup.
 * Thread-safe: rooms/participants are added concurrently.
 */
@Service
public class InMemoryParticipantSessionService implements ParticipantSessionService {

    @Autowired
    ObjectMapper objectMapper;

    /** roomId -> (userId -> participant) */
    private final Map<String, Map<String, Participant>> rooms =
            new ConcurrentHashMap<>();

    /** sessionId -> participant (reverse index for disconnect handling) */
    private final Map<String, Participant> participantsBySession =
            new ConcurrentHashMap<>();

    @Override
    public boolean addParticipant(Participant participant) {
        Map<String, Participant> roomMembers =
                rooms.computeIfAbsent(participant.getRoomId(), k -> new ConcurrentHashMap<>());

        boolean added = roomMembers.putIfAbsent(participant.getUserId(), participant) == null;
        if (added) {
            participantsBySession.put(participant.getSessionId(), participant);
        }
        return added;
    }

    @Override
    public Optional<Participant> removeParticipant(String roomId, String userId) {
        Map<String, Participant> roomMembers = rooms.get(roomId);
        if (roomMembers == null) {
            return Optional.empty();
        }
        Participant removed = roomMembers.remove(userId);
        if (removed != null) {
            participantsBySession.remove(removed.getSessionId());
            // tidy up empty rooms so the map doesn't grow forever
            if (roomMembers.isEmpty()) {
                rooms.remove(roomId, roomMembers);
            }
        }
        return Optional.ofNullable(removed);
    }

    @Override
    public Optional<Participant> findBySessionId(String sessionId) {
        return Optional.ofNullable(participantsBySession.get(sessionId));
    }

    @Override
    public Optional<Participant> removeBySessionId(String sessionId) {
        Participant participant = participantsBySession.remove(sessionId);
        if (participant == null) {
            return Optional.empty();
        }
        return removeParticipant(participant.getRoomId(), participant.getUserId());
    }

    @Override
    public List<Participant> getParticipants(String roomId) {
        return List.copyOf(rooms.getOrDefault(roomId, Map.of()).values());
    }

    @Override
    public void transformPartnerData(JsonNode partner) {
        JsonNode apiMappings = partner.get("apiMappings");

        ArrayNode apis = objectMapper.createArrayNode();
        for (JsonNode apiMapping : apiMappings) {
            JsonNode apiToBeAdded = apiMapping.deepCopy();
            insertApi(apis, apiToBeAdded);
        }

        JsonNode formMappings = partner.get("formMappings");
        for (JsonNode formMapping : formMappings) {
            JsonNode formToBeAdded = formMapping.deepCopy();
            insertForm(apis, formToBeAdded);
        }

        JsonNode partnerApiRules = partner.get("partnerAPIRules");
        for (JsonNode partnerApiRule : partnerApiRules) {
            JsonNode partnerApiRuleToBeAdded = partnerApiRule.deepCopy();
            insertPartnerApiRule(apis, partnerApiRuleToBeAdded);
        }

        ObjectNode partnerNode = (ObjectNode) partner;
        partnerNode.set("apis", apis);
        partnerNode.remove("apiMappings");
        partnerNode.remove("formMappings");
        partnerNode.remove("partnerAPIRules");
    }

    private void insertApi(JsonNode apis, JsonNode apiToBeAdded) {
        JsonNode api = null;
        for (JsonNode addedApi : apis) {
            if (addedApi.get("name").equals(apiToBeAdded.get("apiName"))) {
                api = addedApi;
                break;
            }
        }
        if (api == null) {
            api = objectMapper.createObjectNode();
            ((ObjectNode) api).set("name", apiToBeAdded.get("apiName"));
            ((ObjectNode) api).set("apiMappings", objectMapper.createArrayNode());
            ((ArrayNode) apis).add(api);
        }

        ArrayNode apiMappings = (ArrayNode) api.get("apiMappings");
        apiMappings.add(apiToBeAdded);
        ((ObjectNode) apiToBeAdded).remove("apiName");
    }

    private void insertForm(JsonNode apis, JsonNode formMapping) {
        JsonNode api = null;
        for (JsonNode addedApi : apis) {
            if (addedApi.get("name").equals(formMapping.get("apiName"))) {
                api = addedApi;
                break;
            }
        }
        if (api == null) {
            api = objectMapper.createObjectNode();
            ((ObjectNode) api).set("name", formMapping.get("apiName"));
            ((ArrayNode) apis).add(api);
        }
        ((ObjectNode) api).set("formMappings", formMapping);
        ((ObjectNode) formMapping).remove("apiName");
    }

    private void insertPartnerApiRule(JsonNode apis, JsonNode partnerApiRule) {
        JsonNode api = null;
        for (JsonNode addedApi : apis) {
            if (addedApi.get("name").equals(partnerApiRule.get("apiName"))) {
                api = addedApi;
                break;
            }
        }
        if (api == null) {
            api = objectMapper.createObjectNode();
            ((ObjectNode) api).set("name", partnerApiRule.get("apiName"));
            ((ObjectNode) api).set("partnerAPIRules", objectMapper.createArrayNode());
            ((ArrayNode) apis).add(api);
        }

        if (api.has("partnerAPIRules")) {
            ArrayNode partnerApiRules = (ArrayNode) api.get("partnerAPIRules");
            partnerApiRules.add(partnerApiRule);
        } else {
            ArrayNode partnerApiRules = objectMapper.createArrayNode();
            partnerApiRules.add(partnerApiRule);
            ((ObjectNode) api).set("partnerAPIRules", partnerApiRules);
        }
        ((ObjectNode) partnerApiRule).remove("apiName");
    }


}

