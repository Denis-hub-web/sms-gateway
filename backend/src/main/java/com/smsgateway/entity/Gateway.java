package com.smsgateway.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.smsgateway.entity.enums.GatewayStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(name = "gateways")
@Getter @Setter @Builder
@NoArgsConstructor @AllArgsConstructor
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class Gateway {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @Column(nullable = false, unique = true, length = 64)
    private String gatewayUid;

    @Column(nullable = false, length = 100)
    private String displayName;

    @Column(length = 100)
    private String deviceName;

    @Column(length = 20)
    private String androidVersion;

    @Column(length = 20)
    private String phoneNumber;

    @Column(length = 50)
    private String simOperator;

    @Column(length = 50)
    private String simSerial;

    private Integer batteryLevel;

    private Integer signalStrength;

    @Builder.Default
    private Boolean simVerified = true;

    @Column(length = 10)
    private String verificationPin;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private GatewayStatus status = GatewayStatus.OFFLINE;

    @Column(nullable = false, unique = true, length = 255)
    private String authToken;

    private Instant lastHeartbeat;

    private Instant lastSync;

    @Column(nullable = false)
    @Builder.Default
    private Boolean enabled = true;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private Instant updatedAt;
}
