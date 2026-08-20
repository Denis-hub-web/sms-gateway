package com.smsgateway.dto.response;

import lombok.Builder;
import lombok.Data;

@Data @Builder
public class LoginResponse {
    private String accessToken;
    private String refreshToken;
    private String tokenType;
    private Long expiresIn;
    private String username;
    private String email;
    private String fullName;
    private Long userId;
    private Long tenantId;
}
