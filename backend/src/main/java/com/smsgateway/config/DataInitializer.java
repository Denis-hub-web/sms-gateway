package com.smsgateway.config;

import com.smsgateway.entity.Role;
import com.smsgateway.entity.Tenant;
import com.smsgateway.entity.User;
import com.smsgateway.repository.GatewayRepository;
import com.smsgateway.repository.RoleRepository;
import com.smsgateway.repository.TenantRepository;
import com.smsgateway.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.Set;

@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final TenantRepository tenantRepository;
    private final RoleRepository roleRepository;
    private final GatewayRepository gatewayRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    @Transactional
    public void run(String... args) {
        log.info("Checking & seeding default system Admin account...");

        Tenant defaultTenant = tenantRepository.findById(1L).orElseGet(() -> {
            Tenant t = new Tenant();
            t.setName("Default Tenant");
            t.setApiKey("default-api-key-change-this-in-production");
            t.setDescription("Default system tenant");
            return tenantRepository.save(t);
        });

        Role roleAdmin = roleRepository.findByName("ROLE_ADMIN").orElseGet(() -> {
            Role r = new Role();
            r.setName("ROLE_ADMIN");
            return roleRepository.save(r);
        });

        Role roleUser = roleRepository.findByName("ROLE_USER").orElseGet(() -> {
            Role r = new Role();
            r.setName("ROLE_USER");
            return roleRepository.save(r);
        });

        Set<Role> adminRoles = new HashSet<>();
        adminRoles.add(roleAdmin);
        adminRoles.add(roleUser);

        User adminUser = userRepository.findByUsername("admin").orElseGet(() -> {
            User u = new User();
            u.setUsername("admin");
            u.setEmail("admin@smsgateway.com");
            u.setFullName("System Administrator");
            return u;
        });

        adminUser.setTenant(defaultTenant);
        adminUser.setActive(true);
        adminUser.setRoles(adminRoles);
        adminUser.setPasswordHash(passwordEncoder.encode("Admin@123"));

        userRepository.save(adminUser);
        log.info("✅ Super-Admin user ('admin' / 'Admin@123') verified and active.");

        // Print all users in database & set all school accounts password to School12345
        userRepository.findAll().forEach(u -> {
            log.info("DB User -> ID: {}, Username: '{}', Email: '{}', Active: {}", u.getId(), u.getUsername(), u.getEmail(), u.getActive());
            if (!"admin".equalsIgnoreCase(u.getUsername())) {
                if (u.getEmail() != null && u.getEmail().toLowerCase().contains("ispaceventure")) {
                    u.setUsername("ispaceventure");
                }
                u.setPasswordHash(passwordEncoder.encode("School12345"));
                u.setActive(true);
                userRepository.save(u);
                log.info("✅ Verified school account -> Username: '{}', Email: '{}', Password: 'School12345'", u.getUsername(), u.getEmail());
                
                // Re-bind any gateway registered by this user to this user's tenant
                if (u.getTenant() != null) {
                    gatewayRepository.findAll().forEach(g -> {
                        if (g.getUser() != null && g.getUser().getId().equals(u.getId())) {
                            g.setTenant(u.getTenant());
                            gatewayRepository.save(g);
                            log.info("Re-bound gateway '{}' to tenant '{}'", g.getGatewayUid(), u.getTenant().getSchoolName());
                        }
                    });
                }
            }
        });
    }
}
