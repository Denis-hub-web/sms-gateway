package com.smsgateway.controller;

import com.smsgateway.service.SseService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.UUID;

@RestController
@RequestMapping("/api/stream")
@RequiredArgsConstructor
@Tag(name = "Live Stream", description = "Server-Sent Events for real-time dashboard updates")
public class SseController {

    private final SseService sseService;

    @GetMapping("/events")
    @Operation(summary = "Subscribe to live real-time events stream")
    public SseEmitter subscribe() {
        String clientId = UUID.randomUUID().toString();
        return sseService.subscribe(clientId);
    }
}
