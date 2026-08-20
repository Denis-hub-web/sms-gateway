package com.smsgateway.service;

import com.smsgateway.entity.ApiKey;
import com.smsgateway.entity.Tenant;
import com.smsgateway.exception.ResourceNotFoundException;
import com.smsgateway.repository.ApiKeyRepository;
import com.smsgateway.repository.TenantRepository;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ApiKeyService {

    private final ApiKeyRepository apiKeyRepository;
    private final TenantRepository tenantRepository;
    private final com.smsgateway.repository.GatewayRepository gatewayRepository;

    @Data
    @Builder
    public static class CreateApiKeyResponse {
        private Long id;
        private String name;
        private String rawApiKey; // Returned ONCE to the user
        private String keyPrefix;
        private Instant createdAt;
        private String boundGatewayUid;
    }

    @Transactional
    public CreateApiKeyResponse createApiKey(Long tenantId, String name, String gatewayUid) {
        Tenant tenant = tenantRepository.findById(tenantId)
            .orElseThrow(() -> new ResourceNotFoundException("Tenant not found"));

        com.smsgateway.entity.Gateway boundGateway = null;
        if (gatewayUid != null && !gatewayUid.isBlank()) {
            boundGateway = gatewayRepository.findByGatewayUid(gatewayUid).orElse(null);
        }

        // Generate raw API Key: sk_live_<random_bytes>
        byte[] randomBytes = new byte[24];
        new SecureRandom().nextBytes(randomBytes);
        String randomHex = HexFormat.of().formatHex(randomBytes);
        String rawApiKey = "sk_live_" + randomHex;
        String prefix = rawApiKey.substring(0, 15); // "sk_live_1234567"

        String keyHash = hashKey(rawApiKey);

        ApiKey apiKey = ApiKey.builder()
            .tenant(tenant)
            .name(name)
            .keyPrefix(prefix)
            .keyHash(keyHash)
            .gateway(boundGateway)
            .enabled(true)
            .build();

        ApiKey saved = apiKeyRepository.save(apiKey);

        return CreateApiKeyResponse.builder()
            .id(saved.getId())
            .name(saved.getName())
            .rawApiKey(rawApiKey)
            .keyPrefix(saved.getKeyPrefix())
            .boundGatewayUid(saved.getGateway() != null ? saved.getGateway().getGatewayUid() : null)
            .createdAt(saved.getCreatedAt())
            .build();
    }

    public List<ApiKey> listApiKeys(Long tenantId) {
        return apiKeyRepository.findByTenantIdOrderByIdDesc(tenantId);
    }

    @Transactional
    public void revokeApiKey(Long id, Long tenantId) {
        ApiKey key = apiKeyRepository.findByIdAndTenantId(id, tenantId)
            .orElseThrow(() -> new ResourceNotFoundException("API key not found"));
        key.setEnabled(false);
        apiKeyRepository.save(key);
    }

    public ApiKey validateApiKey(String rawApiKey) {
        String hash = hashKey(rawApiKey);
        ApiKey apiKey = apiKeyRepository.findByKeyHashAndEnabledTrue(hash)
            .orElseThrow(() -> new ResourceNotFoundException("Invalid or revoked API key"));

        apiKey.setLastUsedAt(Instant.now());
        apiKeyRepository.save(apiKey);

        return apiKey;
    }

    private String hashKey(String rawKey) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(rawKey.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 algorithm not found", e);
        }
    }
}
