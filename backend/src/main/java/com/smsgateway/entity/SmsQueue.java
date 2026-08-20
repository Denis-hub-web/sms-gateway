package com.smsgateway.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.smsgateway.entity.enums.MessageStatus;
import com.smsgateway.entity.enums.MessageType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(name = "sms_queue")
@Getter @Setter @Builder
@NoArgsConstructor @AllArgsConstructor
public class SmsQueue {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;

    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "tenant", "user"})
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "gateway_id")
    private Gateway gateway;

    @Column(nullable = false, unique = true, length = 64)
    private String messageUid;

    @Column(nullable = false, length = 20)
    private String phoneNumber;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String message;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private MessageType messageType = MessageType.SINGLE;

    @Column(nullable = false)
    @Builder.Default
    private Integer priority = 5;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private MessageStatus status = MessageStatus.PENDING;

    @Column(nullable = false)
    @Builder.Default
    private Integer retryCount = 0;

    @Column(nullable = false)
    @Builder.Default
    private Integer maxRetries = 3;

    @Column(columnDefinition = "TEXT")
    private String errorMessage;

    private Instant scheduledAt;
    private Instant assignedAt;
    private Instant sentAt;
    private Instant deliveredAt;
    private Instant failedAt;
    private Instant expiresAt;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private Instant updatedAt;
}
