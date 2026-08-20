package com.smsgateway.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class GatewayRegistrationRequest {
    @NotBlank(message = "Display name is required")
    private String displayName;

    private String deviceName;
    private String androidVersion;
    private String phoneNumber;
    private String simOperator;
    private String simSerial;
    private Integer batteryLevel;
    private Integer signalStrength;

    /** The gateway generates this itself on first install */
    @NotBlank(message = "gatewayUid is required")
    private String gatewayUid;
}
