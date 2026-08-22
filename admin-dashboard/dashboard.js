/**
 * SMS Gateway Admin & Developer Dashboard
 * High-performance GitHub-style client with Live SSE Streaming & API Keys Management
 */

let API_BASE = localStorage.getItem('serverUrl') || 'https://sms-gateway-qtmi.onrender.com';
let ACCESS_TOKEN = localStorage.getItem('accessToken') || null;
let currentTab = 'dashboard';
let sseSource = null;

// ============================================================
// Initialization & Authentication
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    if (ACCESS_TOKEN) {
        showAppShell();
    } else {
        showLoginPage();
    }

    setupTabs();
    setupCodeTabs();
});

async function apiCall(path, method = 'GET', body = null) {
    const url = `${API_BASE}${path}`;
    const opts = {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...(ACCESS_TOKEN ? { 'Authorization': `Bearer ${ACCESS_TOKEN}` } : {})
        }
    };
    if (body) opts.body = JSON.stringify(body);

    let res;
    try {
        res = await fetch(url, opts);
    } catch (netErr) {
        throw new Error(`Cannot connect to backend (${API_BASE}). If Render was asleep, wait ~30s for it to wake up and try again.`);
    }

    if (res.status === 401 || res.status === 403) {
        if (path === '/api/auth/login') {
            throw new Error('Invalid credentials. Default: admin / Admin@123');
        }
        logout();
        throw new Error('Session expired or unauthorized. Please sign in again.');
    }

    if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(err.message || `Server returned HTTP ${res.status}`);
    }

    const text = await res.text();
    return text ? JSON.parse(text) : {};
}

async function login() {
    const serverUrl = document.getElementById('loginServerUrl').value.trim().replace(/\/$/, '');
    const username  = document.getElementById('loginUsername').value.trim();
    const password  = document.getElementById('loginPassword').value;
    const errorEl   = document.getElementById('loginError');
    const loginBtn  = document.getElementById('loginBtn');

    errorEl.textContent = '';
    const origBtnHtml = loginBtn.innerHTML;
    loginBtn.disabled = true;
    loginBtn.innerHTML = '⏳ Authenticating with server...';

    try {
        API_BASE = serverUrl;
        const data = await apiCall('/api/auth/login', 'POST', { username, password });

        ACCESS_TOKEN = data.accessToken;
        localStorage.setItem('accessToken', ACCESS_TOKEN);
        localStorage.setItem('serverUrl', API_BASE);
        if (data.username) localStorage.setItem('username', data.username);

        showAppShell();
    } catch (e) {
        console.error('Login error:', e);
        errorEl.textContent = e.message || 'Login failed. Check credentials.';
    } finally {
        loginBtn.disabled = false;
        loginBtn.innerHTML = origBtnHtml;
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
// Registered Schools & Custom Approval Management
// ============================================================
async function loadSchools() {
    const tbody = document.getElementById('schoolsBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="8" class="empty-cell">Loading registered schools...</td></tr>';

    try {
        const schools = await apiCall('/api/school/admin/all');
        const navCount = document.getElementById('navSchoolCount');
        if (navCount) navCount.textContent = schools.length;

        if (!schools.length) {
            tbody.innerHTML = '<tr><td colspan="8" class="empty-cell">No registered schools found. Direct schools to self-register at /school-portal/register.html</td></tr>';
            return;
        }

        tbody.innerHTML = schools.map(s => {
            const isApproved = s.approvedByAdmin;
            const isFeePaid  = s.setupFeePaid;
            const status     = s.subscriptionStatus || 'INACTIVE';
            const daysLeft   = s.daysRemaining != null ? s.daysRemaining : 0;

            const statusBadge = isApproved && status === 'ACTIVE'
                ? '<span class="status-badge bg-green"><i data-lucide="check-circle-2" class="inline-icon"></i> ACTIVE</span>'
                : status === 'SUSPENDED'
                ? '<span class="status-badge bg-red"><i data-lucide="pause-circle" class="inline-icon"></i> PAUSED</span>'
                : '<span class="status-badge bg-yellow"><i data-lucide="clock" class="inline-icon"></i> PENDING APPROVAL</span>';

            const feeBadge = isFeePaid
                ? '<span class="status-badge bg-green"><i data-lucide="check" class="inline-icon"></i> PAID</span>'
                : '<span class="status-badge bg-yellow"><i data-lucide="alert-circle" class="inline-icon"></i> UNPAID</span>';

            const monthlyPrice = Number(s.agreedMonthlyPriceTzs || 25000).toLocaleString();
            const setupPrice   = Number(s.agreedSetupFeeTzs || 150000).toLocaleString();

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
                        <div style="font-size:12px; font-weight:600;"><i data-lucide="mail" class="inline-icon"></i> ${s.contactEmail}</div>
                        <div style="font-size:12px; color:var(--gh-text-muted);"><i data-lucide="phone" class="inline-icon"></i> ${s.contactPhone}</div>
                    </td>
                    <td>
                        <div style="font-size:12px; font-weight:600;"><i data-lucide="map-pin" class="inline-icon"></i> ${s.region}</div>
                        <div style="font-size:11px; color:var(--gh-text-muted);">${s.schoolType} (${s.studentCount || 0} students)</div>
                    </td>
                    <td>
                        <div style="font-weight:800; color:var(--gh-green); font-size:13.5px;">TZS ${monthlyPrice} / mo</div>
                        <div style="font-size:11px; color:var(--gh-text-muted);">Setup: TZS ${setupPrice}</div>
                        <button class="btn btn-sm btn-outline" style="margin-top:4px; padding:2px 6px; font-size:10px;" onclick="editCustomPrice(${s.id}, ${s.agreedMonthlyPriceTzs || 25000}, ${s.agreedSetupFeeTzs || 150000})">⚙️ Edit Price</button>
                    </td>
                    <td>${feeBadge}</td>
                    <td>
                        ${statusBadge}
                        <div style="font-size:11px; color:var(--gh-text-muted); margin-top:4px;">⏱️ ${daysLeft} days remaining</div>
                    </td>
                    <td style="font-size:11px; color:var(--gh-text-muted);">${s.createdAt ? new Date(s.createdAt).toLocaleDateString() : '—'}</td>
                    <td>
                        <div style="display:flex; gap:6px; flex-wrap:wrap;">
                            ${!isApproved ? `<button class="btn btn-sm btn-primary" onclick="approveSchool(${s.id})"><i data-lucide="check-circle"></i> Approve</button>` : ''}
                            ${!isFeePaid ? `<button class="btn btn-sm btn-outline" onclick="markSetupFeePaid(${s.id})"><i data-lucide="credit-card"></i> Mark Paid</button>` : ''}
                            
                            <!-- Extend Days Selector Dropdown -->
                            <select class="gh-input gh-select" style="padding:4px 8px; font-size:11px; width:auto;" onchange="extendSchoolSubscription(${s.id}, this)">
                                <option value="">➕ Add Days...</option>
                                <option value="30">+30 Days (1 Month)</option>
                                <option value="60">+60 Days (2 Months)</option>
                                <option value="90">+90 Days (3 Months)</option>
                                <option value="180">+180 Days (6 Months)</option>
                                <option value="365">+365 Days (1 Year)</option>
                            </select>

                            ${status === 'ACTIVE' 
                                ? `<button class="btn btn-sm btn-outline" onclick="pauseSchool(${s.id})" title="Pause Subscription">⏸️ Pause</button>` 
                                : status === 'SUSPENDED'
                                ? `<button class="btn btn-sm btn-primary" onclick="resumeSchool(${s.id})" title="Resume Subscription">▶️ Resume</button>`
                                : ''}
                        </div>
                    </td>
                </tr>`;
        }).join('');

        if (window.lucide) lucide.createIcons();

    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="8" class="empty-cell" style="color:var(--gh-red);">Failed to load schools: ${e.message}</td></tr>`;
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
