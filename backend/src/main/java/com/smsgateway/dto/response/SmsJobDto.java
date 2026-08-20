package com.smsgateway.dto.response;

import lombok.Builder;
import lombok.Data;

@Data @Builder
public class SmsJobDto {
    private String messageId;
    private String phoneNumber;
    private String message;
    private String messageType;  // SINGLE, MULTIPART, UNICODE
    private Integer priority;
}
