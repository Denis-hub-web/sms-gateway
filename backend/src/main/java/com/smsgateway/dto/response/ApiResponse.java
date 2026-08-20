package com.smsgateway.dto.response;

import lombok.Builder;
import lombok.Data;
import java.time.Instant;

@Data @Builder
public class ApiResponse {
    private boolean success;
    private String message;
    private Instant timestamp;

    public static ApiResponse success(String message) {
        return ApiResponse.builder()
            .success(true)
            .message(message)
            .timestamp(Instant.now())
            .build();
    }

    public static ApiResponse error(String message) {
        return ApiResponse.builder()
            .success(false)
            .message(message)
            .timestamp(Instant.now())
            .build();
    }
}
