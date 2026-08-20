package com.smsgateway.repository;

import com.smsgateway.entity.Tenant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface TenantRepository extends JpaRepository<Tenant, Long> {

    Optional<Tenant> findByApiKey(String apiKey);

    boolean existsByApiKey(String apiKey);
}
