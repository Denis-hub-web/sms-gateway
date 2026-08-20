package com.smsgateway.controller;

import com.smsgateway.dto.response.ApiResponse;
import com.smsgateway.entity.ApiKey;
import com.smsgateway.security.UserPrincipal;
import com.smsgateway.service.ApiKeyService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/api-keys")
@RequiredArgsConstructor
@Tag(name = "API Keys", description = "Manage REST API keys for external system integrations")
@SecurityRequirement(name = "Bearer Auth")
public class ApiKeyController {

    private final ApiKeyService apiKeyService;

    @Data
    public static class CreateApiKeyRequest {
        private String name;
        private String gatewayUid;
    }

    @PostMapping
    @Operation(summary = "Create a new REST API key")
    public ResponseEntity<ApiKeyService.CreateApiKeyResponse> createKey(
        @RequestBody CreateApiKeyRequest request,
        @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(
            apiKeyService.createApiKey(principal.getTenantId(), request.getName(), request.getGatewayUid())
        );
    }

    @GetMapping
    @Operation(summary = "List all API keys for this tenant")
    public ResponseEntity<List<ApiKey>> listKeys(
        @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(
            apiKeyService.listApiKeys(principal.getTenantId())
        );
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Revoke an API key by ID")
    public ResponseEntity<ApiResponse> revokeKey(
        @PathVariable Long id,
        @AuthenticationPrincipal UserPrincipal principal
    ) {
        apiKeyService.revokeApiKey(id, principal.getTenantId());
        return ResponseEntity.ok(ApiResponse.success("API Key revoked successfully"));
    }
}
