package com.smsgateway.service;

import com.smsgateway.repository.GatewayRepository;
import com.smsgateway.repository.SmsQueueRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Slf4j
@Service
@RequiredArgsConstructor
public class HeartbeatScheduler {

    private final GatewayRepository gatewayRepository;
    private final SmsQueueRepository smsQueueRepository;

    @Value("${app.gateway.heartbeat-timeout-seconds:120}")
    private int heartbeatTimeoutSeconds;

    /** Mark stale gateways offline every 30 seconds */
    @Scheduled(fixedDelay = 30_000)
    @Transactional
    public void checkGatewayHeartbeats() {
        Instant threshold = Instant.now().minusSeconds(heartbeatTimeoutSeconds);
        int marked = gatewayRepository.markStaleGatewaysOffline(threshold);
        if (marked > 0) {
            log.info("Marked {} gateway(s) as OFFLINE due to missed heartbeat", marked);
        }
    }

    /** Expire old messages every 5 minutes */
    @Scheduled(fixedDelay = 300_000)
    @Transactional
    public void expireMessages() {
        int expired = smsQueueRepository.expireOldMessages(Instant.now());
        if (expired > 0) {
            log.info("Expired {} stale message(s)", expired);
        }
    }
}
