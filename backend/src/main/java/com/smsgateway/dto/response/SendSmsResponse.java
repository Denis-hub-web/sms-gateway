package com.smsgateway.dto.response;

import lombok.Builder;
import lombok.Data;
import java.time.Instant;

@Data @Builder
public class SendSmsResponse {
    private String messageId;
    private String status;
    private String phoneNumber;
    private Instant createdAt;
    private String message;
}
