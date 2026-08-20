package com.smsgateway.service;

import com.smsgateway.dto.response.DashboardResponse;
import com.smsgateway.entity.enums.MessageStatus;
import com.smsgateway.repository.GatewayRepository;
import com.smsgateway.repository.SmsQueueRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private final GatewayRepository gatewayRepository;
    private final SmsQueueRepository smsQueueRepository;

    @Transactional(readOnly = true)
    public DashboardResponse getDashboard(Long tenantId) {
        Instant startOfDay = LocalDate.now(ZoneOffset.UTC).atStartOfDay().toInstant(ZoneOffset.UTC);
        Instant endOfDay   = startOfDay.plusSeconds(86400);

        long totalGateways   = gatewayRepository.findByTenantIdAndEnabledTrue(tenantId).size();
        long onlineGateways  = gatewayRepository.findOnlineByTenantId(tenantId).size();
        long pendingSms      = smsQueueRepository.countByTenantAndStatus(tenantId, MessageStatus.PENDING)
                             + smsQueueRepository.countByTenantAndStatus(tenantId, MessageStatus.RETRY);
        long sentToday       = smsQueueRepository.countSentToday(tenantId, startOfDay, endOfDay);
        long deliveredToday  = smsQueueRepository.countDeliveredToday(tenantId, startOfDay, endOfDay);
        long failedToday     = smsQueueRepository.countFailedToday(tenantId, startOfDay, endOfDay);
        long totalAllTime    = smsQueueRepository.countByTenantAndStatus(tenantId, MessageStatus.SENT)
                             + smsQueueRepository.countByTenantAndStatus(tenantId, MessageStatus.DELIVERED);

        return DashboardResponse.builder()
            .totalGateways(totalGateways)
            .onlineGateways(onlineGateways)
            .pendingSms(pendingSms)
            .sentToday(sentToday)
            .deliveredToday(deliveredToday)
            .failedToday(failedToday)
            .totalSentAllTime(totalAllTime)
            .build();
    }
}
