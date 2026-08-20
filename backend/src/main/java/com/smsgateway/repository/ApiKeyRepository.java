package com.smsgateway.repository;

import com.smsgateway.entity.ApiKey;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ApiKeyRepository extends JpaRepository<ApiKey, Long> {

    List<ApiKey> findByTenantIdOrderByIdDesc(Long tenantId);

    Optional<ApiKey> findByKeyHashAndEnabledTrue(String keyHash);

    Optional<ApiKey> findByIdAndTenantId(Long id, Long tenantId);
}
