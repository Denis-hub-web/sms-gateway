package com.smsgateway.service;

import com.smsgateway.dto.request.LoginRequest;
import com.smsgateway.dto.response.LoginResponse;
import com.smsgateway.entity.User;
import com.smsgateway.exception.UnauthorizedException;
import com.smsgateway.repository.UserRepository;
import com.smsgateway.security.JwtTokenProvider;
import com.smsgateway.security.UserPrincipal;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final AuthenticationManager authenticationManager;
    private final JwtTokenProvider jwtTokenProvider;
    private final UserRepository userRepository;
    private final AuditService auditService;

    @Value("${app.jwt.access-token-expiry-ms}")
    private long accessTokenExpiryMs;

    @Transactional
    public LoginResponse login(LoginRequest request, String ipAddress) {
        try {
            Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getUsername(), request.getPassword())
            );

            UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
            String accessToken  = jwtTokenProvider.generateAccessToken(authentication);
            String refreshToken = jwtTokenProvider.generateRefreshToken(principal.getUsername());

            // Update last login
            userRepository.updateLastLogin(principal.getId(), Instant.now());

            auditService.log(principal.getId(), principal.getTenantId(), "USER_LOGIN",
                "User", String.valueOf(principal.getId()), "Login from " + ipAddress, ipAddress, null);

            User user = userRepository.findById(principal.getId()).orElseThrow();

            return LoginResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .tokenType("Bearer")
                .expiresIn(accessTokenExpiryMs / 1000)
                .username(user.getUsername())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .userId(user.getId())
                .tenantId(user.getTenant() != null ? user.getTenant().getId() : null)
                .build();

        } catch (BadCredentialsException e) {
            log.warn("Failed login attempt for user: {}", request.getUsername());
            throw new UnauthorizedException("Invalid credentials");
        }
    }
}
