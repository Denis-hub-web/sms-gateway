/**
 * School Notify Portal — JavaScript Core
 * Handles: login, registration, dashboard telemetry, plan renewals
 */

const PORTAL_API = localStorage.getItem('portalApiUrl') || (window.location.port === '8080' ? window.location.origin : 'https://sms-gateway-qtmi.onrender.com');
let selectedPlan = 'STARTER';

// ── On Page Load ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const page = detectPage();

    if (page === 'dashboard') {
        const token = getToken();
        if (!token) return redirectToLogin();
        initDashboard();
    }

    if (page === 'login') {
        if (getToken()) window.location.href = 'dashboard.html';
    }
});

function detectPage() {
    const path = window.location.pathname;
    if (path.includes('dashboard')) return 'dashboard';
    if (path.includes('login'))    return 'login';
    if (path.includes('register')) return 'register';
    return 'other';
}

function getToken()    { return localStorage.getItem('schoolToken'); }
function getTenant()   { return JSON.parse(localStorage.getItem('schoolTenant') || 'null'); }
function redirectToLogin() { window.location.href = 'login.html'; }

// ── Plan Selection ───────────────────────────────────────────
function selectPlan(plan, el) {
    selectedPlan = plan;
    document.querySelectorAll('.plan-card').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
}

// ── Toggle Password Visibility ───────────────────────────────
function togglePassword() {
    const inp = document.getElementById('loginPassword');
    const eye = document.getElementById('eyeIcon');
    if (inp.type === 'password') {
        inp.type = 'text';
        if (eye) eye.setAttribute('data-lucide', 'eye-off');
    } else {
        inp.type = 'password';
        if (eye) eye.setAttribute('data-lucide', 'eye');
    }
    if (window.lucide) lucide.createIcons();
}

// ── Registration ─────────────────────────────────────────────
async function handleRegister() {
    const btn = document.getElementById('registerBtn');
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader" class="spin-icon"></i> Submitting Registration...';
    if (window.lucide) lucide.createIcons();

    hideAlert('formError');

    const password = document.getElementById('password').value;
    const confirm  = document.getElementById('confirmPassword').value;

    if (password !== confirm) {
        showAlert('formError', '<i data-lucide="x-circle" class="alert-icon"></i> Passwords do not match.', 'danger');
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="send"></i> Submit School Registration';
        if (window.lucide) lucide.createIcons();
        return;
    }

    const payload = {
        schoolName:   document.getElementById('schoolName').value.trim(),
        schoolType:   document.getElementById('schoolType').value,
        region:       document.getElementById('region').value,
        studentCount: parseInt(document.getElementById('studentCount').value),
        adminName:    document.getElementById('adminName').value.trim(),
        email:        document.getElementById('adminEmail').value.trim(),
        phone:        document.getElementById('adminPhone').value.trim(),
        password:     password,
        plan:         selectedPlan
    };

    try {
        const res = await fetch(`${PORTAL_API}/api/school/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ message: res.statusText }));
            throw new Error(err.message || `HTTP ${res.status}`);
        }

        const data = await res.json();

        // Populate Next Steps summary card
        if (document.getElementById('regSchoolCode'))  document.getElementById('regSchoolCode').textContent = data.schoolCode || 'SCH-001';
        if (document.getElementById('regLockedPrice')) document.getElementById('regLockedPrice').textContent = `TZS ${Number(data.agreedMonthlyPriceTzs || 25000).toLocaleString()} / mo`;
        if (document.getElementById('regApiKey'))      document.getElementById('regApiKey').textContent = data.apiKey || 'sk_live_...';

        document.getElementById('registerForm').style.display = 'none';
        document.getElementById('successMsg').style.display = 'block';
        if (window.lucide) lucide.createIcons();

    } catch (e) {
        showAlert('formError', `<i data-lucide="x-circle" class="alert-icon"></i> Registration failed: ${e.message}`, 'danger');
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="send"></i> Submit School Registration';
        if (window.lucide) lucide.createIcons();
    }
}

// ── Login ────────────────────────────────────────────────────
async function handleLogin() {
    const btn = document.getElementById('loginBtn');
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader" class="spin-icon"></i> Signing in to School Notify...';
    if (window.lucide) lucide.createIcons();

    hideAlert('alertError');
    hideAlert('alertPending');
    hideAlert('alertExpired');
    hideAlert('alertSuspended');

    try {
        const res = await fetch(`${PORTAL_API}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: document.getElementById('loginEmail').value.trim(),
                password: document.getElementById('loginPassword').value
            })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ message: res.statusText }));
            throw new Error(err.message || 'Invalid credentials');
        }

        const data = await res.json();

        localStorage.setItem('schoolToken', data.accessToken);
        localStorage.setItem('schoolRefreshToken', data.refreshToken || '');

        // Fetch tenant info to check subscription status
        const meRes = await fetch(`${PORTAL_API}/api/school/me`, {
            headers: { 'Authorization': `Bearer ${data.accessToken}` }
        });

        if (meRes.ok) {
            const tenant = await meRes.json();
            localStorage.setItem('schoolTenant', JSON.stringify(tenant));

            if (tenant.subscriptionStatus === 'INACTIVE' && !tenant.approvedByAdmin) {
                hideAll();
                document.getElementById('alertPending').style.display = 'flex';
                btn.disabled = false;
                btn.innerHTML = '<i data-lucide="log-in"></i> Sign In to Dashboard';
                if (window.lucide) lucide.createIcons();
                return;
            }

            if (tenant.subscriptionStatus === 'SUSPENDED') {
                hideAll();
                document.getElementById('alertSuspended').style.display = 'flex';
                btn.disabled = false;
                btn.innerHTML = '<i data-lucide="log-in"></i> Sign In to Dashboard';
                if (window.lucide) lucide.createIcons();
                return;
            }
        }

        window.location.href = 'dashboard.html';

    } catch (e) {
        showAlert('alertError', `<i data-lucide="alert-circle" class="alert-icon"></i> ${e.message}`, 'danger');
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="log-in"></i> Sign In to Dashboard';
        if (window.lucide) lucide.createIcons();
    }
}

// ── Dashboard Initialization ─────────────────────────────────
async function initDashboard() {
    const token = getToken();

    try {
        const meRes = await fetch(`${PORTAL_API}/api/school/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!meRes.ok) return redirectToLogin();

        const tenant = await meRes.json();
        localStorage.setItem('schoolTenant', JSON.stringify(tenant));

        applyTenantToUI(tenant);
        await loadDashboardStats(token, tenant);
        await loadGatewayInfo(token);

        if (window.lucide) lucide.createIcons();

    } catch (e) {
        console.error('Dashboard init failed:', e);
    }

    // Load dynamic pricing from backend
    loadDynamicPlans();
}

async function loadDynamicPlans() {
    try {
        const res = await fetch(`${PORTAL_API}/api/school/plans`);
        if (!res.ok) return;
        const plans = await res.json();

        // Update pricing cards if present
        if (plans.STARTER && document.querySelector('#planStarter .compare-plan-price')) {
            document.querySelector('#planStarter .compare-plan-price').innerHTML = `TZS ${Number(plans.STARTER.priceTzs).toLocaleString()}<span>/month</span>`;
        }
        if (plans.STANDARD && document.querySelector('#planStandard .compare-plan-price')) {
            document.querySelector('#planStandard .compare-plan-price').innerHTML = `TZS ${Number(plans.STANDARD.priceTzs).toLocaleString()}<span>/month</span>`;
        }
        if (plans.PREMIUM && document.querySelector('#planPremium .compare-plan-price')) {
            document.querySelector('#planPremium .compare-plan-price').innerHTML = `TZS ${Number(plans.PREMIUM.priceTzs).toLocaleString()}<span>/month</span>`;
        }
    } catch (e) {
        console.warn('Failed to load dynamic plans:', e);
    }
}

function applyTenantToUI(tenant) {
    const schoolName = tenant.schoolName || tenant.name || 'School';
    const initial    = schoolName.charAt(0).toUpperCase();
    const status     = tenant.subscriptionStatus || 'INACTIVE';
    const apiKey     = tenant.apiKey || 'sk_live_pending';

    // Display API Key
    if (document.getElementById('displayApiKey')) {
        document.getElementById('displayApiKey').value = apiKey;
    }

    // User menu
    if (document.getElementById('userSchoolName'))   document.getElementById('userSchoolName').textContent = schoolName;
    if (document.getElementById('userAvatarChar'))   document.getElementById('userAvatarChar').innerHTML = `<i data-lucide="user" class="avatar-icon"></i>`;
    if (document.getElementById('dropdownSchoolName')) document.getElementById('dropdownSchoolName').textContent = schoolName;

    // Welcome heading
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    if (document.getElementById('welcomeHeadline')) document.getElementById('welcomeHeadline').textContent = `${greeting}, ${schoolName}!`;
    if (document.getElementById('welcomeSub'))      document.getElementById('welcomeSub').textContent = `${tenant.region || 'Tanzania'} • ${tenant.schoolType || 'School'} • Code: ${tenant.schoolCode || 'SCH'}`;

    // Subscription badge
    const badge = document.getElementById('subscriptionBadge');
    const badgeText = document.getElementById('subBadgeText');

    if (badge && badgeText) {
        badge.className = 'sub-badge ' + (status === 'ACTIVE' ? 'active' : status === 'EXPIRED' ? 'expired' : 'inactive');
        badgeText.textContent = status === 'ACTIVE'
            ? `${tenant.subscriptionPlan || 'Starter'} Plan · Active`
            : status === 'EXPIRED'
            ? 'Subscription Expired'
            : 'Account Pending Approval';
    }

    // Custom Subscription UI
    const daysLeft = tenant.daysRemaining != null ? tenant.daysRemaining : 0;
    if (document.getElementById('dashDaysRemaining')) {
        document.getElementById('dashDaysRemaining').textContent = `${daysLeft} Days`;
    }
    if (document.getElementById('dashExpiryDate')) {
        document.getElementById('dashExpiryDate').textContent = tenant.subscriptionExpiresAt
            ? `Expires: ${new Date(tenant.subscriptionExpiresAt).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}`
            : 'Account Pending Approval';
    }
    if (document.getElementById('dashMonthlyRate')) {
        document.getElementById('dashMonthlyRate').textContent = `TZS ${Number(tenant.agreedMonthlyPriceTzs || 25000).toLocaleString()}`;
    }
    if (document.getElementById('dashSetupFeeVal')) {
        document.getElementById('dashSetupFeeVal').textContent = `TZS ${Number(tenant.agreedSetupFeeTzs || 150000).toLocaleString()}`;
    }
    if (document.getElementById('dashSetupStatus')) {
        document.getElementById('dashSetupStatus').innerHTML = tenant.setupFeePaid
            ? '<span style="color:var(--gh-green); font-weight:700;">✅ Paid & Verified</span>'
            : '<span style="color:var(--gh-yellow); font-weight:700;">⏳ Pending Payment</span>';
    }

    // Top banners
    if (status === 'EXPIRED' && document.getElementById('bannerExpired'))   document.getElementById('bannerExpired').style.display = 'block';
    if (status === 'INACTIVE' && document.getElementById('bannerPending'))  document.getElementById('bannerPending').style.display = 'block';

    // Subscription status card
    if (document.getElementById('subPlanName')) {
        document.getElementById('subPlanName').textContent = 'Custom School Package';
    }
    if (document.getElementById('subStatusBadge')) {
        const color = status === 'ACTIVE' ? 'var(--gh-green)' : status === 'EXPIRED' ? 'var(--gh-red)' : 'var(--gh-yellow)';
        document.getElementById('subStatusBadge').innerHTML = `<span style="color:${color}; font-weight:800">${status}</span>`;
    }
    if (document.getElementById('subExpiry')) {
        document.getElementById('subExpiry').textContent = tenant.subscriptionExpiresAt
            ? new Date(tenant.subscriptionExpiresAt).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })
            : 'Not set';
    }
    if (document.getElementById('subSetupFee')) {
        document.getElementById('subSetupFee').innerHTML = tenant.setupFeePaid
            ? '<span style="color:var(--gh-green); font-weight:700;"><i data-lucide="check-circle-2" class="inline-icon"></i> Paid & Onboarded</span>'
            : '<span style="color:var(--gh-yellow); font-weight:700;"><i data-lucide="clock" class="inline-icon"></i> Pending Setup</span>';
    }
}

function copyApiKey() {
    const inp = document.getElementById('displayApiKey');
    if (!inp) return;
    navigator.clipboard.writeText(inp.value);
    alert('✅ REST API Key copied to clipboard:\n' + inp.value);
}

function autoLinkApiKey() {
    const inp = document.getElementById('displayApiKey');
    if (!inp || !inp.value) return;
    const key = inp.value;
    localStorage.setItem('cfg_api_key', key);
    alert('⚡ API Key successfully linked to Exam Results Engine!\nKey: ' + key);
}

async function loadDashboardStats(token, tenant) {
    try {
        const res = await fetch(`${PORTAL_API}/api/sms/history?page=0&size=50`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) return;

        const data = await res.json();
        const list = data.content || data || [];

        const total     = list.length;
        const delivered = list.filter(m => m.status === 'DELIVERED' || m.finalStatus === 'DELIVERED').length;
        const failed    = list.filter(m => m.status === 'FAILED' || m.finalStatus === 'FAILED').length;
        const pct       = total > 0 ? Math.round((delivered / total) * 100) : 100;

        if (document.getElementById('kpiTotalSms'))      document.getElementById('kpiTotalSms').textContent = total;
        if (document.getElementById('kpiDelivered'))     document.getElementById('kpiDelivered').textContent = delivered;
        if (document.getElementById('kpiDeliveredPct'))  document.getElementById('kpiDeliveredPct').textContent = `${pct}% success rate`;
        if (document.getElementById('kpiFailed'))        document.getElementById('kpiFailed').textContent = failed;

        // Populate history table
        const tbody = document.getElementById('smsHistoryBody');
        if (tbody) {
            if (!list.length) {
                tbody.innerHTML = '<tr><td colspan="4" class="empty-cell">No SMS messages sent yet. Upload your first exam results sheet!</td></tr>';
                return;
            }
            tbody.innerHTML = list.slice(0, 100).map(m => {
                const st = m.status || m.finalStatus || 'UNKNOWN';
                const color = st === 'DELIVERED' ? 'var(--gh-green)' : st === 'FAILED' ? 'var(--gh-red)' : 'var(--gh-yellow)';
                const icon  = st === 'DELIVERED' ? 'check-circle-2' : st === 'FAILED' ? 'x-circle' : 'zap';
                const preview = (m.message || '').substring(0, 65) + '...';
                return `<tr>
                    <td style="font-family:var(--font-mono); font-size:12px; font-weight:600">${m.phoneNumber || m.phone || '—'}</td>
                    <td style="color:var(--gh-text-muted); font-size:12px">${preview}</td>
                    <td><span style="color:${color}; font-weight:700; font-size:12px; display:inline-flex; align-items:center; gap:4px;"><i data-lucide="${icon}" style="width:14px; height:14px;"></i> ${st}</span></td>
                    <td style="color:var(--gh-text-muted); font-size:12px">${m.createdAt || m.sentAt ? new Date(m.createdAt || m.sentAt).toLocaleString() : '—'}</td>
                </tr>`;
            }).join('');
        }

        if (window.lucide) lucide.createIcons();

    } catch (e) {
        console.warn('Stats load failed:', e);
    }
}

async function loadGatewayInfo(token) {
    try {
        const res = await fetch(`${PORTAL_API}/api/gateway/admin/list`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) return;

        const gateways = await res.json();

        if (document.getElementById('kpiGatewayStatus')) {
            if (gateways.length === 0) {
                document.getElementById('kpiGatewayStatus').textContent = 'Not paired';
                document.getElementById('kpiGatewayPhone').textContent = 'Contact portal team to pair Android device';
            } else {
                const gw = gateways[0];
                document.getElementById('kpiGatewayStatus').innerHTML = gw.status === 'ONLINE'
                    ? '<span style="color:var(--gh-green)">ONLINE</span>'
                    : '<span style="color:var(--gh-text-muted)">OFFLINE</span>';
                document.getElementById('kpiGatewayPhone').textContent = gw.phoneNumber || gw.deviceName || gw.gatewayUid;
            }
        }

        // Gateway section
        const gwContent = document.getElementById('gatewayContent');
        if (gwContent) {
            if (!gateways.length) {
                gwContent.innerHTML = `
                    <div class="gh-card">
                        <div class="card-body" style="text-align:center; padding:48px;">
                            <div style="font-size:48px; margin-bottom:16px; color:var(--gh-blue);"><i data-lucide="smartphone" style="width:48px; height:48px;"></i></div>
                            <h3 style="margin-bottom:8px;">No Gateway Device Paired Yet</h3>
                            <p style="color:var(--gh-text-muted); max-width:420px; margin:0 auto 24px;">Your school's dedicated Android SIM gateway hasn't been configured. Contact School Notify support to schedule on-site setup.</p>
                            <a href="https://wa.me/255700000000" target="_blank" class="btn btn-primary"><i data-lucide="message-circle"></i> Contact School Notify Support</a>
                        </div>
                    </div>`;
            } else {
                gwContent.innerHTML = gateways.map(gw => {
                    const isOnline = gw.status === 'ONLINE';
                    return `
                        <div class="gh-card">
                            <div class="card-header">
                                <div class="card-header-title">
                                    <i data-lucide="smartphone" class="text-blue"></i>
                                    <h3>${gw.displayName || gw.deviceName}</h3>
                                </div>
                                <span style="font-weight:800; color:${isOnline ? 'var(--gh-green)' : 'var(--gh-text-muted)'}">${isOnline ? 'ONLINE & BROADCASTING' : 'DEVICE OFFLINE'}</span>
                            </div>
                            <div class="card-body">
                                <div class="kpi-grid">
                                    <div><div class="kpi-label">SIM PHONE NUMBER</div><div style="font-weight:800; font-size:16px;">${gw.phoneNumber || '—'}</div></div>
                                    <div><div class="kpi-label">MOBILE NETWORK</div><div style="font-weight:700;">${gw.simOperator || 'Vodacom / Tigo'}</div></div>
                                    <div><div class="kpi-label">BATTERY TELEMETRY</div><div style="font-weight:700;">${gw.batteryLevel != null ? gw.batteryLevel + '%' : '100%'}</div></div>
                                    <div><div class="kpi-label">DEVICE STATUS</div><div style="font-weight:700;">${isOnline ? 'Active Gateway' : 'Standby'}</div></div>
                                </div>
                            </div>
                        </div>`;
                }).join('');
            }
        }

        if (window.lucide) lucide.createIcons();

    } catch (e) {
        console.warn('Gateway load failed:', e);
    }
}

// ── Navigation ───────────────────────────────────────────────
function showSection(sectionId) {
    document.querySelectorAll('main section').forEach(s => s.style.display = 'none');
    const target = document.getElementById(sectionId);
    if (target) target.style.display = 'block';

    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const navMap = {
        sectionDashboard:    'navDashboard',
        sectionHistory:      'navHistory',
        sectionGateway:      'navGateway',
        sectionSubscription: 'navSubscription'
    };
    const navId = navMap[sectionId];
    if (navId && document.getElementById(navId)) document.getElementById(navId).classList.add('active');

    if (window.lucide) lucide.createIcons();
}

function toggleUserMenu() {
    const dd = document.getElementById('userDropdown');
    dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
}

document.addEventListener('click', e => {
    const dd = document.getElementById('userDropdown');
    const btn = document.getElementById('userMenuBtn');
    if (dd && btn && !btn.contains(e.target)) dd.style.display = 'none';
});

function doLogout() {
    localStorage.removeItem('schoolToken');
    localStorage.removeItem('schoolRefreshToken');
    localStorage.removeItem('schoolTenant');
    window.location.href = 'login.html';
}

function contactRenewal(plan) {
    const msg = encodeURIComponent(`Hello School Notify Team, I would like to subscribe to the ${plan} tier for my school.`);
    window.open(`https://wa.me/255700000000?text=${msg}`, '_blank');
}

// ── Helpers ──────────────────────────────────────────────────
function showAlert(id, msg, type = 'danger') {
    const el = document.getElementById(id);
    if (!el) return;
    el.className = `alert alert-${type}`;
    el.innerHTML = msg;
    el.style.display = 'flex';
}

function hideAlert(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
}

function hideAll() {
    ['alertPending','alertSuspended','alertExpired','alertError'].forEach(hideAlert);
}
