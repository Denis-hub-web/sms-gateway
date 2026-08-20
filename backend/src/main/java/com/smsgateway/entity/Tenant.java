package com.smsgateway.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "tenants")
@Getter @Setter @Builder
@NoArgsConstructor @AllArgsConstructor
public class Tenant {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, unique = true, length = 64)
    private String apiKey;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false)
    @Builder.Default
    private Boolean active = true;

    @Column(nullable = false)
    @Builder.Default
    private Integer rateLimit = 60;

    // ── School SaaS Fields ───────────────────────────────────
    @Column(length = 200)
    private String schoolName;

    @Column(unique = true, length = 20)
    private String schoolCode;

    @Column(length = 20)
    @Builder.Default
    private String schoolType = "PRIVATE";

    @Column(length = 100)
    private String region;

    @Column(length = 20)
    private String contactPhone;

    @Column(length = 100)
    private String contactEmail;

    private Integer studentCount;

    @Column(nullable = false)
    @Builder.Default
    private Boolean setupFeePaid = false;

    @Column(length = 20)
    @Builder.Default
    private String subscriptionPlan = "STARTER";

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String subscriptionStatus = "INACTIVE";

    private Instant subscriptionExpiresAt;

    // Locked-in price at time of registration
    private Integer agreedMonthlyPriceTzs;
    private Integer agreedSetupFeeTzs;

    @Column(nullable = false)
    @Builder.Default
    private Boolean approvedByAdmin = false;

    private Instant approvedAt;

    @Column(columnDefinition = "TEXT")
    private String registrationNotes;

    // ── Timestamps ──────────────────────────────────────────
    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private Instant updatedAt;

    @JsonIgnore
    @OneToMany(mappedBy = "tenant", fetch = FetchType.LAZY)
    @Builder.Default
    private Set<User> users = new HashSet<>();

    @JsonIgnore
    @OneToMany(mappedBy = "tenant", fetch = FetchType.LAZY)
    @Builder.Default
    private Set<Gateway> gateways = new HashSet<>();
}
