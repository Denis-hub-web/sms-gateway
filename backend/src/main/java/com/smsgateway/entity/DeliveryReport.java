package com.smsgateway.entity;

import com.smsgateway.entity.enums.DeliveryStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

@Entity
@Table(name = "delivery_reports")
@Getter @Setter @Builder
@NoArgsConstructor @AllArgsConstructor
public class DeliveryReport {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 64)
    private String messageUid;

    @Column(nullable = false, length = 64)
    private String gatewayUid;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private DeliveryStatus status;

    @Column(length = 50)
    private String errorCode;

    @Column(columnDefinition = "TEXT")
    private String errorMessage;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant reportedAt;
}
