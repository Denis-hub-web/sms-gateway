/**
 * SMS Gateway Admin & Developer Dashboard
 * High-performance GitHub-style client with Live SSE Streaming & API Keys Management
 */

localStorage.removeItem('serverUrl');
let API_BASE = window.location.origin;
let ACCESS_TOKEN = localStorage.getItem('accessToken') || null;
let currentTab = 'dashboard';
let sseSource = null;

// ============================================================
// Initialization & Authentication
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    const urlInput = document.getElementById('loginServerUrl');
    if (urlInput) urlInput.value = window.location.origin;

    if (ACCESS_TOKEN) {
        showAppShell();
    } else {
        showLoginPage();
    }

    setupTabs();
    setupCodeTabs();
});

async function apiCall(path, method = 'GET', body = null) {
    API_BASE = window.location.origin;
    const url = `${API_BASE}${path}`;
    const opts = {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...(ACCESS_TOKEN ? { 'Authorization': `Bearer ${ACCESS_TOKEN}` } : {})
        }
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(url, opts);

    if ((res.status === 401 || res.status === 403) && path !== '/api/auth/login') {
        logout();
        throw new Error('Session expired or unauthorized. Please sign in again.');
    }

    if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(err.message || `HTTP ${res.status}`);
    }

    const text = await res.text();
    return text ? JSON.parse(text) : {};
}

async function login() {
    const username  = document.getElementById('loginUsername').value.trim();
    const password  = document.getElementById('loginPassword').value;
    const errorEl   = document.getElementById('loginError');
    const loginBtn  = document.getElementById('loginBtn');

    errorEl.textContent = '';
    if (loginBtn) {
        loginBtn.disabled = true;
        loginBtn.innerHTML = '⏳ Signing in...';
    }

    try {
        API_BASE = window.location.origin;
        const data = await apiCall('/api/auth/login', 'POST', { username, password });

        ACCESS_TOKEN = data.accessToken;
        localStorage.setItem('accessToken', ACCESS_TOKEN);
        localStorage.setItem('serverUrl', API_BASE);
        if (data.username) localStorage.setItem('username', data.username);

        showAppShell();
    } catch (e) {
        errorEl.textContent = e.message || 'Login failed. Check credentials.';
    } finally {
        if (loginBtn) {
            loginBtn.disabled = false;
            loginBtn.innerHTML = '🚀 Launch Live Admin Dashboard';
        }
    }
}

function logout() {
    ACCESS_TOKEN = null;
    localStorage.removeItem('accessToken');
    if (sseSource) {
        sseSource.close();
        sseSource = null;
    }
    showLoginPage();
}

function showLoginPage() {
    document.getElementById('loginPage').style.display = 'block';
    document.getElementById('appShell').style.display = 'none';
}

function showAppShell() {
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('appShell').style.display = 'block';

    const username = localStorage.getItem('username') || 'admin';
    document.getElementById('userNameText').textContent = username;
    document.getElementById('userAvatar').textContent = username.charAt(0).toUpperCase();

    switchTab('dashboard');
    connectLiveSseStream();
}

// ============================================================
// Real-Time Server-Sent Events (SSE) Stream
// ============================================================
function connectLiveSseStream() {
    if (sseSource) sseSource.close();

    const sseUrl = `${API_BASE}/api/stream/events`;
    sseSource = new EventSource(sseUrl);

    const sseBadge = document.getElementById('sseBadge');
    const sseStatusText = document.getElementById('sseStatusText');

    sseSource.onopen = () => {
        sseBadge.style.color = 'var(--gh-green)';
        sseBadge.style.borderColor = 'rgba(63, 185, 80, 0.3)';
        sseStatusText.textContent = 'Live Stream';
        addFeedItem('SYSTEM', 'Connected to live event stream', 'tag-green');
    };

    sseSource.onerror = () => {
        sseBadge.style.color = 'var(--gh-yellow)';
        sseBadge.style.borderColor = 'rgba(210, 153, 34, 0.3)';
        sseStatusText.textContent = 'Reconnecting...';
    };

    // Event listener: SMS_QUEUED
    sseSource.addEventListener('SMS_QUEUED', e => {
        const data = JSON.parse(e.data);
        addFeedItem('QUEUED', `SMS queued for ${data.phoneNumber}`, 'tag-blue');
        if (currentTab === 'dashboard') loadDashboardData();
        if (currentTab === 'messages') loadMessages();
    });

    // Event listener: SMS_STATUS_UPDATED
    sseSource.addEventListener('SMS_STATUS_UPDATED', e => {
        const data = JSON.parse(e.data);
        const tagCls = data.status === 'DELIVERED' ? 'tag-green' : data.status === 'FAILED' ? 'tag-red' : 'tag-yellow';
        addFeedItem(data.status, `SMS ${data.messageUid.substring(0, 8)} → ${data.status}`, tagCls);
        if (currentTab === 'dashboard') loadDashboardData();
        if (currentTab === 'messages') loadMessages();
    });
}

function addFeedItem(tag, text, tagCls) {
    const feed = document.getElementById('eventFeed');
    if (!feed) return;

    const time = new Date().toLocaleTimeString();
    const item = document.createElement('div');
    item.className = 'feed-item';
    item.innerHTML = `
        <span class="feed-time">${time}</span>
        <span class="feed-tag ${tagCls}">${tag}</span>
        <span class="feed-text">${text}</span>
    `;

    feed.prepend(item);
    if (feed.children.length > 30) feed.removeChild(feed.lastChild);
}

// ============================================================
// Tabs Navigation
// ============================================================
function setupTabs() {
    document.querySelectorAll('.tab-item').forEach(btn => {
        btn.addEventListener('click', () => {
            switchTab(btn.dataset.tab);
        });
    });
}

function switchTab(tabId) {
    currentTab = tabId;

    document.querySelectorAll('.tab-item').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    document.querySelectorAll('.tab-content').forEach(sec => {
        sec.classList.toggle('active', sec.id === `tab-${tabId}`);
    });

    refreshCurrentPage();
}

function refreshCurrentPage() {
    if (currentTab === 'dashboard') loadDashboardData();
    if (currentTab === 'schools') loadSchools();
    if (currentTab === 'messages') loadMessages();
    if (currentTab === 'gateways') loadGateways();
    if (currentTab === 'apikeys') loadApiKeys();
}
// ============================================================
// Registered Schools — Simplified View with Password Reset
// ============================================================
// Registered Schools — Ultra-Modern GitHub View with Modal & Stats
// ============================================================
let allSchoolsData = [];

async function loadSchools() {
    const tbody = document.getElementById('schoolsBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" class="empty-cell">Loading registered schools...</td></tr>';

    try {
        const schools = await apiCall('/api/school/admin/all');
        allSchoolsData = schools || [];

        const navCount = document.getElementById('navSchoolCount');
        if (navCount) navCount.textContent = allSchoolsData.length;

        // Update Stats Counters
        const statTotal = document.getElementById('statTotalSchools');
        const statActive = document.getElementById('statActiveSchools');
        const statGateways = document.getElementById('statConnectedGateways');

        if (statTotal) statTotal.textContent = allSchoolsData.length;
        if (statActive) {
            const activeCount = allSchoolsData.filter(s => s.approvedByAdmin && s.subscriptionStatus === 'ACTIVE').length;
            statActive.textContent = activeCount;
        }
        if (statGateways) {
            let totalGws = 0;
            allSchoolsData.forEach(s => {
                if (s.gateways && s.gateways.length > 0) totalGws += s.gateways.length;
            });
            statGateways.textContent = totalGws;
        }

        renderSchoolsTable(allSchoolsData);

    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty-cell" style="color:var(--gh-red);">Failed to load schools: ${e.message}</td></tr>`;
    }
}

function filterSchoolsTable() {
    const searchVal = (document.getElementById('schoolSearchInput')?.value || '').toLowerCase().trim();
    const statusVal = document.getElementById('schoolStatusFilter')?.value || '';

    const filtered = allSchoolsData.filter(s => {
        const matchSearch = !searchVal ||
            (s.schoolName || '').toLowerCase().includes(searchVal) ||
            (s.schoolCode || '').toLowerCase().includes(searchVal) ||
            (s.loginUsername || '').toLowerCase().includes(searchVal) ||
            (s.contactEmail || '').toLowerCase().includes(searchVal) ||
            (s.region || '').toLowerCase().includes(searchVal);

        const status = s.subscriptionStatus || 'INACTIVE';
        const isActive = s.approvedByAdmin && status === 'ACTIVE';

        let matchStatus = true;
        if (statusVal === 'ACTIVE') matchStatus = isActive;
        else if (statusVal === 'PENDING') matchStatus = !s.approvedByAdmin;
        else if (statusVal === 'SUSPENDED') matchStatus = status === 'SUSPENDED';

        return matchSearch && matchStatus;
    });

    renderSchoolsTable(filtered);
}

function renderSchoolsTable(schools) {
    const tbody = document.getElementById('schoolsBody');
    if (!tbody) return;

    if (!schools.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-cell">No matching school accounts found.</td></tr>';
        return;
    }

    tbody.innerHTML = schools.map(s => {
        const status  = s.subscriptionStatus || 'INACTIVE';
        const daysLeft = s.daysRemaining != null ? s.daysRemaining : 0;
        const isActive = s.approvedByAdmin && status === 'ACTIVE';

        const statusBadge = isActive
            ? `<span class="status-badge bg-green" style="display:inline-flex; align-items:center; gap:4px;"><i data-lucide="check-circle-2" style="width:13px; height:13px;"></i> ACTIVE &bull; ${daysLeft}d left</span>`
            : status === 'SUSPENDED'
            ? `<span class="status-badge bg-red" style="display:inline-flex; align-items:center; gap:4px;"><i data-lucide="pause-circle" style="width:13px; height:13px;"></i> SUSPENDED</span>`
            : `<span class="status-badge bg-yellow" style="display:inline-flex; align-items:center; gap:4px;"><i data-lucide="clock" style="width:13px; height:13px;"></i> PENDING</span>`;

        const loginUsername = s.loginUsername || (s.schoolName || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        const loginEmail = s.loginEmail || s.contactEmail || '—';

        const gws = s.gateways || [];
        const gwInfo = gws.length > 0
            ? gws.map(g => {
                const isOnline = g.status === 'ONLINE';
                const iconColor = isOnline ? '#2da44e' : '#cf222e';
                const badgeBg = isOnline ? 'rgba(45,164,78,0.15)' : 'rgba(207,34,46,0.15)';
                return `<div style="display:inline-flex; align-items:center; gap:5px; background:${badgeBg}; padding:3px 8px; border-radius:12px; font-size:11px; font-weight:600; color:var(--gh-text); margin-top:3px;">
                    <span style="width:7px; height:7px; border-radius:50%; background:${iconColor}; display:inline-block;"></span>
                    📱 ${g.displayName || g.deviceName || 'Android Gateway'} ${g.batteryLevel ? `(${g.batteryLevel}%)` : ''}
                </div>`;
            }).join(' ')
            : `<span style="font-size:11px; color:var(--gh-text-muted); font-style:italic; display:inline-flex; align-items:center; gap:4px;"><i data-lucide="smartphone" style="width:12px; height:12px;"></i> No Gateway Connected</span>`;

        return `
            <tr>
                <td>
                    <div style="font-weight:800; color:var(--gh-text); font-size:14px; display:flex; align-items:center; gap:6px;">
                        <i data-lucide="graduation-cap" style="width:16px; height:16px; color:var(--gh-blue);"></i>
                        ${s.schoolName}
                    </div>
                    <div style="font-family:var(--font-mono); font-size:11px; color:var(--gh-blue); margin-top:2px;">Code: ${s.schoolCode}</div>
                </td>
                <td>
                    <div style="font-size:13px; font-weight:700; color:var(--gh-green); font-family:var(--font-mono); display:flex; align-items:center; gap:4px;">
                        <i data-lucide="user" style="width:13px; height:13px; color:var(--gh-green);"></i> ${loginUsername}
                    </div>
                    <div style="font-size:11px; color:var(--gh-text-muted); margin-top:2px;">Email: ${loginEmail}</div>
                </td>
                <td>
                    <div style="font-size:12px; font-weight:600; display:flex; align-items:center; gap:6px;">
                        <span style="display:inline-flex; align-items:center; gap:4px;"><i data-lucide="phone" style="width:13px; height:13px;"></i> ${s.contactPhone || '—'}</span>
                        <button class="btn btn-sm btn-outline" style="padding:1px 6px; font-size:10px; display:inline-flex; align-items:center; gap:2px;" onclick="editSchoolPhone(${s.id}, '${(s.contactPhone || '').replace(/'/g, '')}')" title="Edit Phone Number">
                            <i data-lucide="edit-3" style="width:10px; height:10px;"></i> Edit
                        </button>
                    </div>
                    <div style="font-size:11px; color:var(--gh-text-muted); margin-top:2px; margin-bottom:4px; display:flex; align-items:center; gap:4px;">
                        <i data-lucide="map-pin" style="width:12px; height:12px;"></i> ${s.region || '—'} &bull; ${s.schoolType || ''}
                    </div>
                    <div>${gwInfo}</div>
                </td>
                <td>${statusBadge}</td>
                <td style="font-size:11px; color:var(--gh-text-muted);">${s.createdAt ? new Date(s.createdAt).toLocaleDateString() : '—'}</td>
                <td>
                    <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
                        ${!s.approvedByAdmin ? `<button class="btn btn-sm btn-primary" onclick="approveSchool(${s.id})" style="display:inline-flex; align-items:center; gap:4px;"><i data-lucide="check-circle" style="width:12px; height:12px;"></i> Approve</button>` : ''}

                        <select class="gh-input gh-select" style="padding:4px 8px; font-size:11px; width:auto;" onchange="extendSchoolSubscription(${s.id}, this)">
                            <option value="">&#43; Add Days...</option>
                            <option value="30">+30 Days</option>
                            <option value="60">+60 Days</option>
                            <option value="90">+90 Days</option>
                            <option value="180">+180 Days</option>
                            <option value="365">+365 Days</option>
                        </select>

                        <button class="btn btn-sm btn-outline" onclick="resetSchoolPassword(${s.id}, '${s.schoolName.replace(/'/g, '')}', '${loginEmail}')" title="Reset Password" style="color:var(--gh-yellow); border-color:var(--gh-yellow); display:inline-flex; align-items:center; gap:4px;">
                            <i data-lucide="key" style="width:12px; height:12px;"></i> Reset PW
                        </button>

                        ${status === 'ACTIVE'
                            ? `<button class="btn btn-sm btn-outline" onclick="pauseSchool(${s.id})" title="Pause" style="display:inline-flex; align-items:center; gap:4px;"><i data-lucide="pause-circle" style="width:12px; height:12px;"></i> Pause</button>`
                            : status === 'SUSPENDED'
                            ? `<button class="btn btn-sm btn-primary" onclick="resumeSchool(${s.id})" style="display:inline-flex; align-items:center; gap:4px;"><i data-lucide="play-circle" style="width:12px; height:12px;"></i> Resume</button>`
                            : ''}
                    </div>
                </td>
            </tr>`;
    }).join('');

    if (window.lucide) lucide.createIcons();
}

// ── Admin Direct School Account Modal Logic ──────────────────
function openAddSchoolModal() {
    const modal = document.getElementById('addSchoolModal');
    if (modal) {
        document.getElementById('newSchoolName').value = '';
        document.getElementById('newSchoolUsername').value = '';
        document.getElementById('newSchoolEmail').value = '';
        document.getElementById('newSchoolPhone').value = '';
        document.getElementById('newSchoolRegion').value = '';
        document.getElementById('newSchoolPassword').value = 'School12345';
        document.getElementById('addSchoolStatus').textContent = '';
        modal.style.display = 'flex';
        if (window.lucide) lucide.createIcons();
    }
}

function closeAddSchoolModal() {
    const modal = document.getElementById('addSchoolModal');
    if (modal) modal.style.display = 'none';
}

async function handleAddSchool() {
    const schoolName = document.getElementById('newSchoolName').value.trim();
    const username = document.getElementById('newSchoolUsername').value.trim();
    const email = document.getElementById('newSchoolEmail').value.trim();
    const phone = document.getElementById('newSchoolPhone').value.trim();
    const region = document.getElementById('newSchoolRegion').value.trim();
    const schoolType = document.getElementById('newSchoolType').value;
    const daysActive = document.getElementById('newSchoolDays').value;
    const password = document.getElementById('newSchoolPassword').value.trim();
    const statusEl = document.getElementById('addSchoolStatus');
    const submitBtn = document.getElementById('addSchoolSubmitBtn');

    if (!schoolName || !email || !phone) {
        statusEl.style.color = 'var(--gh-red)';
        statusEl.textContent = '❌ School Name, Email, and Phone number are required.';
        return;
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = '⏳ Registering school account...';
    }

    try {
        const res = await apiCall('/api/school/admin/create', 'POST', {
            schoolName, username, email, phone, region, schoolType, daysActive, password
        });

        statusEl.style.color = 'var(--gh-green)';
        statusEl.textContent = `✅ ${res.message || 'School registered!'} Username: '${res.loginUsername}', Password: '${res.loginPassword}'`;

        setTimeout(() => {
            closeAddSchoolModal();
            loadSchools();
        }, 1800);

    } catch (e) {
        statusEl.style.color = 'var(--gh-red)';
        statusEl.textContent = `❌ ${e.message || 'Failed to create school account'}`;
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i data-lucide="check-circle" style="width:14px; height:14px;"></i> Register & Activate School';
            if (window.lucide) lucide.createIcons();
        }
    }
}

async function editSchoolPhone(tenantId, currentPhone) {
    const newPhone = prompt('Enter new contact phone number for this school (e.g. +255712345678):', currentPhone || '');
    if (newPhone === null) return;

    try {
        await apiCall(`/api/school/admin/update-phone/${tenantId}?phone=${encodeURIComponent(newPhone.trim())}`, 'POST');
        alert('✅ School contact phone number updated to: ' + newPhone.trim());
        loadSchools();
    } catch (e) {
        alert('❌ Phone update failed: ' + e.message);
    }
}

async function editCustomPrice(tenantId, currentMonthly, currentSetup) {
    const newMonthly = prompt('Enter custom agreed MONTHLY rate in TZS:', currentMonthly);
    if (newMonthly === null) return;
    const newSetup = prompt('Enter custom agreed SETUP fee in TZS:', currentSetup);
    if (newSetup === null) return;

    try {
        await apiCall(`/api/school/admin/custom-price/${tenantId}?monthlyPriceTzs=${parseInt(newMonthly)}&setupFeeTzs=${parseInt(newSetup)}`, 'POST');
        alert(`✅ Custom price updated:\nMonthly: TZS ${Number(newMonthly).toLocaleString()}\nSetup Fee: TZS ${Number(newSetup).toLocaleString()}`);
        loadSchools();
    } catch (e) {
        alert('❌ Price update failed: ' + e.message);
    }
}

// ============================================================
// Password Generator
// ============================================================
function generatePassword() {
    const length = parseInt(document.getElementById('pwLengthSelect').value) || 12;
    const charset = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789@#$!%&';
    let password = '';
    const arr = new Uint8Array(length);
    crypto.getRandomValues(arr);
    arr.forEach(v => { password += charset[v % charset.length]; });
    document.getElementById('generatedPassword').value = password;
    document.getElementById('pwGenStatus').textContent = `✅ Password generated (${length} chars) — copy and share with the school.`;
}

function copyGeneratedPassword() {
    const el = document.getElementById('generatedPassword');
    if (!el.value) { alert('Generate a password first!'); return; }
    navigator.clipboard.writeText(el.value).then(() => {
        document.getElementById('pwGenStatus').textContent = '📋 Copied to clipboard!';
        setTimeout(() => { document.getElementById('pwGenStatus').textContent = ''; }, 2000);
    });
}

async function resetSchoolPassword(tenantId, schoolName, loginEmail) {
    const pw = document.getElementById('generatedPassword').value;
    if (!pw) {
        const manual = prompt(`Enter new password for ${schoolName} (${loginEmail}):`);
        if (!manual) return;
        await doResetPassword(tenantId, manual, schoolName);
    } else {
        if (!confirm(`Reset password for ${schoolName}?\nLogin email: ${loginEmail}\nNew password: ${pw}\n\nMake sure you have shared this password with the school!`)) return;
        await doResetPassword(tenantId, pw, schoolName);
    }
}

async function doResetPassword(tenantId, password, schoolName) {
    try {
        const res = await apiCall(`/api/school/admin/reset-password/${tenantId}?newPassword=${encodeURIComponent(password)}`, 'POST');
        alert(`✅ Password reset for ${res.schoolName}!\nLogin: ${res.email}\nNew password has been set.`);
        document.getElementById('pwGenStatus').textContent = `✅ Password applied to ${schoolName}!`;
    } catch (e) {
        alert('❌ Password reset failed: ' + e.message);
    }
}

async function approveSchool(tenantId) {
    const daysStr = prompt('Enter number of active days to grant upon approval:', '30');
    if (daysStr === null) return;
    const days = parseInt(daysStr) || 30;

    try {
        await apiCall(`/api/school/admin/approve/${tenantId}?days=${days}`, 'POST');
        alert(`🎉 School approved and activated for ${days} days!`);
        loadSchools();
    } catch (e) {
        alert('❌ Approval failed: ' + e.message);
    }
}

async function extendSchoolSubscription(tenantId, selectEl) {
    const daysVal = selectEl.value;
    if (!daysVal) return;

    try {
        const res = await apiCall(`/api/school/admin/renew/${tenantId}?days=${daysVal}`, 'POST');
        alert(`🎉 Added +${daysVal} days to subscription!\nTotal days remaining: ${res.totalDaysRemaining} days.`);
        selectEl.value = '';
        loadSchools();
    } catch (e) {
        alert('❌ Extension failed: ' + e.message);
        selectEl.value = '';
    }
}

async function pauseSchool(tenantId) {
    if (!confirm('⏸️ Pause subscription for this school? SMS dispatches will be stopped.')) return;
    try {
        await apiCall(`/api/school/admin/pause/${tenantId}`, 'POST');
        alert('⏸️ Subscription paused.');
        loadSchools();
    } catch (e) {
        alert('❌ Pause failed: ' + e.message);
    }
}

async function resumeSchool(tenantId) {
    try {
        await apiCall(`/api/school/admin/resume/${tenantId}`, 'POST');
        alert('▶️ Subscription resumed & ACTIVE!');
        loadSchools();
    } catch (e) {
        alert('❌ Resume failed: ' + e.message);
    }
}

async function markSetupFeePaid(tenantId) {
    try {
        await apiCall(`/api/school/admin/setup-fee-paid/${tenantId}`, 'POST');
        alert('💳 Setup fee marked as PAID!');
        loadSchools();
    } catch (e) {
        alert('❌ Action failed: ' + e.message);
    }
}

// ============================================================
// Overview / Dashboard Data
// ============================================================
async function loadDashboardData() {
    try {
        const stats = await apiCall('/api/dashboard');

        document.getElementById('dashActiveGateways').textContent = stats.totalGateways ?? 0;
        document.getElementById('dashOnlineGateways').textContent = `${stats.onlineGateways ?? 0} Online`;
        document.getElementById('dashPendingSms').textContent = stats.pendingSms ?? 0;
        document.getElementById('dashSentToday').textContent = stats.sentToday ?? 0;
        document.getElementById('dashDeliveredToday').textContent = stats.deliveredToday ?? 0;

        document.getElementById('navGatewayCount').textContent = stats.totalGateways ?? 0;

        // Mini gateway list
        const miniList = document.getElementById('dashGatewayList');
        const gateways = await apiCall('/api/gateway/admin/list').catch(() => []);

        if (!gateways.length) {
            miniList.innerHTML = '<div class="empty-text">No gateways registered yet.</div>';
            return;
        }

        miniList.innerHTML = gateways.map(gw => {
            const isOnline = gw.status === 'ONLINE';
            return `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--gh-border)">
                    <div>
                        <div style="font-weight:600; font-size:13px">${gw.displayName || gw.deviceName}</div>
                        <div style="font-family:var(--font-mono); font-size:11px; color:var(--gh-text-muted)">${gw.gatewayUid}</div>
                    </div>
                    <span class="badge-status ${isOnline ? 'badge-delivered' : 'badge-failed'}">
                        ${isOnline ? '🟢 ONLINE' : '⚪ OFFLINE'}
                    </span>
                </div>
            `;
        }).join('');
    } catch (e) {
        console.error('Failed to load dashboard:', e);
    }
}

// ============================================================
// Messages Table & Send Modal
// ============================================================
async function loadMessages() {
    const tbody = document.getElementById('messagesBody');
    tbody.innerHTML = '<tr><td colspan="7" class="empty-cell">Loading messages...</td></tr>';

    try {
        const filterStatus = document.getElementById('msgStatusFilter').value;
        const url = `/api/sms/history?page=0&size=50${filterStatus ? `&status=${filterStatus}` : ''}`;
        const data = await apiCall(url);
        const list = data.content || data || [];

        if (!list.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-cell">No SMS messages found.</td></tr>';
            return;
        }

        tbody.innerHTML = list.map(msg => `
            <tr>
                <td style="font-family:var(--font-mono); font-size:11px">${msg.messageUid.substring(0, 12)}...</td>
                <td style="font-weight:600">${msg.phoneNumber}</td>
                <td>${msg.message}</td>
                <td><span class="badge-status badge-${(msg.status || 'PENDING').toLowerCase()}">${msg.status}</span></td>
                <td><span style="font-size:11px; color:var(--gh-text-muted)">${msg.messageType || 'SINGLE'}</span></td>
                <td style="font-size:12px; color:var(--gh-text-muted)">${new Date(msg.createdAt).toLocaleString()}</td>
                <td>
                    ${['FAILED','EXPIRED'].includes(msg.status)
                        ? `<button class="btn btn-sm btn-outline" onclick="retryMessage('${msg.messageUid}')">Retry</button>`
                        : '—'
                    }
                </td>
            </tr>
        `).join('');
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="7" class="empty-cell" style="color:var(--gh-red)">Failed: ${e.message}</td></tr>`;
    }
}

function openSendModal() {
    document.getElementById('sendSmsModal').style.display = 'flex';
}

function closeSendModal() {
    document.getElementById('sendSmsModal').style.display = 'none';
}

async function handleSendSms() {
    const phoneNumber = document.getElementById('smsPhone').value.trim();
    const message = document.getElementById('smsText').value.trim();
    const priority = parseInt(document.getElementById('smsPriority').value);

    try {
        await apiCall('/api/sms/send', 'POST', { phoneNumber, message, priority });
        closeSendModal();
        loadMessages();
        addFeedItem('QUEUED', `SMS dispatched to ${phoneNumber}`, 'tag-green');
    } catch (e) {
        alert(`Failed to send SMS: ${e.message}`);
    }
}

async function retryMessage(messageUid) {
    try {
        await apiCall(`/api/sms/retry/${messageUid}`, 'POST');
        loadMessages();
    } catch (e) {
        alert(`Retry failed: ${e.message}`);
    }
}

// ============================================================
// Gateways Management
// ============================================================
async function loadGateways() {
    const grid = document.getElementById('gatewaysGrid');
    grid.innerHTML = '<div class="empty-text">Loading gateways...</div>';

    try {
        const list = await apiCall('/api/gateway/admin/list');
        document.getElementById('navGatewayCount').textContent = list.length;

        if (!list.length) {
            grid.innerHTML = '<div class="empty-text">No gateways registered yet. Launch your Android app to connect!</div>';
            return;
        }

        grid.innerHTML = list.map(gw => {
            const isOnline = gw.status === 'ONLINE';
            const battery = gw.batteryLevel != null ? `🔋 ${gw.batteryLevel}%` : '🔋 —';
            const signal  = gw.signalStrength != null ? `📶 ${gw.signalStrength}` : '📶 —';
            const simVerifiedBadge = gw.simVerified !== false
                ? '<span class="badge-status badge-delivered" style="font-size:10px; margin-left:4px;">🟢 SIM Verified</span>'
                : '<span class="badge-status badge-failed" style="font-size:10px; margin-left:4px;">⚠️ Unverified SIM</span>';

            return `
                <div class="gateway-card">
                    <div class="gw-header">
                        <div>
                            <div class="gw-name">${gw.displayName || gw.deviceName} ${simVerifiedBadge}</div>
                            <div class="gw-uid">${gw.gatewayUid}</div>
                        </div>
                        <span class="badge-status ${isOnline ? 'badge-delivered' : 'badge-failed'}">
                            ${isOnline ? '🟢 ONLINE' : '⚪ OFFLINE'}
                        </span>
                    </div>
                    <div class="gw-stats-grid">
                        <div class="gw-stat-item"><div class="gw-stat-label">Device</div>${gw.deviceName || '—'}</div>
                        <div class="gw-stat-item"><div class="gw-stat-label">Android</div>${gw.androidVersion || '—'}</div>
                        <div class="gw-stat-item"><div class="gw-stat-label">SIM Operator</div>${gw.simOperator || '—'}</div>
                        <div class="gw-stat-item"><div class="gw-stat-label">Verified SIM Phone</div>${gw.phoneNumber || '—'}</div>
                    </div>
                    <div class="gw-footer">
                        <span>${battery} &bull; ${signal}</span>
                        <button class="btn btn-sm btn-outline btn-danger-icon" onclick="deleteGateway('${gw.gatewayUid}')">🗑 Delete</button>
                    </div>
                </div>
            `;
        }).join('');
    } catch (e) {
        grid.innerHTML = `<div class="empty-text" style="color:var(--gh-red)">Failed to load: ${e.message}</div>`;
    }
}

async function deleteGateway(gatewayUid) {
    if (!confirm(`Delete gateway ${gatewayUid}?`)) return;
    try {
        await apiCall(`/api/gateway/admin/${gatewayUid}`, 'DELETE');
        loadGateways();
    } catch (e) {
        alert(`Delete failed: ${e.message}`);
    }
}

// ============================================================
// REST API Keys Management
// ============================================================
async function loadApiKeys() {
    const tbody = document.getElementById('apiKeysBody');
    tbody.innerHTML = '<tr><td colspan="7" class="empty-cell">Loading API keys...</td></tr>';

    try {
        const keys = await apiCall('/api/admin/api-keys');

        if (!keys.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-cell">No API keys created yet. Click "+ Generate New API Key" above!</td></tr>';
            return;
        }

        tbody.innerHTML = keys.map(k => {
            const boundGwText = k.gateway
                ? `<span style="color:var(--gh-green); font-weight:600;">🔒 ${k.gateway.displayName || k.gateway.deviceName} (${k.gateway.phoneNumber || k.gateway.gatewayUid})</span>`
                : `<span style="color:var(--gh-text-muted);">🌐 Any Gateway (Tenant)</span>`;

            return `
                <tr>
                    <td style="font-weight:600">${k.name}</td>
                    <td style="font-family:var(--font-mono); font-size:12px; color:var(--gh-blue)">${k.keyPrefix}...</td>
                    <td style="font-size:12px">${boundGwText}</td>
                    <td style="font-size:12px; color:var(--gh-text-muted)">${new Date(k.createdAt).toLocaleDateString()}</td>
                    <td style="font-size:12px; color:var(--gh-text-muted)">${k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : 'Never'}</td>
                    <td>
                        <span class="badge-status ${k.enabled ? 'badge-delivered' : 'badge-failed'}">
                            ${k.enabled ? 'Active' : 'Revoked'}
                        </span>
                    </td>
                    <td>
                        ${k.enabled
                            ? `<button class="btn btn-sm btn-outline btn-danger-icon" onclick="revokeApiKey(${k.id})">Revoke</button>`
                            : '—'
                        }
                    </td>
                </tr>
            `;
        }).join('');
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="7" class="empty-cell" style="color:var(--gh-red)">Failed: ${e.message}</td></tr>`;
    }
}

async function openCreateApiKeyModal() {
    document.getElementById('createdKeyBox').style.display = 'none';
    document.getElementById('apiKeyName').value = '';

    const select = document.getElementById('apiKeyGatewayUid');
    select.innerHTML = '<option value="">🌐 Any Gateway (Default Routing)</option>';

    try {
        const gateways = await apiCall('/api/gateway/admin/list');
        gateways.forEach(gw => {
            const opt = document.createElement('option');
            opt.value = gw.gatewayUid;
            opt.textContent = `🔒 ${gw.displayName || gw.deviceName} (${gw.phoneNumber || gw.gatewayUid})`;
            select.appendChild(opt);
        });
    } catch (e) {
        // Fallback option
    }

    document.getElementById('createApiKeyModal').style.display = 'flex';
}

function closeCreateApiKeyModal() {
    document.getElementById('createApiKeyModal').style.display = 'none';
}

async function handleCreateApiKey() {
    const name = document.getElementById('apiKeyName').value.trim();
    const gatewayUid = document.getElementById('apiKeyGatewayUid').value;
    if (!name) return;

    try {
        const data = await apiCall('/api/admin/api-keys', 'POST', { name, gatewayUid });

        document.getElementById('rawApiKeyInput').value = data.rawApiKey;
        document.getElementById('createdKeyBox').style.display = 'block';
        loadApiKeys();
    } catch (e) {
        alert(`Failed to generate API Key: ${e.message}`);
    }
}

function copyCreatedApiKey() {
    const input = document.getElementById('rawApiKeyInput');
    input.select();
    navigator.clipboard.writeText(input.value);
    alert('API Key copied to clipboard!');
}

async function revokeApiKey(id) {
    if (!confirm('Revoke this API Key? External systems using it will lose access.')) return;
    try {
        await apiCall(`/api/admin/api-keys/${id}`, 'DELETE');
        loadApiKeys();
    } catch (e) {
        alert(`Revoke failed: ${e.message}`);
    }
}

// ============================================================
// Code Playground Snippets Switcher
// ============================================================
function setupCodeTabs() {
    document.querySelectorAll('.code-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const lang = tab.dataset.lang;
            document.querySelectorAll('.code-tab').forEach(t => t.classList.toggle('active', t === tab));
            document.querySelectorAll('.code-snippet-box').forEach(box => {
                box.classList.toggle('active', box.id === `snippet-${lang}`);
            });
        });
    });
}

function copySnippet(elementId) {
    const text = document.getElementById(elementId).innerText;
    navigator.clipboard.writeText(text);
    alert('Code snippet copied to clipboard!');
}
