package com.smsgateway.repository;

import com.smsgateway.entity.Gateway;
import com.smsgateway.entity.enums.GatewayStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface GatewayRepository extends JpaRepository<Gateway, Long> {

    Optional<Gateway> findByGatewayUid(String gatewayUid);

    Optional<Gateway> findByAuthToken(String authToken);

    List<Gateway> findByTenantIdAndEnabledTrue(Long tenantId);

    List<Gateway> findByTenantId(Long tenantId);

    List<Gateway> findByStatus(GatewayStatus status);

    boolean existsByGatewayUid(String gatewayUid);

    Optional<Gateway> findByGatewayUidAndTenantId(String gatewayUid, Long tenantId);

    @Modifying
    @Query("""
        UPDATE Gateway g SET g.status = :status, g.lastHeartbeat = :now
        WHERE g.gatewayUid = :uid
    """)
    void updateStatusAndHeartbeat(
        @Param("uid") String uid,
        @Param("status") GatewayStatus status,
        @Param("now") Instant now
    );

    @Modifying
    @Query("""
        UPDATE Gateway g SET g.status = com.smsgateway.entity.enums.GatewayStatus.OFFLINE
        WHERE g.status = com.smsgateway.entity.enums.GatewayStatus.ONLINE
        AND g.lastHeartbeat < :threshold
    """)
    int markStaleGatewaysOffline(@Param("threshold") Instant threshold);

    @Query("""
        SELECT g FROM Gateway g
        WHERE g.tenant.id = :tenantId
        AND g.status = com.smsgateway.entity.enums.GatewayStatus.ONLINE
        AND g.enabled = true
        ORDER BY g.lastHeartbeat DESC
    """)
    List<Gateway> findOnlineByTenantId(@Param("tenantId") Long tenantId);

    @Query("SELECT COUNT(g) FROM Gateway g WHERE g.status = 'ONLINE'")
    long countOnlineGateways();
}
