package com.smsgateway.security;

import com.smsgateway.entity.User;
import com.smsgateway.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        String clean = username != null ? username.trim() : "";
        User user = userRepository.findByUsernameIgnoreCase(clean)
            .or(() -> userRepository.findByEmailIgnoreCase(clean))
            .or(() -> userRepository.findByUsername(clean))
            .or(() -> userRepository.findByEmail(clean))
            .orElseThrow(() -> new UsernameNotFoundException("User not found: " + username));
        return new UserPrincipal(user);
    }
}
