package com.smsgateway.controller;

import com.smsgateway.dto.response.DashboardResponse;
import com.smsgateway.security.UserPrincipal;
import com.smsgateway.service.DashboardService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
@Tag(name = "Dashboard", description = "Real-time system statistics")
@SecurityRequirement(name = "Bearer Auth")
public class DashboardController {

    private final DashboardService dashboardService;

    @GetMapping
    @Operation(summary = "Get dashboard stats for this tenant")
    public ResponseEntity<DashboardResponse> getDashboard(
        @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(dashboardService.getDashboard(principal.getTenantId()));
    }
}
