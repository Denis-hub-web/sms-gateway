package com.smsgateway.service;

import com.smsgateway.dto.request.SendSmsRequest;
import com.smsgateway.dto.response.SendSmsResponse;
import com.smsgateway.entity.Gateway;
import com.smsgateway.entity.SmsQueue;
import com.smsgateway.entity.Tenant;
import com.smsgateway.entity.enums.MessageStatus;
import com.smsgateway.entity.enums.MessageType;
import com.smsgateway.exception.ApiException;
import com.smsgateway.exception.ResourceNotFoundException;
import com.smsgateway.repository.GatewayRepository;
import com.smsgateway.repository.SmsQueueRepository;
import com.smsgateway.repository.TenantRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class SmsService {

    private final SmsQueueRepository smsQueueRepository;
    private final TenantRepository tenantRepository;
    private final GatewayRepository gatewayRepository;

    @Transactional
    public SendSmsResponse sendSms(SendSmsRequest req, Long tenantId) {
        Tenant tenant = tenantRepository.findById(tenantId)
            .orElseThrow(() -> new ResourceNotFoundException("Tenant not found"));

        // Detect message type
        MessageType messageType = detectMessageType(req.getMessage());

        // Resolve gateway
        Gateway gateway = null;
        if (req.getGatewayUid() != null) {
            gateway = gatewayRepository.findByGatewayUid(req.getGatewayUid())
                .orElseThrow(() -> new ResourceNotFoundException("Gateway not found: " + req.getGatewayUid()));
        } else {
            // Auto-assign: pick first online gateway for this tenant
            List<Gateway> online = gatewayRepository.findOnlineByTenantId(tenantId);
            if (!online.isEmpty()) {
                gateway = online.get(0);
            }
        }

        String rawPhone = req.getPhoneNumber() != null ? req.getPhoneNumber().trim() : "";
        String cleanPhone = rawPhone.replaceAll("[^0-9+]", "");
        if (cleanPhone.isEmpty()) {
            cleanPhone = rawPhone;
        }

        String messageUid = UUID.randomUUID().toString();

        SmsQueue sms = SmsQueue.builder()
            .tenant(tenant)
            .gateway(gateway)
            .messageUid(messageUid)
            .phoneNumber(cleanPhone)
            .message(req.getMessage())
            .messageType(messageType)
            .priority(req.getPriority() != null ? req.getPriority() : 5)
            .status(MessageStatus.PENDING)
            .scheduledAt(req.getScheduledAt())
            .expiresAt(req.getExpiresAt())
            .build();

        SmsQueue saved = smsQueueRepository.save(sms);
        log.info("SMS queued: {} → {}", messageUid, req.getPhoneNumber());

        return SendSmsResponse.builder()
            .messageId(saved.getMessageUid())
            .status(saved.getStatus().name())
            .phoneNumber(saved.getPhoneNumber())
            .createdAt(saved.getCreatedAt())
            .message("Message queued successfully")
            .build();
    }

    @Transactional(readOnly = true)
    public Page<SmsQueue> getHistory(Long tenantId, Pageable pageable) {
        return smsQueueRepository.findByTenantIdOrderByCreatedAtDesc(tenantId, pageable);
    }

    @Transactional
    public SendSmsResponse retry(String messageId, Long tenantId) {
        SmsQueue sms = smsQueueRepository.findByMessageUid(messageId)
            .orElseThrow(() -> new ResourceNotFoundException("Message not found: " + messageId));

        if (!sms.getTenant().getId().equals(tenantId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Access denied");
        }

        if (sms.getStatus() != MessageStatus.FAILED && sms.getStatus() != MessageStatus.EXPIRED) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                "Only FAILED or EXPIRED messages can be retried");
        }

        sms.setStatus(MessageStatus.PENDING);
        sms.setRetryCount(0);
        sms.setErrorMessage(null);
        sms.setFailedAt(null);
        smsQueueRepository.save(sms);

        return SendSmsResponse.builder()
            .messageId(sms.getMessageUid())
            .status(MessageStatus.PENDING.name())
            .phoneNumber(sms.getPhoneNumber())
            .createdAt(Instant.now())
            .message("Message re-queued for retry")
            .build();
    }

    private MessageType detectMessageType(String message) {
        // Check for non-GSM characters (Unicode)
        for (char c : message.toCharArray()) {
            if (c > 127) return MessageType.UNICODE;
        }
        // Multipart if > 160 chars
        if (message.length() > 160) return MessageType.MULTIPART;
        return MessageType.SINGLE;
    }
}
