package com.smsgateway.service;

import com.smsgateway.dto.request.SendSmsRequest;
import com.smsgateway.dto.response.SendSmsResponse;
import com.smsgateway.entity.SmsQueue;
import com.smsgateway.entity.Tenant;
import com.smsgateway.entity.enums.MessageStatus;
import com.smsgateway.entity.enums.MessageType;
import com.smsgateway.repository.GatewayRepository;
import com.smsgateway.repository.SmsQueueRepository;
import com.smsgateway.repository.TenantRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SmsServiceTest {

    @Mock SmsQueueRepository smsQueueRepository;
    @Mock TenantRepository tenantRepository;
    @Mock GatewayRepository gatewayRepository;

    @InjectMocks SmsService smsService;

    @Test
    void sendSms_singleMessage_queuesCorrectly() {
        // Arrange
        Tenant tenant = new Tenant();
        tenant.setId(1L);
        tenant.setName("Test");

        when(tenantRepository.findById(1L)).thenReturn(Optional.of(tenant));
        when(gatewayRepository.findOnlineByTenantId(1L)).thenReturn(List.of());

        SmsQueue savedSms = SmsQueue.builder()
            .messageUid("test-uid")
            .phoneNumber("+254700000000")
            .message("Hello World")
            .messageType(MessageType.SINGLE)
            .status(MessageStatus.PENDING)
            .tenant(tenant)
            .build();

        when(smsQueueRepository.save(any())).thenReturn(savedSms);

        SendSmsRequest req = new SendSmsRequest();
        req.setPhoneNumber("+254700000000");
        req.setMessage("Hello World");

        // Act
        SendSmsResponse response = smsService.sendSms(req, 1L);

        // Assert
        assertThat(response.getPhoneNumber()).isEqualTo("+254700000000");
        assertThat(response.getStatus()).isEqualTo("PENDING");
        verify(smsQueueRepository, times(1)).save(any(SmsQueue.class));
    }

    @Test
    void sendSms_unicodeMessage_detectsUnicodeType() {
        // Unicode character in message
        Tenant tenant = new Tenant();
        tenant.setId(1L);
        when(tenantRepository.findById(1L)).thenReturn(Optional.of(tenant));
        when(gatewayRepository.findOnlineByTenantId(1L)).thenReturn(List.of());

        when(smsQueueRepository.save(argThat(sms ->
            sms.getMessageType() == MessageType.UNICODE
        ))).thenAnswer(inv -> {
            SmsQueue s = inv.getArgument(0);
            s.setMessageUid("uid-123");
            return s;
        });

        SendSmsRequest req = new SendSmsRequest();
        req.setPhoneNumber("+254700000001");
        req.setMessage("Habari 🙂 ya leo"); // emoji = unicode

        smsService.sendSms(req, 1L);

        verify(smsQueueRepository).save(argThat(sms -> sms.getMessageType() == MessageType.UNICODE));
    }

    @Test
    void sendSms_longMessage_detectsMultipart() {
        Tenant tenant = new Tenant();
        tenant.setId(1L);
        when(tenantRepository.findById(1L)).thenReturn(Optional.of(tenant));
        when(gatewayRepository.findOnlineByTenantId(1L)).thenReturn(List.of());

        when(smsQueueRepository.save(any())).thenAnswer(inv -> {
            SmsQueue s = inv.getArgument(0);
            s.setMessageUid("uid-456");
            return s;
        });

        SendSmsRequest req = new SendSmsRequest();
        req.setPhoneNumber("+254700000002");
        req.setMessage("A".repeat(161)); // > 160 chars = MULTIPART

        smsService.sendSms(req, 1L);

        verify(smsQueueRepository).save(argThat(sms -> sms.getMessageType() == MessageType.MULTIPART));
    }
}
