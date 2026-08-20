package com.smsgateway.controller;

import com.smsgateway.dto.request.DeliveryReportRequest;
import com.smsgateway.dto.request.GatewayRegistrationRequest;
import com.smsgateway.dto.request.GatewayStatusRequest;
import com.smsgateway.dto.response.ApiResponse;
import com.smsgateway.dto.response.GatewayRegistrationResponse;
import com.smsgateway.dto.response.SmsJobDto;
import com.smsgateway.entity.Gateway;
import com.smsgateway.security.UserPrincipal;
import com.smsgateway.service.GatewayService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/gateway")
@RequiredArgsConstructor
@Tag(name = "Gateway", description = "Android gateway device operations")
@SecurityRequirement(name = "Bearer Auth")
public class GatewayController {

    private final GatewayService gatewayService;

    @PostMapping("/register")
    @Operation(summary = "Register Android gateway device")
    public ResponseEntity<GatewayRegistrationResponse> register(
        @Valid @RequestBody GatewayRegistrationRequest request,
        @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(
            gatewayService.register(request, principal.getTenantId(), principal.getId())
        );
    }

    @GetMapping("/jobs")
    @Operation(summary = "Fetch pending SMS jobs for this gateway")
    public ResponseEntity<List<SmsJobDto>> getJobs() {
        String gatewayUid = SecurityContextHolder.getContext().getAuthentication().getName();
        return ResponseEntity.ok(gatewayService.getJobs(gatewayUid));
    }

    @PostMapping("/status")
    @Operation(summary = "Update gateway status (online/offline/sending)")
    public ResponseEntity<ApiResponse> updateStatus(@RequestBody GatewayStatusRequest request) {
        String gatewayUid = SecurityContextHolder.getContext().getAuthentication().getName();
        gatewayService.updateStatus(gatewayUid, request);
        return ResponseEntity.ok(ApiResponse.success("Status updated"));
    }

    @PostMapping("/report")
    @Operation(summary = "Submit SMS delivery report")
    public ResponseEntity<ApiResponse> deliveryReport(
        @Valid @RequestBody DeliveryReportRequest request
    ) {
        String gatewayUid = SecurityContextHolder.getContext().getAuthentication().getName();
        gatewayService.processDeliveryReport(gatewayUid, request);
        return ResponseEntity.ok(ApiResponse.success("Report received"));
    }

    @PostMapping("/heartbeat")
    @Operation(summary = "Gateway heartbeat (every 30 seconds)")
    public ResponseEntity<ApiResponse> heartbeat(
        @RequestBody(required = false) GatewayStatusRequest request
    ) {
        String gatewayUid = SecurityContextHolder.getContext().getAuthentication().getName();
        gatewayService.heartbeat(gatewayUid, request);
        return ResponseEntity.ok(ApiResponse.success("Heartbeat received"));
    }

    // ── Admin endpoints (user JWT, not gateway JWT) ────────────────────────────

    @GetMapping("/admin/list")
    @Operation(summary = "List all gateways for this tenant (admin)")
    public ResponseEntity<List<Gateway>> listGateways(
        @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(gatewayService.listGateways(principal.getTenantId()));
    }

    @DeleteMapping("/admin/{gatewayUid}")
    @Operation(summary = "Delete a gateway by UID (admin)")
    public ResponseEntity<ApiResponse> deleteGateway(
        @PathVariable String gatewayUid,
        @AuthenticationPrincipal UserPrincipal principal
    ) {
        gatewayService.deleteGateway(gatewayUid, principal.getTenantId());
        return ResponseEntity.ok(ApiResponse.success("Gateway deleted"));
    }
}
