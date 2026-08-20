package com.smsgateway.controller;

import com.smsgateway.dto.request.SchoolRegistrationRequest;
import com.smsgateway.entity.Gateway;
import com.smsgateway.entity.Role;
import com.smsgateway.entity.Tenant;
import com.smsgateway.entity.User;
import com.smsgateway.repository.GatewayRepository;
import com.smsgateway.repository.RoleRepository;
import com.smsgateway.repository.TenantRepository;
import com.smsgateway.repository.UserRepository;
import com.smsgateway.security.UserPrincipal;
import com.smsgateway.service.ApiKeyService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

import static java.util.Map.entry;

@RestController
@RequestMapping("/api/school")
@RequiredArgsConstructor
@Tag(name = "School Portal", description = "School registration, custom pricing & subscription management")
public class SchoolController {

    private final TenantRepository  tenantRepository;
    private final UserRepository    userRepository;
    private final RoleRepository    roleRepository;
    private final GatewayRepository gatewayRepository;
    private final PasswordEncoder   passwordEncoder;
    private final ApiKeyService     apiKeyService;

    /**
     * Public endpoint — schools self-register.
     * Prices are NOT selected by school — Admin sets custom pricing upon review.
     */
    @PostMapping("/register")
    @Operation(summary = "School self-registration")
    public ResponseEntity<?> register(@Valid @RequestBody SchoolRegistrationRequest req) {

        if (userRepository.existsByEmail(req.getEmail())) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("message", "An account with this email already exists."));
        }

        String schoolCode = generateSchoolCode(req.getRegion());
        String tempApiKey = UUID.randomUUID().toString().replace("-", "");

        Tenant tenant = new Tenant();
        tenant.setName(req.getSchoolName());
        tenant.setApiKey(tempApiKey);
        tenant.setSchoolName(req.getSchoolName());
        tenant.setSchoolCode(schoolCode);
        tenant.setSchoolType(req.getSchoolType() != null ? req.getSchoolType() : "PRIVATE");
        tenant.setRegion(req.getRegion());
        tenant.setStudentCount(req.getStudentCount());
        tenant.setContactEmail(req.getEmail());
        tenant.setContactPhone(req.getPhone());
        tenant.setSubscriptionPlan("CUSTOM");
        tenant.setAgreedMonthlyPriceTzs(25000); // Initial default — Admin updates upon approval
        tenant.setAgreedSetupFeeTzs(150000);   // Initial default — Admin updates upon approval
        tenant.setSubscriptionStatus("INACTIVE");
        tenant.setSetupFeePaid(false);
        tenant.setApprovedByAdmin(false);
        tenant.setActive(false);
        tenant.setRateLimit(60);

        tenant = tenantRepository.save(tenant);

        // Auto-generate REAL sk_live_... REST API Key
        String liveApiKey = "sk_live_" + tempApiKey;
        try {
            var keyResp = apiKeyService.createApiKey(tenant.getId(), "School Default Key", null);
            if (keyResp != null && keyResp.getRawApiKey() != null) {
                liveApiKey = keyResp.getRawApiKey();
            }
        } catch (Exception e) {
            // Fallback
        }

        tenant.setApiKey(liveApiKey);
        tenantRepository.save(tenant);

        Role userRole = roleRepository.findByName("ROLE_USER").orElse(null);
        Set<Role> roles = new HashSet<>();
        if (userRole != null) roles.add(userRole);

        User adminUser = new User();
        adminUser.setUsername(req.getEmail());
        adminUser.setEmail(req.getEmail());
        adminUser.setFullName(req.getAdminName());
        adminUser.setPasswordHash(passwordEncoder.encode(req.getPassword()));
        adminUser.setTenant(tenant);
        adminUser.setActive(false);
        adminUser.setRoles(roles);

        userRepository.save(adminUser);

        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                "message", "School registered successfully! Admin will assign your custom subscription rate.",
                "schoolCode", schoolCode,
                "apiKey", liveApiKey
        ));
    }

    /**
     * Public endpoint returning subscription plans metadata
     */
    @GetMapping("/plans")
    @Operation(summary = "Get subscription plans metadata")
    public ResponseEntity<?> getPlans() {
        return ResponseEntity.ok(Map.of(
                "CUSTOM", Map.of("name", "Custom School Package", "description", "Tailored subscription & setup fee per school")
        ));
    }

    /**
     * Public endpoint to look up school identity by schoolCode or tenantId (for Results Dispatcher identification)
     */
    @GetMapping("/info-by-code/{code}")
    @Operation(summary = "Public lookup of school identity by school code")
    public ResponseEntity<?> getSchoolInfoByCode(@PathVariable String code) {
        Tenant tenant = tenantRepository.findAll().stream()
                .filter(t -> code.equalsIgnoreCase(t.getSchoolCode()) || code.equals(String.valueOf(t.getId())))
                .findFirst()
                .orElse(null);

        if (tenant == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "School not found for code: " + code));
        }

        return ResponseEntity.ok(Map.of(
                "tenantId", tenant.getId(),
                "schoolName", nvl(tenant.getSchoolName(), tenant.getName()),
                "schoolCode", nvl(tenant.getSchoolCode(), ""),
                "region", nvl(tenant.getRegion(), ""),
                "schoolType", nvl(tenant.getSchoolType(), "PRIVATE"),
                "apiKey", nvl(tenant.getApiKey(), ""),
                "subscriptionStatus", nvl(tenant.getSubscriptionStatus(), "INACTIVE"),
                "approvedByAdmin", Boolean.TRUE.equals(tenant.getApprovedByAdmin())
        ));
    }

    /**
     * Authenticated — returns current school's tenant info & custom subscription pricing.
     */
    @GetMapping("/me")
    @Operation(summary = "Get current school info, API key & custom pricing")
    public ResponseEntity<?> getMySchool(@AuthenticationPrincipal UserPrincipal principal) {
        if (principal == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Not authenticated"));
        }

        User user = userRepository.findById(principal.getId()).orElse(null);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "User not found"));
        }

        if (user.getTenant() == null) {
            return ResponseEntity.ok(Map.ofEntries(
                    entry("id", (Object) 0L),
                    entry("name", "School Notify Admin"),
                    entry("schoolName", "School Notify Admin"),
                    entry("schoolCode", "ADMIN"),
                    entry("schoolType", "ADMIN"),
                    entry("region", ""),
                    entry("apiKey", "sk_live_admin_master_key"),
                    entry("subscriptionStatus", "ACTIVE"),
                    entry("subscriptionPlan", "CUSTOM"),
                    entry("agreedMonthlyPriceTzs", 0),
                    entry("agreedSetupFeeTzs", 0),
                    entry("daysRemaining", 999),
                    entry("setupFeePaid", true),
                    entry("approvedByAdmin", true),
                    entry("adminName", nvl(user.getFullName(), user.getUsername()))
            ));
        }

        Tenant t = user.getTenant();

        // Calculate days remaining in subscription
        long daysRemaining = 0;
        if (t.getSubscriptionExpiresAt() != null && t.getSubscriptionExpiresAt().isAfter(Instant.now())) {
            daysRemaining = ChronoUnit.DAYS.between(Instant.now(), t.getSubscriptionExpiresAt());
        }

        return ResponseEntity.ok(Map.ofEntries(
                entry("id",                   (Object) t.getId()),
                entry("name",                 nvl(t.getName(), "")),
                entry("schoolName",           nvl(t.getSchoolName(), t.getName())),
                entry("schoolCode",           nvl(t.getSchoolCode(), "")),
                entry("schoolType",           nvl(t.getSchoolType(), "PRIVATE")),
                entry("region",               nvl(t.getRegion(), "")),
                entry("apiKey",               nvl(t.getApiKey(), "sk_live_pending")),
                entry("contactPhone",         nvl(t.getContactPhone(), "")),
                entry("contactEmail",         nvl(t.getContactEmail(), "")),
                entry("studentCount",         t.getStudentCount() != null ? t.getStudentCount() : 0),
                entry("subscriptionPlan",     nvl(t.getSubscriptionPlan(), "CUSTOM")),
                entry("agreedMonthlyPriceTzs", t.getAgreedMonthlyPriceTzs() != null ? t.getAgreedMonthlyPriceTzs() : 25000),
                entry("agreedSetupFeeTzs",     t.getAgreedSetupFeeTzs() != null ? t.getAgreedSetupFeeTzs() : 150000),
                entry("daysRemaining",         daysRemaining),
                entry("subscriptionStatus",   nvl(t.getSubscriptionStatus(), "INACTIVE")),
                entry("subscriptionExpiresAt", t.getSubscriptionExpiresAt() != null ? t.getSubscriptionExpiresAt().toString() : ""),
                entry("setupFeePaid",         Boolean.TRUE.equals(t.getSetupFeePaid())),
                entry("approvedByAdmin",      Boolean.TRUE.equals(t.getApprovedByAdmin())),
                entry("adminName",            nvl(user.getFullName(), user.getUsername()))
        ));
    }

    // ── Super-Admin: List All Schools ─────────────────────────
    @GetMapping("/admin/all")
    @Operation(summary = "Super-admin: list all registered schools")
    public ResponseEntity<?> listAllSchools() {
        List<Map<String, Object>> result = new ArrayList<>();
        for (Tenant t : tenantRepository.findAll()) {
            if (t.getSchoolName() == null) continue;

            long daysRemaining = 0;
            if (t.getSubscriptionExpiresAt() != null && t.getSubscriptionExpiresAt().isAfter(Instant.now())) {
                daysRemaining = ChronoUnit.DAYS.between(Instant.now(), t.getSubscriptionExpiresAt());
            }

            // Find the school's primary login user
            User primaryUser = userRepository.findAll().stream()
                    .filter(u -> u.getTenant() != null && u.getTenant().getId().equals(t.getId()))
                    .findFirst()
                    .orElse(null);

            String loginUsername = primaryUser != null ? primaryUser.getUsername() : "";
            String loginEmail    = primaryUser != null ? primaryUser.getEmail() : nvl(t.getContactEmail(), "");

            // Find all gateway devices connected to this school tenant
            List<Gateway> gateways = gatewayRepository.findByTenantId(t.getId());
            List<Map<String, Object>> gwList = new ArrayList<>();
            for (Gateway g : gateways) {
                Map<String, Object> gwMap = new LinkedHashMap<>();
                gwMap.put("id", g.getId());
                gwMap.put("displayName", nvl(g.getDisplayName(), g.getDeviceName()));
                gwMap.put("deviceName", nvl(g.getDeviceName(), "Android Phone"));
                gwMap.put("gatewayUid", nvl(g.getGatewayUid(), ""));
                gwMap.put("status", g.getStatus() != null ? g.getStatus().name() : "OFFLINE");
                gwMap.put("phoneNumber", nvl(g.getPhoneNumber(), ""));
                gwMap.put("batteryLevel", g.getBatteryLevel() != null ? g.getBatteryLevel() : 0);
                gwMap.put("signalStrength", g.getSignalStrength() != null ? g.getSignalStrength() : 0);
                gwMap.put("lastHeartbeat", g.getLastHeartbeat() != null ? g.getLastHeartbeat().toString() : "");
                gwList.add(gwMap);
            }

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id",                    t.getId());
            row.put("schoolName",            nvl(t.getSchoolName(), t.getName()));
            row.put("schoolCode",            nvl(t.getSchoolCode(), ""));
            row.put("schoolType",            nvl(t.getSchoolType(), ""));
            row.put("region",                nvl(t.getRegion(), ""));
            row.put("apiKey",                nvl(t.getApiKey(), ""));
            row.put("loginUsername",         loginUsername);
            row.put("loginEmail",            loginEmail);
            row.put("contactEmail",          nvl(t.getContactEmail(), ""));
            row.put("contactPhone",          nvl(t.getContactPhone(), ""));
            row.put("studentCount",          t.getStudentCount() != null ? t.getStudentCount() : 0);
            row.put("subscriptionPlan",      nvl(t.getSubscriptionPlan(), "CUSTOM"));
            row.put("agreedMonthlyPriceTzs", t.getAgreedMonthlyPriceTzs() != null ? t.getAgreedMonthlyPriceTzs() : 25000);
            row.put("agreedSetupFeeTzs",     t.getAgreedSetupFeeTzs() != null ? t.getAgreedSetupFeeTzs() : 150000);
            row.put("daysRemaining",         daysRemaining);
            row.put("subscriptionStatus",    nvl(t.getSubscriptionStatus(), "INACTIVE"));
            row.put("subscriptionExpiresAt", t.getSubscriptionExpiresAt() != null ? t.getSubscriptionExpiresAt().toString() : "");
            row.put("setupFeePaid",          Boolean.TRUE.equals(t.getSetupFeePaid()));
            row.put("approvedByAdmin",       Boolean.TRUE.equals(t.getApprovedByAdmin()));
            row.put("active",                Boolean.TRUE.equals(t.getActive()));
            row.put("createdAt",             t.getCreatedAt() != null ? t.getCreatedAt().toString() : "");
            row.put("gateways",              gwList);
            result.add(row);
        }
        return ResponseEntity.ok(result);
    }

    // ── Admin: Set Custom Price for a School ──────────────────
    @PostMapping("/admin/custom-price/{tenantId}")
    @Operation(summary = "Super-admin: set custom monthly price & setup fee for a school")
    public ResponseEntity<?> setCustomPrice(
            @PathVariable Long tenantId,
            @RequestParam int monthlyPriceTzs,
            @RequestParam int setupFeeTzs
    ) {
        Tenant t = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new RuntimeException("School not found"));

        t.setAgreedMonthlyPriceTzs(monthlyPriceTzs);
        t.setAgreedSetupFeeTzs(setupFeeTzs);
        tenantRepository.save(t);

        return ResponseEntity.ok(Map.of(
                "message", "Custom pricing updated for " + t.getSchoolName(),
                "agreedMonthlyPriceTzs", monthlyPriceTzs,
                "agreedSetupFeeTzs", setupFeeTzs
        ));
    }

    // ── Admin: Approve School ──────────────────────────────────
    @PostMapping("/admin/approve/{tenantId}")
    public ResponseEntity<?> approveSchool(
            @PathVariable Long tenantId,
            @RequestParam(defaultValue = "30") int days
    ) {
        Tenant t = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new RuntimeException("School not found"));

        t.setApprovedByAdmin(true);
        t.setActive(true);
        t.setSubscriptionStatus("ACTIVE");
        t.setApprovedAt(Instant.now());
        t.setSubscriptionExpiresAt(Instant.now().plus(days, ChronoUnit.DAYS));

        userRepository.findAll().stream()
                .filter(u -> u.getTenant() != null && u.getTenant().getId().equals(tenantId))
                .forEach(u -> { u.setActive(true); userRepository.save(u); });

        tenantRepository.save(t);
        return ResponseEntity.ok(Map.of(
                "message", "School approved and activated for " + days + " days!",
                "schoolCode", nvl(t.getSchoolCode(), ""),
                "daysRemaining", days
        ));
    }

    // ── Admin: Extend / Renew Subscription by Days ────────────
    @PostMapping("/admin/renew/{tenantId}")
    @Operation(summary = "Super-admin: extend subscription by N days (30, 60, 90, 180, 365)")
    public ResponseEntity<?> renewSubscription(
            @PathVariable Long tenantId,
            @RequestParam(defaultValue = "30") int days
    ) {
        Tenant t = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new RuntimeException("School not found"));

        Instant base = (t.getSubscriptionExpiresAt() != null && t.getSubscriptionExpiresAt().isAfter(Instant.now()))
                ? t.getSubscriptionExpiresAt() : Instant.now();

        t.setSubscriptionStatus("ACTIVE");
        t.setSubscriptionExpiresAt(base.plus(days, ChronoUnit.DAYS));
        t.setActive(true);

        long totalDaysRemaining = ChronoUnit.DAYS.between(Instant.now(), t.getSubscriptionExpiresAt());

        tenantRepository.save(t);
        return ResponseEntity.ok(Map.of(
                "message", "Added +" + days + " days to subscription.",
                "totalDaysRemaining", totalDaysRemaining,
                "expiresAt", t.getSubscriptionExpiresAt().toString()
        ));
    }

    // ── Admin: Pause / Resume Subscription ─────────────────────
    @PostMapping("/admin/pause/{tenantId}")
    public ResponseEntity<?> pauseSubscription(@PathVariable Long tenantId) {
        Tenant t = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new RuntimeException("School not found"));
        t.setSubscriptionStatus("SUSPENDED");
        t.setActive(false);
        tenantRepository.save(t);
        return ResponseEntity.ok(Map.of("message", "Subscription paused/suspended for " + t.getSchoolName()));
    }

    @PostMapping("/admin/resume/{tenantId}")
    public ResponseEntity<?> resumeSubscription(@PathVariable Long tenantId) {
        Tenant t = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new RuntimeException("School not found"));
        t.setSubscriptionStatus("ACTIVE");
        t.setActive(true);
        tenantRepository.save(t);
        return ResponseEntity.ok(Map.of("message", "Subscription resumed for " + t.getSchoolName()));
    }

    // ── Admin: Mark Setup Fee Paid ─────────────────────────────
    @PostMapping("/admin/setup-fee-paid/{tenantId}")
    public ResponseEntity<?> markSetupFeePaid(@PathVariable Long tenantId) {
        Tenant t = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new RuntimeException("School not found"));
        t.setSetupFeePaid(true);
        tenantRepository.save(t);
        return ResponseEntity.ok(Map.of("message", "Setup fee marked as paid."));
    }

    // ── Admin: Reset School Password ───────────────────────────
    @PostMapping("/admin/reset-password/{tenantId}")
    @Operation(summary = "Super-admin: set a new password for a school's login account")
    public ResponseEntity<?> resetSchoolPassword(
            @PathVariable Long tenantId,
            @RequestParam String newPassword
    ) {
        Tenant t = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new RuntimeException("School not found"));

        User schoolUser = userRepository.findAll().stream()
                .filter(u -> u.getTenant() != null && u.getTenant().getId().equals(tenantId))
                .findFirst()
                .orElseThrow(() -> new RuntimeException("No user found for this school"));

        schoolUser.setPasswordHash(passwordEncoder.encode(newPassword));
        schoolUser.setActive(true);
        userRepository.save(schoolUser);

        t.setActive(true);
        if (!Boolean.TRUE.equals(t.getApprovedByAdmin())) {
            t.setApprovedByAdmin(true);
            t.setSubscriptionStatus("ACTIVE");
            t.setApprovedAt(Instant.now());
            t.setSubscriptionExpiresAt(Instant.now().plus(30, java.time.temporal.ChronoUnit.DAYS));
        }
        tenantRepository.save(t);

        return ResponseEntity.ok(Map.of(
                "message", "Password reset & account activated for " + nvl(t.getSchoolName(), t.getName()),
                "email", schoolUser.getEmail(),
                "schoolName", nvl(t.getSchoolName(), t.getName())
        ));
    }

    // ── Admin: Direct School Account Creation ──────────────────
    @PostMapping("/admin/create")
    @Operation(summary = "Super-admin: create a new pre-approved school account directly")
    public ResponseEntity<?> createSchoolByAdmin(@RequestBody Map<String, Object> req) {
        String schoolName = (String) req.get("schoolName");
        if (schoolName == null || schoolName.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "School name is required"));
        }

        String email = (String) req.get("email");
        if (email == null || email.isBlank()) {
            email = schoolName.toLowerCase().replaceAll("[^a-z0-9]", "") + "@school.tz";
        }

        String rawUsername = (String) req.get("username");
        String username = (rawUsername != null && !rawUsername.isBlank())
                ? rawUsername.trim().toLowerCase()
                : schoolName.toLowerCase().replaceAll("[^a-z0-9]", "");

        if (username.isBlank()) username = "school" + System.currentTimeMillis() % 10000;

        String phone = req.get("phone") != null ? ((String) req.get("phone")).trim() : "";
        String region = req.get("region") != null ? ((String) req.get("region")).trim() : "Dar es Salaam";
        String schoolType = req.get("schoolType") != null ? ((String) req.get("schoolType")).trim() : "SECONDARY";
        String initialPassword = req.get("password") != null && !((String) req.get("password")).isBlank()
                ? ((String) req.get("password")).trim()
                : "School12345";

        int daysActive = 30;
        if (req.get("daysActive") != null) {
            try {
                daysActive = Integer.parseInt(req.get("daysActive").toString());
            } catch (Exception ignored) {}
        }

        String schoolCode = generateSchoolCode(region);
        String tempApiKey = UUID.randomUUID().toString().replace("-", "");

        Tenant tenant = new Tenant();
        tenant.setName(schoolName);
        tenant.setSchoolName(schoolName);
        tenant.setSchoolCode(schoolCode);
        tenant.setSchoolType(schoolType);
        tenant.setRegion(region);
        tenant.setContactEmail(email);
        tenant.setContactPhone(phone);
        tenant.setApiKey(tempApiKey);
        tenant.setSubscriptionPlan("CUSTOM");
        tenant.setAgreedMonthlyPriceTzs(25000);
        tenant.setAgreedSetupFeeTzs(150000);
        tenant.setSubscriptionStatus("ACTIVE");
        tenant.setSetupFeePaid(true);
        tenant.setApprovedByAdmin(true);
        tenant.setApprovedAt(Instant.now());
        tenant.setActive(true);
        tenant.setSubscriptionExpiresAt(Instant.now().plus(daysActive, ChronoUnit.DAYS));

        tenant = tenantRepository.save(tenant);

        // Auto-generate REAL sk_live_ API Key
        String liveApiKey = "sk_live_" + tempApiKey;
        try {
            var keyResp = apiKeyService.createApiKey(tenant.getId(), "School Default Key", null);
            if (keyResp != null && keyResp.getRawApiKey() != null) {
                liveApiKey = keyResp.getRawApiKey();
            }
        } catch (Exception ignored) {}

        tenant.setApiKey(liveApiKey);
        tenantRepository.save(tenant);

        Role userRole = roleRepository.findByName("ROLE_USER").orElse(null);
        Set<Role> roles = new HashSet<>();
        if (userRole != null) roles.add(userRole);

        User schoolUser = new User();
        schoolUser.setUsername(username);
        schoolUser.setEmail(email);
        schoolUser.setFullName(schoolName + " Admin");
        schoolUser.setPasswordHash(passwordEncoder.encode(initialPassword));
        schoolUser.setTenant(tenant);
        schoolUser.setActive(true);
        schoolUser.setRoles(roles);

        userRepository.save(schoolUser);

        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                "message", "School account '" + schoolName + "' created successfully!",
                "schoolId", tenant.getId(),
                "schoolCode", schoolCode,
                "loginUsername", username,
                "loginPassword", initialPassword,
                "apiKey", liveApiKey
        ));
    }

    // ── Admin: Update School Contact Phone ────────────────────
    @PostMapping("/admin/update-phone/{tenantId}")
    @Operation(summary = "Super-admin: update contact phone number for a school")
    public ResponseEntity<?> updateSchoolPhone(
            @PathVariable Long tenantId,
            @RequestParam(required = false, defaultValue = "") String phone
    ) {
        Tenant t = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new RuntimeException("School not found"));
        t.setContactPhone(phone != null ? phone.trim() : "");
        tenantRepository.save(t);
        return ResponseEntity.ok(Map.of(
                "message", "Phone number updated for " + nvl(t.getSchoolName(), t.getName()),
                "phone", nvl(t.getContactPhone(), "")
        ));
    }

    // ── Helpers ────────────────────────────────────────────────
    private String generateSchoolCode(String region) {
        String prefix = (region != null && !region.isBlank())
                ? region.substring(0, Math.min(3, region.length())).toUpperCase()
                : "SCH";
        return prefix + "-" + String.valueOf(System.currentTimeMillis()).substring(8);
    }

    private String nvl(String val, String fallback) {
        return (val != null && !val.isBlank()) ? val : fallback;
    }
}
