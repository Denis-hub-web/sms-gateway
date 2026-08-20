package com.smsgateway.controller;

import com.smsgateway.dto.request.SendSmsRequest;
import com.smsgateway.dto.response.SendSmsResponse;
import com.smsgateway.security.UserPrincipal;
import com.smsgateway.service.SmsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/sms")
@RequiredArgsConstructor
@Tag(name = "SMS", description = "SMS sending and history")
@SecurityRequirement(name = "Bearer Auth")
public class SmsController {

    private final SmsService smsService;

    @PostMapping("/send")
    @Operation(summary = "Queue an SMS for delivery", description = """
        Queues an SMS message for delivery through an Android gateway.
        Auto-detects Single/Multipart/Unicode type.
        Optionally specify a gateway or schedule for later.
        """)
    public ResponseEntity<SendSmsResponse> send(
        @Valid @RequestBody SendSmsRequest request,
        @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(smsService.sendSms(request, principal.getTenantId()));
    }

    @GetMapping("/history")
    @Operation(summary = "Get SMS history (paginated)")
    public ResponseEntity<Page<?>> history(
        @AuthenticationPrincipal UserPrincipal principal,
        @PageableDefault(size = 20, sort = "createdAt") Pageable pageable
    ) {
        return ResponseEntity.ok(smsService.getHistory(principal.getTenantId(), pageable));
    }

    @PostMapping("/retry/{messageId}")
    @Operation(summary = "Retry a failed/expired message")
    public ResponseEntity<SendSmsResponse> retry(
        @PathVariable String messageId,
        @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(smsService.retry(messageId, principal.getTenantId()));
    }
}
