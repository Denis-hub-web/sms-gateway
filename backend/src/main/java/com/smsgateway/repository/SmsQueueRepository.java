package com.smsgateway.repository;

import com.smsgateway.entity.SmsQueue;
import com.smsgateway.entity.enums.MessageStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface SmsQueueRepository extends JpaRepository<SmsQueue, Long> {

    Optional<SmsQueue> findByMessageUid(String messageUid);

    boolean existsByMessageUid(String messageUid);

    @Query("SELECT s FROM SmsQueue s WHERE s.tenant.id = :tenantId ORDER BY s.createdAt DESC")
    Page<SmsQueue> findByTenantIdOrderByCreatedAtDesc(@Param("tenantId") Long tenantId, Pageable pageable);

    @Query("""
        SELECT s FROM SmsQueue s
        LEFT JOIN s.gateway g
        WHERE (g.gatewayUid = :gatewayUid OR (s.gateway IS NULL AND s.tenant.id = :tenantId))
        AND s.status IN ('PENDING', 'RETRY')
        AND (s.scheduledAt IS NULL OR s.scheduledAt <= :now)
        ORDER BY s.priority DESC, s.createdAt ASC
        LIMIT :limit
    """)
    List<SmsQueue> findPendingJobsForGateway(
        @Param("gatewayUid") String gatewayUid,
        @Param("tenantId") Long tenantId,
        @Param("now") Instant now,
        @Param("limit") int limit
    );

    @Query("""
        SELECT s FROM SmsQueue s
        WHERE s.tenant.id = :tenantId
        AND s.status IN ('PENDING', 'RETRY')
        AND (s.scheduledAt IS NULL OR s.scheduledAt <= :now)
        AND s.gateway IS NULL
        ORDER BY s.priority DESC, s.createdAt ASC
        LIMIT :limit
    """)
    List<SmsQueue> findUnassignedPendingJobs(
        @Param("tenantId") Long tenantId,
        @Param("now") Instant now,
        @Param("limit") int limit
    );

    @Query("SELECT COUNT(s) FROM SmsQueue s WHERE s.tenant.id = :tenantId AND s.status = :status")
    long countByTenantAndStatus(@Param("tenantId") Long tenantId, @Param("status") MessageStatus status);

    @Query("""
        SELECT COUNT(s) FROM SmsQueue s
        WHERE s.tenant.id = :tenantId
        AND s.status = 'SENT'
        AND s.sentAt >= :from AND s.sentAt < :to
    """)
    long countSentToday(@Param("tenantId") Long tenantId, @Param("from") Instant from, @Param("to") Instant to);

    @Query("""
        SELECT COUNT(s) FROM SmsQueue s
        WHERE s.tenant.id = :tenantId
        AND s.status = 'FAILED'
        AND s.failedAt >= :from AND s.failedAt < :to
    """)
    long countFailedToday(@Param("tenantId") Long tenantId, @Param("from") Instant from, @Param("to") Instant to);

    @Query("""
        SELECT COUNT(s) FROM SmsQueue s
        WHERE s.tenant.id = :tenantId
        AND s.status = 'DELIVERED'
        AND s.deliveredAt >= :from AND s.deliveredAt < :to
    """)
    long countDeliveredToday(@Param("tenantId") Long tenantId, @Param("from") Instant from, @Param("to") Instant to);

    @Modifying
    @Query("""
        UPDATE SmsQueue s SET s.status = com.smsgateway.entity.enums.MessageStatus.EXPIRED
        WHERE s.status IN (com.smsgateway.entity.enums.MessageStatus.PENDING, com.smsgateway.entity.enums.MessageStatus.RETRY)
        AND s.expiresAt IS NOT NULL
        AND s.expiresAt < :now
    """)
    int expireOldMessages(@Param("now") Instant now);
}
