package com.smsgateway.dto.response;

import lombok.Builder;
import lombok.Data;
import java.time.Instant;

@Data @Builder
public class GatewayRegistrationResponse {
    private String gatewayUid;
    private String authToken;
    private String displayName;
    private Long gatewayId;
    private Instant registeredAt;
}
