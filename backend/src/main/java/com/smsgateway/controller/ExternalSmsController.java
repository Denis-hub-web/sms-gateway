package com.smsgateway.controller;

import com.smsgateway.dto.request.SendSmsRequest;
import com.smsgateway.dto.response.SendSmsResponse;
import com.smsgateway.entity.ApiKey;
import com.smsgateway.service.ApiKeyService;
import com.smsgateway.service.SmsService;
import com.smsgateway.service.SseService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/sms")
@RequiredArgsConstructor
@Tag(name = "External API v1", description = "REST API for external websites, CRMs, and apps")
public class ExternalSmsController {

    private final ApiKeyService apiKeyService;
    private final SmsService smsService;
    private final SseService sseService;

    @PostMapping("/send")
    @Operation(summary = "Send SMS via REST API Key (Header: X-API-Key)")
    public ResponseEntity<SendSmsResponse> sendSms(
        @RequestHeader("X-API-Key") String apiKeyHeader,
        @Valid @RequestBody SendSmsRequest request
    ) {
        ApiKey apiKey = apiKeyService.validateApiKey(apiKeyHeader);
        if (apiKey.getGateway() != null && (request.getGatewayUid() == null || request.getGatewayUid().isBlank())) {
            request.setGatewayUid(apiKey.getGateway().getGatewayUid());
        }
        SendSmsResponse response = smsService.sendSms(request, apiKey.getTenant().getId());

        // Broadcast live SSE event to dashboard
        sseService.broadcastEvent("SMS_QUEUED", Map.of(
            "messageUid", response.getMessageId(),
            "phoneNumber", response.getPhoneNumber(),
            "status", response.getStatus(),
            "createdAt", System.currentTimeMillis()
        ));

        return ResponseEntity.ok(response);
    }
}
