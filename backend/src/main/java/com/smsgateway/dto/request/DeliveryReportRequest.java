package com.smsgateway.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class DeliveryReportRequest {
    @NotBlank
    private String messageId;

    @NotBlank
    private String status;          // SENT, DELIVERED, FAILED, TIMEOUT

    private String errorCode;
    private String errorMessage;
}
