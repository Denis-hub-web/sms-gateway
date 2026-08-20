/**
 * Notify.inc — School Exam Results & Parent Directory Merger
 * Dual Excel (.xlsx/.xls/.csv) AI Phone Column Detection, Name Matching & Live Auto-Refresh Tracker
 */

let uploadMode = 'dual'; // 'dual' or 'single'
let rawResultsRows = null;
let rawContactsRows = null;

let studentsData = [];
let subjectColumns = [];
let dispatchedMessagesMap = {};
let autoRefreshTimer = null;
let currentFilter = 'ALL';

let GATEWAY_URL = localStorage.getItem('schoolGatewayUrl') || 'https://sms.simukitaa.com';
let API_KEY = localStorage.getItem('schoolApiKey') || sessionStorage.getItem('cfg_api_key') || '';

let isBatchDispatching = false;

// ============================================================
// Initialization & Config
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    const gatewayEl = document.getElementById('cfgGatewayUrl');
    const keyEl = document.getElementById('cfgApiKey');
    if (gatewayEl) gatewayEl.value = GATEWAY_URL;
    if (keyEl) keyEl.value = API_KEY;

    initSchoolIdentity();
    startAutoRefreshTracker();
    restoreUploadStateFromSession();
});

// Warn user if refreshing while SMS dispatching is actively running
window.addEventListener('beforeunload', (e) => {
    if (isBatchDispatching) {
        e.preventDefault();
        e.returnValue = 'SMS batch dispatching is currently in progress! Refreshing will interrupt the operation.';
        return e.returnValue;
    }
});

let currentSchoolInfo = null;

async function initSchoolIdentity() {
    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get('schoolCode') || params.get('code') || params.get('tenantId');
    const keyParam  = params.get('apiKey') || params.get('key');

    if (keyParam) {
        API_KEY = keyParam;
        localStorage.setItem('schoolApiKey', API_KEY);
    }

    let savedTenant = null;
    try {
        savedTenant = JSON.parse(sessionStorage.getItem('schoolTenant') || localStorage.getItem('schoolTenant') || 'null');
    } catch(e){}

    if (codeParam) {
        try {
            const res = await fetch(`${GATEWAY_URL}/api/school/info-by-code/${codeParam}`);
            if (res.ok) {
                currentSchoolInfo = await res.json();
                if (currentSchoolInfo.apiKey) {
                    API_KEY = currentSchoolInfo.apiKey;
                    localStorage.setItem('schoolApiKey', API_KEY);
                }
            }
        } catch(e) {}
    }

    if (!currentSchoolInfo && savedTenant) {
        currentSchoolInfo = {
            schoolName: savedTenant.schoolName || savedTenant.name || 'School Account',
            schoolCode: savedTenant.schoolCode || 'SCH',
            region: savedTenant.region || 'Tanzania',
            apiKey: savedTenant.apiKey || API_KEY,
            subscriptionStatus: savedTenant.subscriptionStatus || 'ACTIVE'
        };
        if (savedTenant.apiKey) API_KEY = savedTenant.apiKey;
    }

    if (!currentSchoolInfo) {
        currentSchoolInfo = {
            schoolName: 'St. Joseph Secondary School',
            schoolCode: 'SCH-4921',
            region: 'Dar es Salaam',
            apiKey: API_KEY || 'sk_live_demo_key',
            subscriptionStatus: 'ACTIVE'
        };
    }

    applySchoolIdentityToUI(currentSchoolInfo);
}

function applySchoolIdentityToUI(info) {
    const sName  = info.schoolName || 'School';
    const sCode  = info.schoolCode || 'SCH';
    const sRegion= info.region || 'Tanzania';
    const sKey   = info.apiKey || API_KEY || 'sk_live_...';
    const status = info.subscriptionStatus || 'ACTIVE';

    if (document.getElementById('schoolIdentityTitle'))  document.getElementById('schoolIdentityTitle').textContent = sName;
    if (document.getElementById('schoolIdentityCode'))   document.getElementById('schoolIdentityCode').textContent = sCode;
    if (document.getElementById('schoolIdentityRegion')) document.getElementById('schoolIdentityRegion').textContent = sRegion;
    if (document.getElementById('schoolIdentityKey'))    document.getElementById('schoolIdentityKey').textContent = sKey.substring(0, 12) + '...';
    if (document.getElementById('schoolAvatarPill'))     document.getElementById('schoolAvatarPill').textContent = sName.charAt(0).toUpperCase();

    const badge = document.getElementById('schoolIdentityStatusBadge');
    if (badge) {
        badge.className = `status-badge ${status === 'ACTIVE' ? 'bg-green' : 'bg-yellow'}`;
        badge.innerHTML = status === 'ACTIVE' ? '🟢 ACTIVE' : '⏳ PENDING';
    }

    if (window.lucide) lucide.createIcons();
}

function switchSchoolPrompt() {
    const code = prompt('Enter School Code or REST API Key to switch active school identity:');
    if (!code) return;
    window.location.href = `?schoolCode=${encodeURIComponent(code.trim())}`;
}

function openSettingsModal() {
    const modal = document.getElementById('settingsModal') || document.getElementById('configModal');
    if (modal) modal.style.display = 'flex';
}

function closeSettingsModal() {
    const modal = document.getElementById('settingsModal') || document.getElementById('configModal');
    if (modal) modal.style.display = 'none';
}

function openConfigModal() { openSettingsModal(); }
function closeConfigModal() { closeSettingsModal(); }

function saveConfig() {
    const gatewayEl = document.getElementById('cfgGatewayUrl');
    const keyEl = document.getElementById('cfgApiKey');
    if (gatewayEl) GATEWAY_URL = gatewayEl.value.trim().replace(/\/$/, '');
    if (keyEl) API_KEY = keyEl.value.trim();

    localStorage.setItem('schoolGatewayUrl', GATEWAY_URL);
    localStorage.setItem('schoolApiKey', API_KEY);

    closeSettingsModal();
    logTerminalEvent('CONFIG', 'Updated Gateway API Key & Host URL settings.');
    alert('Gateway settings saved!');
}

function setUploadMode(mode) {
    uploadMode = mode;
    const btnDual = document.getElementById('btnDualMode') || document.getElementById('tabModeDual');
    const btnSingle = document.getElementById('btnSingleMode') || document.getElementById('tabModeSingle');

    if (btnDual) btnDual.classList.toggle('active', mode === 'dual');
    if (btnSingle) btnSingle.classList.toggle('active', mode === 'single');

    const dzContacts = document.getElementById('dzContacts');
    if (dzContacts) dzContacts.style.display = mode === 'dual' ? 'block' : 'none';

    const step2Title = document.getElementById('step2Title');
    if (step2Title) step2Title.textContent = mode === 'dual' ? 'Upload Excel Files (Exam Results + Parent Contacts)' : 'Upload Single Combined Excel File';
}

function switchUploadMode(mode) { setUploadMode(mode); }

function logTerminalEvent(type, text) {
    const box = document.getElementById('terminalLog') || document.getElementById('terminalContent');
    if (!box) return;

    const time = new Date().toLocaleTimeString();
    let typeCls = 'color:var(--gh-blue)';
    if (type === 'DELIVERED') typeCls = 'color:var(--gh-green)';
    if (type === 'FAILED') typeCls = 'color:var(--gh-red)';
    if (type === 'SENDING' || type === 'QUEUED') typeCls = 'color:var(--gh-yellow)';

    const line = document.createElement('div');
    line.className = 'terminal-line';
    line.innerHTML = `<span class="t-time">[${time}]</span> <strong style="${typeCls}">[${type}]</strong> ${text}`;

    box.prepend(line);
    if (box.children.length > 50) box.removeChild(box.lastChild);
}

// ============================================================
// File Handlers & Compatibility Aliases
// ============================================================
function handleResultsFileUpload(event) { handleFileResults(event); }
function handleContactsFileUpload(event) { handleFileContacts(event); }
function handleSingleFileUpload(event) { handleFileSingle(event); }

function handleFileResults(event) {
    const file = event.target.files[0];
    if (!file) return;

    readExcelFile(file, rows => {
        rawResultsRows = rows;

        const dz = document.getElementById('dzResults');
        if (dz) dz.classList.add('loaded');

        const badge = document.getElementById('badgeResults') || document.getElementById('resultsFileBadge');
        if (badge) {
            badge.textContent = `✅ ${file.name} (${rows.length} rows)`;
            badge.style.background = 'rgba(63,185,80,0.15)';
            badge.style.color = 'var(--gh-green)';
            badge.style.borderColor = 'rgba(63,185,80,0.3)';
        }

        const fileNameText = document.getElementById('resultsFileNameText');
        if (fileNameText) fileNameText.textContent = file.name;

        logTerminalEvent('FILE', `Loaded Results spreadsheet: ${file.name} (${rows.length} rows)`);

        if (uploadMode === 'single') {
            rawContactsRows = rows;
        }

        checkAndMergeFiles();
    });
}

function handleFileContacts(event) {
    const file = event.target.files[0];
    if (!file) return;

    readExcelFile(file, rows => {
        rawContactsRows = rows;

        const dz = document.getElementById('dzContacts');
        if (dz) dz.classList.add('loaded');

        const badge = document.getElementById('badgeContacts') || document.getElementById('contactsFileBadge');
        if (badge) {
            badge.textContent = `✅ ${file.name} (${rows.length} rows)`;
            badge.style.background = 'rgba(63,185,80,0.15)';
            badge.style.color = 'var(--gh-green)';
            badge.style.borderColor = 'rgba(63,185,80,0.3)';
        }

        const fileNameText = document.getElementById('contactsFileNameText');
        if (fileNameText) fileNameText.textContent = file.name;

        logTerminalEvent('FILE', `Loaded Parent Contacts spreadsheet: ${file.name} (${rows.length} rows)`);
        checkAndMergeFiles();
    });
}

function handleFileSingle(event) {
    handleFileResults(event);
}

function readExcelFile(file, callback) {
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

            if (!json.length) {
                alert(`File "${file.name}" has no data rows.`);
                return;
            }
            callback(json);
        } catch (err) {
            alert(`Error reading file "${file.name}": ${err.message}`);
        }
    };
    reader.onerror = () => {
        alert(`Failed to read file "${file.name}". Please select a valid Excel (.xlsx/.xls) or CSV file.`);
    };
    reader.readAsArrayBuffer(file);
}

// ============================================================
// AI Phone Column Detection Heuristic
// ============================================================
function detectPhoneColumn(rows) {
    if (!rows || !rows.length) return null;
    const headers = Object.keys(rows[0]);

    let found = headers.find(h => /phone|mobile|tel|simu|contact|parent|mzazi|namba/i.test(h));
    if (found) return found;

    for (let header of headers) {
        let matchCount = 0;
        for (let i = 0; i < Math.min(rows.length, 15); i++) {
            let val = String(rows[i][header] || '').replace(/[\s\-\(\)]/g, '');
            if (/^(\+?255|0)[67]\d{8}$/.test(val) || (/^\d{9,13}$/.test(val) && !/id|sn|index/i.test(header))) {
                matchCount++;
            }
        }
        if (matchCount >= 2) return header;
    }

    return headers[1] || headers[0];
}

function detectNameColumn(rows) {
    if (!rows || !rows.length) return null;
    const headers = Object.keys(rows[0]);
    return headers.find(h => /name|student|mwanafunzi|jina|full_name/i.test(h)) || headers[0];
}

// ============================================================
// Dual File Fuzzy Matching & Merging Engine
// ============================================================
function checkAndMergeFiles() {
    if (uploadMode === 'dual' && (!rawResultsRows || !rawContactsRows)) {
        return;
    }

    const resultsNameCol = detectNameColumn(rawResultsRows);
    const contactsNameCol = detectNameColumn(rawContactsRows || rawResultsRows);
    const contactsPhoneCol = detectPhoneColumn(rawContactsRows || rawResultsRows);

    const resHeaders = Object.keys(rawResultsRows[0]);
    subjectColumns = resHeaders.filter(h =>
        /\(.*\)/.test(h) ||
        (/math|english|science|physics|chemistry|biology|geography|history|civics|kiswahili|ict|kisw|biol|chem|geog|hist/i.test(h) && h !== resultsNameCol)
    );

    const contactsMap = {};
    if (rawContactsRows) {
        rawContactsRows.forEach(row => {
            let name = String(row[contactsNameCol] || '').trim();
            let phone = String(row[contactsPhoneCol] || '').trim();

            if (phone && !phone.startsWith('+')) {
                if (phone.startsWith('0')) phone = '+255' + phone.substring(1);
                else phone = '+' + phone;
            }

            if (name) {
                contactsMap[normalizeName(name)] = phone;
            }
        });
    }

    let matchedCount = 0;

    studentsData = rawResultsRows.map((row, idx) => {
        let rawName = String(row[resultsNameCol] || '').trim();
        let normName = normalizeName(rawName);

        let matchedPhone = contactsMap[normName];

        if (!matchedPhone) {
            const keys = Object.keys(contactsMap);
            const foundKey = keys.find(k => k.includes(normName) || normName.includes(k));
            if (foundKey) matchedPhone = contactsMap[foundKey];
        }

        const isMatched = Boolean(matchedPhone);
        if (isMatched) matchedCount++;

        let subjects = {};
        let subjectSummaryList = [];

        subjectColumns.forEach(col => {
            let val = String(row[col] || '').trim();
            if (val) {
                let cleanColName = col.replace(/\(.*\)/, '').trim() || col;
                subjects[cleanColName] = val;
                subjectSummaryList.push(`${cleanColName}: ${val}`);
            }
        });

        return {
            id: idx + 1,
            name: rawName || `Student #${idx + 1}`,
            phone: matchedPhone || 'No Phone',
            isMatched: isMatched,
            subjects: subjects,
            subjectSummaryText: subjectSummaryList.join(', ') || 'No grades listed',
            position: idx + 1,
            smsStatus: isMatched ? 'NOT_SENT' : 'MISSING',
            messageUid: null
        };
    });

    const totalStudents = studentsData.length;
    studentsData.forEach(s => s.totalStudents = totalStudents);

    // Update Summary Stats
    if (document.getElementById('statTotalStudents')) document.getElementById('statTotalStudents').textContent = totalStudents;
    if (document.getElementById('statMatchedPhones'))  document.getElementById('statMatchedPhones').textContent = matchedCount;
    if (document.getElementById('statDetectedSubjects')) document.getElementById('statDetectedSubjects').textContent = subjectColumns.length;
    if (document.getElementById('statReadySms'))       document.getElementById('statReadySms').textContent = matchedCount;

    if (document.getElementById('statMatchRate'))      document.getElementById('statMatchRate').textContent = `${Math.round((matchedCount / (totalStudents || 1)) * 100)}%`;

    // Show Results Preview Section
    const resultsSection = document.getElementById('cardResultsSection') || document.getElementById('resultsTableCard');
    if (resultsSection) resultsSection.style.display = 'block';

    const sendBtn = document.getElementById('btnSendAll') || document.getElementById('sendAllBtn');
    if (sendBtn) sendBtn.disabled = false;

    logTerminalEvent('MERGE', `Successfully merged ${matchedCount}/${totalStudents} student records with parent phone numbers.`);

    updateSmsPreviews();
    updateProgressStats();
    renderTable();

    persistUploadStateToSession();

    // Smooth scroll down to preview section on mobile
    if (resultsSection) {
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// ============================================================
// Session Persistence & Auto-Recovery
// ============================================================
function persistUploadStateToSession() {
    if (!studentsData || !studentsData.length) return;
    try {
        const templateInput = document.getElementById('smsTemplateText') || document.getElementById('smsTemplateInput');
        const stateData = {
            uploadMode,
            subjectColumns,
            studentsData,
            dispatchedMessagesMap,
            templateText: templateInput ? templateInput.value : '',
            savedAt: Date.now()
        };
        sessionStorage.setItem('schoolUploadSessionState', JSON.stringify(stateData));
    } catch (e) {
        console.warn('Failed to persist session state:', e);
    }
}

function restoreUploadStateFromSession() {
    try {
        const rawState = sessionStorage.getItem('schoolUploadSessionState');
        if (!rawState) return;

        const state = JSON.parse(rawState);
        if (!state || !state.studentsData || !state.studentsData.length) return;

        uploadMode = state.uploadMode || 'dual';
        subjectColumns = state.subjectColumns || [];
        studentsData = state.studentsData || [];
        dispatchedMessagesMap = state.dispatchedMessagesMap || {};

        if (state.templateText) {
            const templateInput = document.getElementById('smsTemplateText') || document.getElementById('smsTemplateInput');
            if (templateInput) templateInput.value = state.templateText;
        }

        const totalStudents = studentsData.length;
        const matchedCount = studentsData.filter(s => s.isMatched).length;

        if (document.getElementById('statTotalStudents')) document.getElementById('statTotalStudents').textContent = totalStudents;
        if (document.getElementById('statMatchedPhones'))  document.getElementById('statMatchedPhones').textContent = matchedCount;
        if (document.getElementById('statDetectedSubjects')) document.getElementById('statDetectedSubjects').textContent = subjectColumns.length;
        if (document.getElementById('statReadySms'))       document.getElementById('statReadySms').textContent = matchedCount;

        const resultsSection = document.getElementById('cardResultsSection') || document.getElementById('resultsTableCard');
        if (resultsSection) resultsSection.style.display = 'block';

        const notice = document.getElementById('sessionRestoredNotice');
        if (notice) notice.style.display = 'block';

        const sendBtn = document.getElementById('btnSendAll') || document.getElementById('sendAllBtn');
        if (sendBtn) sendBtn.disabled = false;

        logTerminalEvent('RESTORE', `Restored previous active session: ${matchedCount}/${totalStudents} student records.`);

        updateSmsPreviews();
        updateProgressStats();
        renderTable();
    } catch (e) {
        console.warn('Failed to restore session state:', e);
    }
}

function resetUploadSession() {
    if (studentsData.length && !confirm('Clear active upload session and start a new file upload?')) return;

    studentsData = [];
    rawResultsRows = null;
    rawContactsRows = null;
    dispatchedMessagesMap = {};
    subjectColumns = [];
    isBatchDispatching = false;

    sessionStorage.removeItem('schoolUploadSessionState');

    const dzR = document.getElementById('dzResults');
    const dzC = document.getElementById('dzContacts');
    if (dzR) dzR.classList.remove('loaded');
    if (dzC) dzC.classList.remove('loaded');

    const badgeR = document.getElementById('badgeResults');
    const badgeC = document.getElementById('badgeContacts');
    if (badgeR) { badgeR.textContent = 'Tap or drag file here'; badgeR.style = ''; }
    if (badgeC) { badgeC.textContent = 'Tap or drag file here'; badgeC.style = ''; }

    const resultsSection = document.getElementById('cardResultsSection') || document.getElementById('resultsTableCard');
    if (resultsSection) resultsSection.style.display = 'none';

    const notice = document.getElementById('sessionRestoredNotice');
    if (notice) notice.style.display = 'none';

    logTerminalEvent('RESET', 'Cleared upload session. Ready for new files.');
}

function normalizeName(name) {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// ============================================================
// Live Progress Meter & Counters
// ============================================================
function updateProgressStats() {
    const total = studentsData.length;
    const delivered = studentsData.filter(s => s.smsStatus === 'DELIVERED').length;
    const sending = studentsData.filter(s => ['PENDING','SENDING','SENT'].includes(s.smsStatus)).length;
    const failed = studentsData.filter(s => ['FAILED','EXPIRED'].includes(s.smsStatus)).length;
    const missing = studentsData.filter(s => s.phone === 'No Phone' || s.smsStatus === 'MISSING').length;

    if (document.getElementById('countDelivered')) document.getElementById('countDelivered').textContent = `🟢 Delivered: ${delivered}`;
    if (document.getElementById('countSending'))   document.getElementById('countSending').textContent = `⚡ Sending: ${sending}`;
    if (document.getElementById('countFailed'))    document.getElementById('countFailed').textContent = `🔴 Failed: ${failed}`;

    const completed = delivered + failed;
    const percent = total > 0 ? Math.round((completed / (total - missing || 1)) * 100) : 0;

    const fill = document.getElementById('progressBarFill');
    if (fill) fill.style.width = `${Math.min(percent, 100)}%`;
}

function filterTable(filter, el) {
    currentFilter = filter;
    if (el && el.parentNode) {
        el.parentNode.querySelectorAll('button').forEach(b => b.classList.remove('gh-btn-primary'));
        el.classList.add('gh-btn-primary');
    }
    renderTable();
}

function setTableFilter(filter) { filterTable(filter); }

// ============================================================
// SMS Template Preview Engine
// ============================================================
function updateSmsPreviews() {
    if (!studentsData.length) return;

    const textarea = document.getElementById('smsTemplateText') || document.getElementById('smsTemplateInput');
    const previewBox = document.getElementById('smsPreviewSample') || document.getElementById('smsPreviewBox');

    if (!textarea || !previewBox) return;

    const template = textarea.value;
    const sampleText = formatSmsMessage(template, studentsData[0]);
    previewBox.textContent = sampleText;
}

function updateSmsPreview() { updateSmsPreviews(); }

function formatSmsMessage(template, student) {
    const schoolName = (currentSchoolInfo && currentSchoolInfo.schoolName) ? currentSchoolInfo.schoolName : 'School Notify';

    return template
        .replace(/\{STUDENT_NAME\}/g, student.name)
        .replace(/\{StudentName\}/g, student.name)
        .replace(/\{SUBJECTS_SCORES\}/g, student.subjectSummaryText)
        .replace(/\{SubjectResults\}/g, student.subjectSummaryText)
        .replace(/\{SCHOOL_NAME\}/g, schoolName)
        .replace(/\{ParentPhone\}/g, student.phone)
        .replace(/\{Position\}/g, student.position)
        .replace(/\{TotalStudents\}/g, student.totalStudents);
}

// ============================================================
// Table Rendering & Filters
// ============================================================
function renderTable() {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;

    const searchInput = document.getElementById('searchTableInput') || document.getElementById('searchInput');
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';

    const filtered = studentsData.filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(searchTerm) || s.phone.includes(searchTerm);
        if (!matchesSearch) return false;

        if (currentFilter === 'SENT') return ['PENDING','SENDING','SENT','DELIVERED'].includes(s.smsStatus);
        if (currentFilter === 'DELIVERED') return s.smsStatus === 'DELIVERED';
        if (currentFilter === 'FAILED') return ['FAILED','EXPIRED'].includes(s.smsStatus);
        return true;
    });

    if (!filtered.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-cell">No matching student records found.</td></tr>';
        return;
    }

    const templateInput = document.getElementById('smsTemplateText') || document.getElementById('smsTemplateInput');
    const template = templateInput ? templateInput.value : '';

    tbody.innerHTML = filtered.map(s => {
        const gradePills = Object.entries(s.subjects).map(([subj, gr]) => `
            <span class="grade-pill" style="font-size:11px; background:var(--gh-subtle-bg); border:1px solid var(--gh-border); padding:2px 6px; border-radius:4px; margin-right:4px;">${subj}: <b style="color:var(--gh-blue);">${gr}</b></span>
        `).join('');

        const statusBadge = getStatusBadgeHtml(s.smsStatus);
        const smsText = template ? formatSmsMessage(template, s) : s.subjectSummaryText;

        return `
            <tr>
                <td style="font-family:var(--font-mono); font-size:11px">${s.id}</td>
                <td>
                    <div style="font-weight:700; color:var(--gh-text); font-size:13.5px;">${s.name}</div>
                </td>
                <td style="font-family:var(--font-mono); font-size:12px; font-weight:600; color:var(--gh-blue);">${s.phone}</td>
                <td>${gradePills || s.subjectSummaryText}</td>
                <td style="font-size:12px; color:var(--gh-text-muted); max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${smsText.replace(/"/g, '&quot;')}">${smsText}</td>
                <td>${statusBadge}</td>
                <td>
                    <button class="gh-btn gh-btn-outline" style="padding:4px 8px; font-size:11px;" onclick="sendSingleStudentSms(${s.id - 1})" ${s.phone === 'No Phone' ? 'disabled' : ''}>
                        ${s.smsStatus === 'NOT_SENT' ? '✉️ Send SMS' : '🔄 Resend'}
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    if (window.lucide) lucide.createIcons();
}

function getStatusBadgeHtml(status) {
    switch (status) {
        case 'PENDING':   return '<span class="status-badge bg-yellow"><i data-lucide="clock" class="inline-icon"></i> PENDING</span>';
        case 'SENDING':   return '<span class="status-badge bg-blue"><i data-lucide="zap" class="inline-icon"></i> SENDING</span>';
        case 'SENT':      return '<span class="status-badge bg-blue"><i data-lucide="send" class="inline-icon"></i> SENT</span>';
        case 'DELIVERED': return '<span class="status-badge bg-green"><i data-lucide="check-circle-2" class="inline-icon"></i> DELIVERED</span>';
        case 'FAILED':    return '<span class="status-badge bg-red"><i data-lucide="alert-triangle" class="inline-icon"></i> FAILED</span>';
        case 'MISSING':   return '<span class="status-badge bg-red"><i data-lucide="phone-off" class="inline-icon"></i> NO PHONE</span>';
        default:          return '<span class="status-badge" style="background:var(--gh-subtle-bg); color:var(--gh-text-muted);">Not Sent</span>';
    }
}

function searchStudentsTable() { renderTable(); }

// ============================================================
// API Dispatching & Bulk SMS Execution
// ============================================================
async function sendSingleStudentSms(index) {
    if (!API_KEY) {
        openSettingsModal();
        alert('Please enter your REST API Key to send SMS!');
        return;
    }

    const student = studentsData[index];
    if (!student || student.phone === 'No Phone') {
        logTerminalEvent('SKIPPED', `Skipped SMS for ${student ? student.name : 'Unknown'}: No parent phone matched.`);
        return;
    }

    const templateInput = document.getElementById('smsTemplateText') || document.getElementById('smsTemplateInput');
    const template = templateInput ? templateInput.value : '';
    const msgText = formatSmsMessage(template, student);

    student.smsStatus = 'PENDING';
    logTerminalEvent('QUEUED', `Queued SMS for ${student.name} (${student.phone})`);
    updateProgressStats();
    renderTable();

    try {
        const response = await fetch(`${GATEWAY_URL}/api/v1/sms/send`, {
            method: 'POST',
            headers: {
                'X-API-Key': API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                phoneNumber: student.phone,
                message: msgText,
                priority: 1
            })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({ message: response.statusText }));
            throw new Error(err.message || `HTTP ${response.status}`);
        }

        const data = await response.json();
        student.smsStatus = data.status || 'PENDING';
        student.messageUid = data.messageUid;

        if (data.messageUid) {
            dispatchedMessagesMap[data.messageUid] = index;
        }

        logTerminalEvent('SENDING', `Dispatched SMS to ${student.name} → Gateway Queue`);

        const progressMonitor = document.getElementById('progressMonitorBox');
        if (progressMonitor) progressMonitor.style.display = 'block';

        updateProgressStats();
        renderTable();
    } catch (e) {
        student.smsStatus = 'FAILED';
        logTerminalEvent('FAILED', `Error sending to ${student.name}: ${e.message}`);
        updateProgressStats();
        renderTable();
    }
}

async function sendSmsToAll() {
    if (!API_KEY) {
        openSettingsModal();
        alert('Please configure your REST API Key first!');
        return;
    }

    const validStudents = studentsData.filter(s => s.phone !== 'No Phone');
    if (!validStudents.length) {
        alert('No valid student records with matched phone numbers found.');
        return;
    }

    if (!confirm(`Send exam results SMS to all ${validStudents.length} matched parents now?`)) return;

    isBatchDispatching = true;

    const btn = document.getElementById('btnSendAll') || document.getElementById('sendAllBtn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '⏳ Dispatching SMS Batch...';
    }

    const progressMonitor = document.getElementById('progressMonitorBox');
    if (progressMonitor) progressMonitor.style.display = 'block';

    logTerminalEvent('BATCH', `Starting batch dispatch to ${validStudents.length} parents...`);

    try {
        for (let i = 0; i < studentsData.length; i++) {
            if (studentsData[i].phone === 'No Phone' || studentsData[i].smsStatus === 'DELIVERED') continue;
            await sendSingleStudentSms(i);
            persistUploadStateToSession();
            await new Promise(r => setTimeout(r, 300));
        }
    } finally {
        isBatchDispatching = false;
    }

    if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="send" class="btn-icon"></i> Dispatch SMS to All Parents';
        if (window.lucide) lucide.createIcons();
    }
    logTerminalEvent('BATCH', `All ${validStudents.length} student SMS dispatches submitted to gateway.`);
    persistUploadStateToSession();
}

function triggerSendAllSms() { sendSmsToAll(); }

// ============================================================
// Auto-Refresh Tracker
// ============================================================
function startAutoRefreshTracker() {
    if (autoRefreshTimer) clearInterval(autoRefreshTimer);

    autoRefreshTimer = setInterval(async () => {
        const activeUids = Object.keys(dispatchedMessagesMap);
        if (!activeUids.length || !API_KEY) return;

        try {
            const res = await fetch(`${GATEWAY_URL}/api/v1/sms/history?page=0&size=50`, {
                headers: { 'X-API-Key': API_KEY }
            });

            if (!res.ok) return;
            const data = await res.json();
            const list = data.content || data || [];

            list.forEach(msg => {
                if (dispatchedMessagesMap[msg.messageUid] !== undefined) {
                    const studentIdx = dispatchedMessagesMap[msg.messageUid];
                    const student = studentsData[studentIdx];
                    if (student && student.smsStatus !== msg.status) {
                        student.smsStatus = msg.status;
                        logTerminalEvent(msg.status, `SMS ${msg.messageUid.substring(0, 8)} for ${student.name} → ${msg.status}`);
                        if (['DELIVERED','FAILED'].includes(msg.status)) {
                            delete dispatchedMessagesMap[msg.messageUid];
                        }
                    }
                }
            });

            updateProgressStats();
            renderTable();
        } catch (e) {
            // Silent
        }
    }, 3000);
}

// ============================================================
// Export Merged Excel File
// ============================================================
function exportMergedExcel() {
    if (!studentsData.length) return;

    const exportRows = studentsData.map(s => {
        let rowObj = {
            "Student Name": s.name,
            "Parent Phone": s.phone,
            "Match Status": s.isMatched ? "MATCHED" : "UNMATCHED",
            "SMS Status": s.smsStatus
        };
        Object.assign(rowObj, s.subjects);
        return rowObj;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Merged Results");

    XLSX.writeFile(workbook, "Master_Merged_School_Results.xlsx");
    logTerminalEvent('EXPORT', 'Exported Master_Merged_School_Results.xlsx file.');
}

// ============================================================
// Sample Excel Generator
// ============================================================
function generateSampleFiles() { downloadSampleExcel(); }

function downloadSampleExcel() {
    const sampleResults = [
        { "Student Name": "Juma Ali", "Math (A)": "A", "English (B+)": "B+", "Physics (A)": "A", "Chemistry (B)": "B" },
        { "Student Name": "Sarah Kelvin", "Math (A)": "A*", "English (B+)": "A", "Physics (A)": "A", "Chemistry (B)": "A" },
        { "Student Name": "Emmanuel John", "Math (A)": "B", "English (B+)": "B", "Physics (A)": "C", "Chemistry (B)": "B" }
    ];
    const ws1 = XLSX.utils.json_to_sheet(sampleResults);
    const wb1 = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb1, ws1, "Grades");
    XLSX.writeFile(wb1, "File1_Exam_Results_Sample.xlsx");

    const sampleContacts = [
        { "Student Name": "Juma Ali", "Parent Mobile Number": "+25575855909" },
        { "Student Name": "Sarah Kelvin", "Parent Mobile Number": "+255712345678" },
        { "Student Name": "Emmanuel John", "Parent Mobile Number": "+255765432109" }
    ];
    const ws2 = XLSX.utils.json_to_sheet(sampleContacts);
    const wb2 = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb2, ws2, "Parent Contacts");
    XLSX.writeFile(wb2, "File2_Parent_Contacts_Sample.xlsx");

    logTerminalEvent('DOWNLOAD', 'Downloaded sample Excel templates File1 & File2.');
}
