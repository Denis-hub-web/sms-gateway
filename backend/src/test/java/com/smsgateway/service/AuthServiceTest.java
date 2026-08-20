package com.smsgateway.service;

import com.smsgateway.dto.request.LoginRequest;
import com.smsgateway.dto.response.LoginResponse;
import com.smsgateway.entity.User;
import com.smsgateway.exception.UnauthorizedException;
import com.smsgateway.repository.UserRepository;
import com.smsgateway.security.JwtTokenProvider;
import com.smsgateway.security.UserPrincipal;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;

import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock AuthenticationManager authenticationManager;
    @Mock JwtTokenProvider jwtTokenProvider;
    @Mock UserRepository userRepository;
    @Mock AuditService auditService;

    @InjectMocks AuthService authService;

    @Test
    void login_success_returnsTokens() {
        // Arrange
        LoginRequest req = new LoginRequest();
        req.setUsername("admin");
        req.setPassword("Admin@123");

        User user = new User();
        user.setId(1L);
        user.setUsername("admin");
        user.setEmail("admin@test.com");
        user.setPasswordHash("$2a$12$...");
        user.setActive(true);
        user.setRoles(Set.of());

        UserPrincipal principal = new UserPrincipal(user);
        Authentication auth = new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());

        when(authenticationManager.authenticate(any())).thenReturn(auth);
        when(jwtTokenProvider.generateAccessToken(any())).thenReturn("access-token");
        when(jwtTokenProvider.generateRefreshToken(any())).thenReturn("refresh-token");
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        doNothing().when(userRepository).updateLastLogin(anyLong(), any());
        doNothing().when(auditService).log(any(), any(), any(), any(), any(), any(), any(), any());

        // Act
        LoginResponse response = authService.login(req, "127.0.0.1");

        // Assert
        assertThat(response.getAccessToken()).isEqualTo("access-token");
        assertThat(response.getRefreshToken()).isEqualTo("refresh-token");
        assertThat(response.getUsername()).isEqualTo("admin");
    }

    @Test
    void login_wrongPassword_throwsUnauthorized() {
        LoginRequest req = new LoginRequest();
        req.setUsername("admin");
        req.setPassword("wrong");

        when(authenticationManager.authenticate(any()))
            .thenThrow(new BadCredentialsException("Bad credentials"));

        assertThatThrownBy(() -> authService.login(req, "127.0.0.1"))
            .isInstanceOf(UnauthorizedException.class)
            .hasMessageContaining("Invalid credentials");
    }
}
