package com.smsgateway.service;

import com.smsgateway.entity.AuditLog;
import com.smsgateway.entity.User;
import com.smsgateway.repository.AuditLogRepository;
import com.smsgateway.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuditService {

    private final AuditLogRepository auditLogRepository;
    private final UserRepository userRepository;

    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void log(
        Long userId,
        Long tenantId,
        String action,
        String entityType,
        String entityId,
        String details,
        String ipAddress,
        String userAgent
    ) {
        try {
            User user = userId != null
                ? userRepository.findById(userId).orElse(null)
                : null;

            AuditLog entry = AuditLog.builder()
                .user(user)
                .tenantId(tenantId)
                .action(action)
                .entityType(entityType)
                .entityId(entityId)
                .details(details)
                .ipAddress(ipAddress)
                .userAgent(userAgent)
                .build();

            auditLogRepository.save(entry);
        } catch (Exception e) {
            log.error("Failed to write audit log: {}", e.getMessage());
        }
    }
}
