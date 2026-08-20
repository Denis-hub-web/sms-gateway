package com.smsgateway.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;
import java.time.Instant;

@Data
public class SendSmsRequest {
    @NotBlank(message = "Phone number is required")
    private String phoneNumber;

    @NotBlank(message = "Message is required")
    private String message;

    /** 1-10, lower = higher priority */
    private Integer priority = 5;

    /** Optional: schedule for later */
    private Instant scheduledAt;

    /** Optional: expire if not sent by this time */
    private Instant expiresAt;

    /** Optional: force specific gateway */
    private String gatewayUid;
}
