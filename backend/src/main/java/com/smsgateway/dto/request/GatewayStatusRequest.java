package com.smsgateway.dto.request;

import lombok.Data;

@Data
public class GatewayStatusRequest {
    private String status;          // ONLINE, OFFLINE, SENDING, FAILED
    private Integer batteryLevel;
    private Integer signalStrength;
    private String simOperator;
    private String phoneNumber;
}
