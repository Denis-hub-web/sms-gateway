/**
 * School Exam Results & Parent Directory Merger Engine
 * Client-Side Excel (.xlsx / .xls) Parser, AI Column Detection, Fuzzy Matching & SMS Dispatcher
 */

let uploadMode = 'dual'; // 'dual' or 'single'
let rawResultsRows = null;
let rawContactsRows = null;

let studentsData = [];
let subjectColumns = [];
let dispatchedMessagesMap = {};
let autoRefreshTimer = null;
let currentFilter = 'ALL';

let GATEWAY_URL = localStorage.getItem('schoolGatewayUrl') || 'https://sms-gateway-qtmi.onrender.com';
let API_KEY = localStorage.getItem('schoolApiKey') || '';
let currentSchoolInfo = null;

// ============================================================
// Initialization & School Identity
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    initSchoolIdentity();
    setupDropzones();
    startAutoRefreshTracker();
});

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
        savedTenant = JSON.parse(localStorage.getItem('schoolTenant'));
    } catch (e) {}

    // Lookup school info by code if passed
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
        } catch (e) {}
    }

    if (!currentSchoolInfo && savedTenant) {
        currentSchoolInfo = {
            schoolName: savedTenant.schoolName || savedTenant.name || 'School Account',
            schoolCode: savedTenant.schoolCode || 'SCH',
            region: savedTenant.region || 'Tanzania',
            apiKey: savedTenant.apiKey || API_KEY,
            subscriptionStatus: savedTenant.subscriptionStatus || 'ACTIVE'
        };
        if (savedTenant.apiKey) {
            API_KEY = savedTenant.apiKey;
            localStorage.setItem('schoolApiKey', API_KEY);
        }
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

    if (document.getElementById('cfgGatewayUrl')) {
        document.getElementById('cfgGatewayUrl').value = GATEWAY_URL;
    }
    if (document.getElementById('cfgApiKey')) {
        document.getElementById('cfgApiKey').value = API_KEY;
    }
}

function applySchoolIdentityToUI(info) {
    const sName   = info.schoolName || 'School';
    const sCode   = info.schoolCode || 'SCH';
    const sRegion = info.region || 'Tanzania';
    const sKey    = info.apiKey || API_KEY || 'sk_live_...';
    const status  = info.subscriptionStatus || 'ACTIVE';

    if (document.getElementById('schoolIdentityTitle')) {
        document.getElementById('schoolIdentityTitle').textContent = sName;
    }
    if (document.getElementById('schoolIdentityCode')) {
        document.getElementById('schoolIdentityCode').textContent = sCode;
    }
    if (document.getElementById('schoolIdentityRegion')) {
        document.getElementById('schoolIdentityRegion').textContent = sRegion;
    }
    if (document.getElementById('schoolIdentityKey')) {
        document.getElementById('schoolIdentityKey').textContent = sKey.length > 15 ? sKey.substring(0, 14) + '...' : sKey;
    }
    if (document.getElementById('schoolAvatarPill')) {
        document.getElementById('schoolAvatarPill').textContent = sName.charAt(0).toUpperCase();
    }

    const badge = document.getElementById('schoolIdentityStatusBadge');
    if (badge) {
        badge.className = `status-badge ${status === 'ACTIVE' ? 'bg-green' : 'bg-yellow'}`;
        badge.innerHTML = `<i data-lucide="${status === 'ACTIVE' ? 'check-circle-2' : 'clock'}" class="inline-icon"></i> ${status}`;
    }

    if (window.lucide) lucide.createIcons();
}

function switchSchoolPrompt() {
    const code = prompt('Enter School Code or API Key to link:');
    if (!code) return;
    window.location.href = `?schoolCode=${encodeURIComponent(code.trim())}`;
}

// ============================================================
// Workflow Modes & Dropzones
// ============================================================
function setUploadMode(mode) {
    uploadMode = mode;
    document.getElementById('btnDualMode').classList.toggle('active', mode === 'dual');
    document.getElementById('btnSingleMode').classList.toggle('active', mode === 'single');

    const dzContacts = document.getElementById('dzContacts');
    const step2Title = document.getElementById('step2Title');

    if (mode === 'single') {
        dzContacts.style.display = 'none';
        step2Title.textContent = 'Upload Single Combined Excel Sheet';
        document.querySelector('#dzResults h4').textContent = 'Combined Results & Contacts File (.xlsx)';
        document.querySelector('#dzResults p').innerHTML = 'Must contain <strong>Student Name</strong>, <strong>Parent Phone</strong> & <strong>Grade Columns</strong>';
    } else {
        dzContacts.style.display = 'block';
        step2Title.textContent = 'Upload Excel Files';
        document.querySelector('#dzResults h4').textContent = '1. Exam Results Excel File (.xlsx)';
        document.querySelector('#dzResults p').innerHTML = 'Must contain <strong>Student Name</strong> column and grade columns like <strong>Math (A)</strong>, <strong>Physics (B)</strong>';
    }

    rawResultsRows = null;
    rawContactsRows = null;
    document.getElementById('badgeResults').textContent = 'Click or drag & drop file';
    document.getElementById('badgeContacts').textContent = 'Click or drag & drop file';
    document.getElementById('dzResults').classList.remove('loaded');
    document.getElementById('dzContacts').classList.remove('loaded');
    document.getElementById('cardResultsSection').style.display = 'none';
}

function setupDropzones() {
    ['dzResults', 'dzContacts'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;

        ['dragenter', 'dragover'].forEach(eventName => {
            el.addEventListener(eventName, e => {
                e.preventDefault();
                e.stopPropagation();
                el.classList.add('dragover');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            el.addEventListener(eventName, e => {
                e.preventDefault();
                e.stopPropagation();
                el.classList.remove('dragover');
            }, false);
        });

        el.addEventListener('drop', e => {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (!files || !files.length) return;

            if (id === 'dzResults') {
                processResultsFile(files[0]);
            } else {
                processContactsFile(files[0]);
            }
        }, false);
    });
}

// ============================================================
// File Selection Handlers
// ============================================================
function handleResultsFileUpload(event) {
    const file = event.target.files[0];
    if (file) processResultsFile(file);
}

function handleContactsFileUpload(event) {
    const file = event.target.files[0];
    if (file) processContactsFile(file);
}

function processResultsFile(file) {
    const badge = document.getElementById('badgeResults');
    const dz = document.getElementById('dzResults');
    badge.textContent = `⏳ Reading ${file.name}...`;

    readExcelFile(file, rows => {
        rawResultsRows = rows;
        badge.textContent = `✅ ${file.name} (${rows.length} rows)`;
        dz.classList.add('loaded');

        if (uploadMode === 'single') {
            rawContactsRows = rows;
        }
        checkAndMerge();
    });
}

function processContactsFile(file) {
    const badge = document.getElementById('badgeContacts');
    const dz = document.getElementById('dzContacts');
    badge.textContent = `⏳ Reading ${file.name}...`;

    readExcelFile(file, rows => {
        rawContactsRows = rows;
        badge.textContent = `✅ ${file.name} (${rows.length} rows)`;
        dz.classList.add('loaded');
        checkAndMerge();
    });
}

function readExcelFile(file, callback) {
    if (typeof XLSX === 'undefined') {
        alert('Excel parsing library is loading. Please try again in a second.');
        return;
    }

    const reader = new FileReader();
    reader.onload = e => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const json = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

            if (!json.length) {
                alert(`The file "${file.name}" contains no data rows.`);
                return;
            }
            callback(json);
        } catch (err) {
            alert(`Error reading Excel file: ${err.message}`);
        }
    };
    reader.readAsArrayBuffer(file);
}

// ============================================================
// AI Column Detection & Merging Logic
// ============================================================
function detectNameColumn(rows) {
    if (!rows || !rows.length) return null;
    const headers = Object.keys(rows[0]);
    return headers.find(h => /name|student|mwanafunzi|jina|full_name/i.test(h)) || headers[0];
}

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

function normalizeName(name) {
    return String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function checkAndMerge() {
    if (uploadMode === 'dual' && (!rawResultsRows || !rawContactsRows)) {
        return;
    }
    if (uploadMode === 'single' && !rawResultsRows) {
        return;
    }

    const resultsNameCol = detectNameColumn(rawResultsRows);
    const contactsNameCol = detectNameColumn(rawContactsRows);
    const contactsPhoneCol = detectPhoneColumn(rawContactsRows);

    const resHeaders = Object.keys(rawResultsRows[0]);
    subjectColumns = resHeaders.filter(h =>
        /\(.*\)/.test(h) ||
        (/math|english|science|physics|chemistry|biology|geography|history|civics|kiswahili|ict|kisw|hist/i.test(h) && h !== resultsNameCol)
    );

    const contactsMap = {};
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
            subjectSummaryText: subjectSummaryList.join(', ') || 'Grades recorded',
            smsStatus: isMatched ? 'READY' : 'NO_PHONE',
            messageUid: null
        };
    });

    document.getElementById('statTotalStudents').textContent = studentsData.length;
    document.getElementById('statMatchedPhones').textContent = matchedCount;
    document.getElementById('statDetectedSubjects').textContent = subjectColumns.length;
    document.getElementById('statReadySms').textContent = matchedCount;

    document.getElementById('cardResultsSection').style.display = 'block';

    updateSmsPreviews();
    renderTable();

    document.getElementById('cardResultsSection').scrollIntoView({ behavior: 'smooth' });
}

// ============================================================
// SMS Template Previews
// ============================================================
function updateSmsPreviews() {
    if (!studentsData.length) return;
    const template = document.getElementById('smsTemplateText').value;
    const sample = studentsData[0];
    const preview = formatMessage(template, sample);
    document.getElementById('smsPreviewSample').textContent = preview;

    renderTable();
}

function formatMessage(template, student) {
    const schoolName = currentSchoolInfo ? currentSchoolInfo.schoolName : 'School';
    return template
        .replace(/\{STUDENT_NAME\}/g, student.name)
        .replace(/\{SUBJECTS_SCORES\}/g, student.subjectSummaryText)
        .replace(/\{SCHOOL_NAME\}/g, schoolName);
}

// ============================================================
// Table Rendering & Filters
// ============================================================
function filterTable(filter, btn) {
    currentFilter = filter;
    document.querySelectorAll('.table-toolbar .gh-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderTable();
}

function searchStudentsTable() {
    renderTable();
}

function renderTable() {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;

    const searchTerm = (document.getElementById('searchTableInput')?.value || '').toLowerCase().trim();
    const template = document.getElementById('smsTemplateText')?.value || '';

    const filtered = studentsData.filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(searchTerm) || s.phone.includes(searchTerm);
        if (!matchesSearch) return false;

        if (currentFilter === 'SENT') return ['SENT', 'DELIVERED'].includes(s.smsStatus);
        if (currentFilter === 'FAILED') return s.smsStatus === 'FAILED';
        return true;
    });

    if (!filtered.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-cell" style="text-align:center; padding:30px; color:var(--gh-text-muted);">No matching students found.</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(s => {
        const preview = formatMessage(template, s);
        const statusBadge = getStatusBadge(s.smsStatus);
        const gradeSummary = Object.entries(s.subjects).map(([k, v]) => `<strong>${k}:</strong> ${v}`).join(' | ') || s.subjectSummaryText;

        return `
            <tr>
                <td>${s.id}</td>
                <td><strong>${s.name}</strong></td>
                <td><code style="color:${s.phone !== 'No Phone' ? 'var(--gh-green)' : 'var(--gh-red)'}">${s.phone}</code></td>
                <td style="font-size:12px;">${gradeSummary}</td>
                <td style="font-size:12px; max-width:280px; color:var(--gh-text-muted);">${preview}</td>
                <td>${statusBadge}</td>
                <td>
                    <button class="gh-btn gh-btn-outline" style="font-size:11px; padding:4px 8px;" onclick="sendSingleSms(${s.id - 1})" ${s.phone === 'No Phone' ? 'disabled' : ''}>
                        ${s.smsStatus === 'DELIVERED' ? 'Sent ✅' : 'Send SMS'}
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    if (window.lucide) lucide.createIcons();
}

function getStatusBadge(status) {
    switch (status) {
        case 'READY':     return '<span class="status-badge bg-blue">Ready</span>';
        case 'QUEUED':    return '<span class="status-badge bg-yellow">Queued</span>';
        case 'SENDING':   return '<span class="status-badge bg-yellow">Sending</span>';
        case 'SENT':      return '<span class="status-badge bg-blue">Sent</span>';
        case 'DELIVERED': return '<span class="status-badge bg-green">Delivered</span>';
        case 'FAILED':    return '<span class="status-badge bg-red">Failed</span>';
        case 'NO_PHONE':  return '<span class="status-badge bg-red">No Phone</span>';
        default:          return `<span class="status-badge">${status}</span>`;
    }
}

// ============================================================
// SMS Dispatching Engine
// ============================================================
async function sendSingleSms(index) {
    const student = studentsData[index];
    if (!student || student.phone === 'No Phone') return;

    if (!API_KEY) {
        openSettingsModal();
        alert('Please enter your School API Key first!');
        return;
    }

    const template = document.getElementById('smsTemplateText').value;
    const message = formatMessage(template, student);

    student.smsStatus = 'QUEUED';
    renderTable();

    try {
        const res = await fetch(`${GATEWAY_URL}/api/v1/sms/send`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': API_KEY
            },
            body: JSON.stringify({
                phoneNumber: student.phone,
                message: message,
                priority: 1
            })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ message: res.statusText }));
            throw new Error(err.message || `HTTP ${res.status}`);
        }

        const data = await res.json();
        student.smsStatus = data.status || 'SENT';
        if (data.messageUid) {
            student.messageUid = data.messageUid;
            dispatchedMessagesMap[data.messageUid] = index;
        }
    } catch (e) {
        student.smsStatus = 'FAILED';
        alert(`Failed to send SMS to ${student.name}: ${e.message}`);
    }

    updateProgressBox();
    renderTable();
}

async function sendSmsToAll() {
    const valid = studentsData.filter(s => s.phone !== 'No Phone');
    if (!valid.length) {
        alert('No students with valid parent phone numbers found.');
        return;
    }

    if (!API_KEY) {
        openSettingsModal();
        alert('Please configure your School REST API Key first!');
        return;
    }

    if (!confirm(`Dispatch SMS exam results to all ${valid.length} parents now?`)) {
        return;
    }

    document.getElementById('progressMonitorBox').style.display = 'block';
    const btn = document.getElementById('btnSendAll');
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader" class="spin-icon"></i> Dispatching...';

    for (let i = 0; i < studentsData.length; i++) {
        if (studentsData[i].phone === 'No Phone' || studentsData[i].smsStatus === 'DELIVERED') continue;
        await sendSingleSms(i);
        await new Promise(r => setTimeout(r, 250));
    }

    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="send" class="btn-icon"></i> Dispatch SMS to All Parents';
    if (window.lucide) lucide.createIcons();
}

function updateProgressBox() {
    const total = studentsData.filter(s => s.phone !== 'No Phone').length;
    const delivered = studentsData.filter(s => s.smsStatus === 'DELIVERED').length;
    const sending   = studentsData.filter(s => ['QUEUED', 'SENDING', 'SENT'].includes(s.smsStatus)).length;
    const failed    = studentsData.filter(s => s.smsStatus === 'FAILED').length;

    if (document.getElementById('countDelivered')) {
        document.getElementById('countDelivered').textContent = `🟢 Delivered: ${delivered}`;
    }
    if (document.getElementById('countSending')) {
        document.getElementById('countSending').textContent = `⚡ In Progress: ${sending}`;
    }
    if (document.getElementById('countFailed')) {
        document.getElementById('countFailed').textContent = `🔴 Failed: ${failed}`;
    }

    const completed = delivered + failed;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    if (document.getElementById('progressBarFill')) {
        document.getElementById('progressBarFill').style.width = `${percent}%`;
    }
}

// ============================================================
// Auto-Refresh SMS Delivery Status Tracker (Every 3 seconds)
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
                        if (['DELIVERED', 'FAILED'].includes(msg.status)) {
                            delete dispatchedMessagesMap[msg.messageUid];
                        }
                    }
                }
            });

            updateProgressBox();
            renderTable();
        } catch (e) {}
    }, 3000);
}

// ============================================================
// Settings Modal & Excel Helpers
// ============================================================
function openSettingsModal() {
    document.getElementById('cfgGatewayUrl').value = GATEWAY_URL;
    document.getElementById('cfgApiKey').value = API_KEY;
    document.getElementById('settingsModal').style.display = 'flex';
}

function closeSettingsModal() {
    document.getElementById('settingsModal').style.display = 'none';
}

function saveConfig() {
    GATEWAY_URL = document.getElementById('cfgGatewayUrl').value.trim().replace(/\/$/, '');
    API_KEY = document.getElementById('cfgApiKey').value.trim();

    localStorage.setItem('schoolGatewayUrl', GATEWAY_URL);
    localStorage.setItem('schoolApiKey', API_KEY);

    if (currentSchoolInfo) {
        currentSchoolInfo.apiKey = API_KEY;
        applySchoolIdentityToUI(currentSchoolInfo);
    }

    closeSettingsModal();
    alert('Settings saved successfully!');
}

function exportMergedExcel() {
    if (!studentsData.length || typeof XLSX === 'undefined') return;

    const rows = studentsData.map(s => {
        let obj = {
            "Student Name": s.name,
            "Parent Phone": s.phone,
            "Match Status": s.isMatched ? "MATCHED" : "UNMATCHED",
            "SMS Status": s.smsStatus
        };
        Object.assign(obj, s.subjects);
        return obj;
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Merged Results");
    XLSX.writeFile(wb, "Merged_School_Exam_Results.xlsx");
}

function generateSampleFiles() {
    if (typeof XLSX === 'undefined') return;

    // File 1: Results
    const results = [
        { "Student Name": "Baraka Emmanuel", "Math (A)": "A", "English (B+)": "A", "Physics (A)": "A", "Chemistry (B)": "B+" },
        { "Student Name": "Amina Said", "Math (A)": "A*", "English (B+)": "A", "Physics (A)": "A", "Chemistry (B)": "A" },
        { "Student Name": "Kelvin Mwamba", "Math (A)": "B", "English (B+)": "B", "Physics (A)": "C", "Chemistry (B)": "B" },
        { "Student Name": "Neema Joseph", "Math (A)": "A", "English (B+)": "B+", "Physics (A)": "B", "Chemistry (B)": "A" }
    ];
    const ws1 = XLSX.utils.json_to_sheet(results);
    const wb1 = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb1, ws1, "Exam Results");
    XLSX.writeFile(wb1, "Sample_File1_Exam_Results.xlsx");

    // File 2: Parent Contacts
    const contacts = [
        { "Student Name": "Baraka Emmanuel", "Parent Phone": "+255758559090" },
        { "Student Name": "Amina Said", "Parent Phone": "+255712345678" },
        { "Student Name": "Kelvin Mwamba", "Parent Phone": "+255765432109" },
        { "Student Name": "Neema Joseph", "Parent Phone": "+255788112233" }
    ];
    const ws2 = XLSX.utils.json_to_sheet(contacts);
    const wb2 = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb2, ws2, "Parent Directory");
    XLSX.writeFile(wb2, "Sample_File2_Parent_Contacts.xlsx");
}
