package com.smsgateway.service;

import com.smsgateway.dto.request.DeliveryReportRequest;
import com.smsgateway.dto.request.GatewayRegistrationRequest;
import com.smsgateway.dto.request.GatewayStatusRequest;
import com.smsgateway.dto.response.GatewayRegistrationResponse;
import com.smsgateway.dto.response.SmsJobDto;
import com.smsgateway.entity.DeliveryReport;
import com.smsgateway.entity.Gateway;
import com.smsgateway.entity.SmsQueue;
import com.smsgateway.entity.Tenant;
import com.smsgateway.entity.enums.DeliveryStatus;
import com.smsgateway.entity.enums.GatewayStatus;
import com.smsgateway.entity.enums.MessageStatus;
import com.smsgateway.exception.ApiException;
import com.smsgateway.exception.ResourceNotFoundException;
import com.smsgateway.repository.DeliveryReportRepository;
import com.smsgateway.repository.GatewayRepository;
import com.smsgateway.repository.SmsQueueRepository;
import com.smsgateway.repository.TenantRepository;
import com.smsgateway.repository.UserRepository;
import com.smsgateway.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class GatewayService {

    private final GatewayRepository gatewayRepository;
    private final TenantRepository tenantRepository;
    private final UserRepository userRepository;
    private final SmsQueueRepository smsQueueRepository;
    private final DeliveryReportRepository deliveryReportRepository;
    private final JwtTokenProvider jwtTokenProvider;
    private final AuditService auditService;
    private final SseService sseService;

    @Value("${app.gateway.job-batch-size:10}")
    private int jobBatchSize;

    @Transactional
    public GatewayRegistrationResponse register(
        GatewayRegistrationRequest req,
        Long tenantId,
        Long userId
    ) {
        Tenant tenant = tenantRepository.findById(tenantId)
            .orElseThrow(() -> new ResourceNotFoundException("Tenant not found"));

        // Idempotent: if gateway already registered, re-bind to current tenant & user
        if (gatewayRepository.existsByGatewayUid(req.getGatewayUid())) {
            Gateway existing = gatewayRepository.findByGatewayUid(req.getGatewayUid()).orElseThrow();
            existing.setTenant(tenant);
            userRepository.findById(userId).ifPresent(existing::setUser);
            existing.setDisplayName(req.getDisplayName());
            existing.setDeviceName(req.getDeviceName());
            existing.setAndroidVersion(req.getAndroidVersion());
            existing.setPhoneNumber(req.getPhoneNumber());
            existing.setSimOperator(req.getSimOperator());
            existing.setSimSerial(req.getSimSerial());
            existing.setStatus(GatewayStatus.ONLINE);
            existing.setLastHeartbeat(Instant.now());
            String freshToken = jwtTokenProvider.generateGatewayToken(req.getGatewayUid(), tenantId);
            existing.setAuthToken(freshToken);
            gatewayRepository.save(existing);

            return GatewayRegistrationResponse.builder()
                .gatewayUid(existing.getGatewayUid())
                .authToken(freshToken)
                .displayName(existing.getDisplayName())
                .gatewayId(existing.getId())
                .registeredAt(existing.getCreatedAt())
                .build();
        }

        String authToken = jwtTokenProvider.generateGatewayToken(req.getGatewayUid(), tenantId);

        Gateway gateway = Gateway.builder()
            .tenant(tenant)
            .gatewayUid(req.getGatewayUid())
            .displayName(req.getDisplayName())
            .deviceName(req.getDeviceName())
            .androidVersion(req.getAndroidVersion())
            .phoneNumber(req.getPhoneNumber())
            .simOperator(req.getSimOperator())
            .simSerial(req.getSimSerial())
            .batteryLevel(req.getBatteryLevel())
            .signalStrength(req.getSignalStrength())
            .status(GatewayStatus.OFFLINE)
            .authToken(authToken)
            .build();

        Gateway saved = gatewayRepository.save(gateway);
        log.info("Gateway registered: {} for tenant {}", req.getGatewayUid(), tenantId);

        auditService.log(userId, tenantId, "GATEWAY_REGISTERED",
            "Gateway", req.getGatewayUid(), "Gateway registered: " + req.getDisplayName(), null, null);

        return GatewayRegistrationResponse.builder()
            .gatewayUid(saved.getGatewayUid())
            .authToken(saved.getAuthToken())
            .displayName(saved.getDisplayName())
            .gatewayId(saved.getId())
            .registeredAt(saved.getCreatedAt())
            .build();
    }

    @Transactional
    public List<SmsJobDto> getJobs(String gatewayUid) {
        Gateway gateway = gatewayRepository.findByGatewayUid(gatewayUid)
            .orElseGet(() -> {
                log.info("Auto-restoring missing gateway: {}", gatewayUid);
                Tenant tenant = tenantRepository.findAll().stream().findFirst()
                    .orElseThrow(() -> new ResourceNotFoundException("No tenant found"));
                Gateway newGw = Gateway.builder()
                    .tenant(tenant)
                    .gatewayUid(gatewayUid)
                    .displayName("Android Gateway (" + (gatewayUid.length() >= 8 ? gatewayUid.substring(0, 8) : gatewayUid) + ")")
                    .deviceName("Android Device")
                    .status(GatewayStatus.ONLINE)
                    .lastHeartbeat(Instant.now())
                    .authToken("auto-" + gatewayUid)
                    .build();
                return gatewayRepository.save(newGw);
            });

        // Automatically update online status and heartbeat on every poll
        gateway.setStatus(GatewayStatus.ONLINE);
        gateway.setLastHeartbeat(Instant.now());
        gatewayRepository.save(gateway);

        List<SmsQueue> jobs = smsQueueRepository.findPendingJobsForGateway(
            gatewayUid, gateway.getTenant().getId(), Instant.now(), jobBatchSize
        );

        for (SmsQueue job : jobs) {
            if (job.getGateway() == null) {
                job.setGateway(gateway);
            }
            job.setStatus(MessageStatus.SENDING);
            job.setAssignedAt(Instant.now());
        }
        smsQueueRepository.saveAll(jobs);

        return jobs.stream().map(q -> SmsJobDto.builder()
            .messageId(q.getMessageUid())
            .phoneNumber(q.getPhoneNumber())
            .message(q.getMessage())
            .messageType(q.getMessageType().name())
            .priority(q.getPriority())
            .build()
        ).collect(Collectors.toList());
    }

    @Transactional
    public void updateStatus(String gatewayUid, GatewayStatusRequest req) {
        Gateway gateway = gatewayRepository.findByGatewayUid(gatewayUid)
            .orElseThrow(() -> new ResourceNotFoundException("Gateway not found: " + gatewayUid));

        GatewayStatus newStatus = GatewayStatus.valueOf(req.getStatus().toUpperCase());
        gateway.setStatus(newStatus);
        gateway.setLastHeartbeat(Instant.now());

        if (req.getBatteryLevel() != null)  gateway.setBatteryLevel(req.getBatteryLevel());
        if (req.getSignalStrength() != null) gateway.setSignalStrength(req.getSignalStrength());
        if (req.getSimOperator() != null)   gateway.setSimOperator(req.getSimOperator());
        if (req.getPhoneNumber() != null)   gateway.setPhoneNumber(req.getPhoneNumber());

        gatewayRepository.save(gateway);
    }

    @Transactional
    public void processDeliveryReport(String gatewayUid, DeliveryReportRequest req) {
        SmsQueue sms = smsQueueRepository.findByMessageUid(req.getMessageId())
            .orElseThrow(() -> new ResourceNotFoundException("Message not found: " + req.getMessageId()));

        DeliveryStatus deliveryStatus = DeliveryStatus.valueOf(req.getStatus().toUpperCase());

        // Save delivery report
        DeliveryReport report = DeliveryReport.builder()
            .messageUid(req.getMessageId())
            .gatewayUid(gatewayUid)
            .status(deliveryStatus)
            .errorCode(req.getErrorCode())
            .errorMessage(req.getErrorMessage())
            .build();
        deliveryReportRepository.save(report);

        // Update queue status
        Instant now = Instant.now();
        switch (deliveryStatus) {
            case SENT -> {
                sms.setStatus(MessageStatus.SENT);
                sms.setSentAt(now);
            }
            case DELIVERED -> {
                sms.setStatus(MessageStatus.DELIVERED);
                sms.setDeliveredAt(now);
            }
            case FAILED, TIMEOUT -> {
                if (sms.getRetryCount() < sms.getMaxRetries()) {
                    sms.setStatus(MessageStatus.RETRY);
                    sms.setRetryCount(sms.getRetryCount() + 1);
                } else {
                    sms.setStatus(MessageStatus.FAILED);
                    sms.setFailedAt(now);
                }
                sms.setErrorMessage(req.getErrorMessage());
            }
        }
        smsQueueRepository.save(sms);
        log.debug("Delivery report for {} → {}", req.getMessageId(), deliveryStatus);

        // Broadcast real-time SSE update to connected web dashboards
        sseService.broadcastEvent("SMS_STATUS_UPDATED", java.util.Map.of(
            "messageUid", sms.getMessageUid(),
            "phoneNumber", sms.getPhoneNumber(),
            "status", sms.getStatus().name(),
            "updatedAt", System.currentTimeMillis()
        ));
    }

    @Transactional
    public void heartbeat(String gatewayUid, GatewayStatusRequest req) {
        gatewayRepository.updateStatusAndHeartbeat(
            gatewayUid,
            GatewayStatus.ONLINE,
            Instant.now()
        );
        if (req != null) {
            updateStatus(gatewayUid, req);
        }
    }

    // ── Admin operations ──────────────────────────────────────────────────────

    public List<Gateway> listGateways(Long tenantId) {
        return gatewayRepository.findByTenantId(tenantId);
    }

    @Transactional
    public void deleteGateway(String gatewayUid, Long tenantId) {
        Gateway gateway = gatewayRepository.findByGatewayUidAndTenantId(gatewayUid, tenantId)
            .orElseThrow(() -> new ResourceNotFoundException("Gateway not found: " + gatewayUid));
        // Unassign pending messages so they can be re-picked by another gateway
        smsQueueRepository.findAll().stream()
            .filter(s -> gateway.equals(s.getGateway()) &&
                         (s.getStatus().name().equals("PENDING") || s.getStatus().name().equals("SENDING")))
            .forEach(s -> { s.setGateway(null); smsQueueRepository.save(s); });
        gatewayRepository.delete(gateway);
        log.info("Gateway deleted: {} by tenant {}", gatewayUid, tenantId);
    }
}
