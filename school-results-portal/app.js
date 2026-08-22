/**
 * School Exam Results & Parent Directory Merger
 * Dual Excel (.xlsx/.xls) AI Phone Column Detection, Name Matching & Live Auto-Refresh Tracker
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

// ============================================================
// Initialization & Config
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('cfgGatewayUrl').value = GATEWAY_URL;
    document.getElementById('cfgApiKey').value = API_KEY;

    initSchoolIdentity();
    startAutoRefreshTracker();
});

let currentSchoolInfo = null;

async function initSchoolIdentity() {
    // 1. Check URL parameters for ?schoolCode= or ?apiKey= or ?tenantId=
    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get('schoolCode') || params.get('code') || params.get('tenantId');
    const keyParam  = params.get('apiKey') || params.get('key');

    if (keyParam) {
        API_KEY = keyParam;
        localStorage.setItem('schoolApiKey', API_KEY);
    }

    // 2. Check logged-in tenant in localStorage
    let savedTenant = null;
    try {
        savedTenant = JSON.parse(localStorage.getItem('schoolTenant'));
    } catch(e){}

    // 3. Resolve School Info from backend if codeParam or session exists
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

    // Fallback if no session found
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

    if (document.getElementById('schoolIdentityTitle')) document.getElementById('schoolIdentityTitle').textContent = sName;
    if (document.getElementById('schoolIdentityCode'))  document.getElementById('schoolIdentityCode').textContent = sCode;
    if (document.getElementById('schoolIdentityRegion'))document.getElementById('schoolIdentityRegion').textContent = sRegion;
    if (document.getElementById('schoolIdentityKey'))   document.getElementById('schoolIdentityKey').textContent = sKey.substring(0, 12) + '...';
    if (document.getElementById('schoolAvatarPill'))    document.getElementById('schoolAvatarPill').textContent = sName.charAt(0).toUpperCase();

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

function openConfigModal() {
    document.getElementById('configModal').style.display = 'flex';
}

function closeConfigModal() {
    document.getElementById('configModal').style.display = 'none';
}

function saveConfig() {
    GATEWAY_URL = document.getElementById('cfgGatewayUrl').value.trim().replace(/\/$/, '');
    API_KEY = document.getElementById('cfgApiKey').value.trim();

    localStorage.setItem('schoolGatewayUrl', GATEWAY_URL);
    localStorage.setItem('schoolApiKey', API_KEY);

    closeConfigModal();
    logTerminalEvent('CONFIG', 'Updated Gateway API Key & Host URL settings.');
    alert('Gateway settings saved!');
}

function switchUploadMode(mode) {
    uploadMode = mode;
    document.getElementById('tabModeDual').classList.toggle('active', mode === 'dual');
    document.getElementById('tabModeSingle').classList.toggle('active', mode === 'single');

    document.getElementById('dualUploadSection').style.display = mode === 'dual' ? 'grid' : 'none';
    document.getElementById('singleUploadSection').style.display = mode === 'single' ? 'block' : 'none';
}

function logTerminalEvent(type, text) {
    const box = document.getElementById('terminalLog');
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
// File Handlers
// ============================================================
function handleFileResults(event) {
    const file = event.target.files[0];
    if (!file) return;

    readExcelFile(file, rows => {
        rawResultsRows = rows;
        document.getElementById('resultsFileNameText').textContent = file.name;
        document.getElementById('resultsFileBadge').textContent = `✅ ${rows.length} grade rows loaded`;
        document.getElementById('resultsFileBadge').classList.add('loaded');

        logTerminalEvent('FILE', `Loaded Results spreadsheet: ${file.name} (${rows.length} rows)`);
        checkAndMergeFiles();
    });
}

function handleFileContacts(event) {
    const file = event.target.files[0];
    if (!file) return;

    readExcelFile(file, rows => {
        rawContactsRows = rows;
        document.getElementById('contactsFileNameText').textContent = file.name;
        document.getElementById('contactsFileBadge').textContent = `✅ ${rows.length} contact rows loaded`;
        document.getElementById('contactsFileBadge').classList.add('loaded');

        logTerminalEvent('FILE', `Loaded Parent Contacts spreadsheet: ${file.name} (${rows.length} rows)`);
        checkAndMergeFiles();
    });
}

function handleFileSingle(event) {
    const file = event.target.files[0];
    if (!file) return;

    readExcelFile(file, rows => {
        rawResultsRows = rows;
        rawContactsRows = rows;
        logTerminalEvent('FILE', `Loaded Combined spreadsheet: ${file.name} (${rows.length} rows)`);
        checkAndMergeFiles();
    });
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
                alert(`File ${file.name} has no data rows.`);
                return;
            }
            callback(json);
        } catch (err) {
            alert(`Error reading file ${file.name}: ${err.message}`);
        }
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
    const contactsNameCol = detectNameColumn(rawContactsRows);
    const contactsPhoneCol = detectPhoneColumn(rawContactsRows);

    const resHeaders = Object.keys(rawResultsRows[0]);
    subjectColumns = resHeaders.filter(h =>
        /\(.*\)/.test(h) ||
        (/math|english|science|physics|chemistry|biology|geography|history|civics|kiswahili|ict/i.test(h) && h !== resultsNameCol)
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
            subjectSummaryText: subjectSummaryList.join(', ') || 'No grades listed',
            position: idx + 1,
            smsStatus: isMatched ? 'NOT_SENT' : 'MISSING',
            messageUid: null
        };
    });

    const totalStudents = studentsData.length;
    studentsData.forEach(s => s.totalStudents = totalStudents);

    const matchPercent = Math.round((matchedCount / (totalStudents || 1)) * 100);
    document.getElementById('statMatchRate').textContent = `${matchPercent}%`;
    document.getElementById('statMatchSummary').textContent = `${matchedCount} / ${totalStudents} Matched`;

    document.getElementById('statSubjectCount').textContent = subjectColumns.length;
    document.getElementById('statSubjectList').textContent = subjectColumns.map(c => c.replace(/\(.*\)/, '').trim()).join(', ') || 'Auto-detected';
    document.getElementById('statPhoneColName').textContent = contactsPhoneCol || 'Auto-Detected';

    document.getElementById('progressCard').style.display = 'block';
    document.getElementById('statsRow').style.display = 'grid';
    document.getElementById('templateCard').style.display = 'block';
    document.getElementById('resultsTableCard').style.display = 'block';
    document.getElementById('terminalCard').style.display = 'block';
    document.getElementById('sendAllBtn').disabled = false;

    logTerminalEvent('MERGE', `Successfully merged ${matchedCount}/${totalStudents} student records with parent phone numbers (${matchPercent}% match rate).`);

    updateSmsPreview();
    updateProgressStats();
    renderTable();
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

    document.getElementById('pstatTotal').textContent = total;
    document.getElementById('pstatDelivered').textContent = delivered;
    document.getElementById('pstatSending').textContent = sending;
    document.getElementById('pstatFailed').textContent = failed;
    document.getElementById('pstatMissing').textContent = missing;

    // Filter pill counters
    document.getElementById('cntFilterAll').textContent = total;
    document.getElementById('cntFilterDelivered').textContent = delivered;
    document.getElementById('cntFilterSending').textContent = sending;
    document.getElementById('cntFilterFailed').textContent = failed;
    document.getElementById('cntFilterMissing').textContent = missing;

    const completed = delivered + failed;
    const percent = total > 0 ? Math.round((completed / (total - missing || 1)) * 100) : 0;

    document.getElementById('progressBarFill').style.width = `${Math.min(percent, 100)}%`;
    document.getElementById('progressPercentTag').textContent = `${percent}% Completed`;

    document.getElementById('statSentCount').textContent = sending + delivered;
    document.getElementById('statDeliveredCount').textContent = `${delivered} Delivered`;
}

function setTableFilter(filter) {
    currentFilter = filter;
    document.querySelectorAll('.filter-pill').forEach(btn => {
        btn.classList.toggle('active', btn.textContent.startsWith(filter === 'ALL' ? 'All' : filter === 'DELIVERED' ? '🟢' : filter === 'SENDING' ? '⏳' : filter === 'FAILED' ? '🔴' : '⚠️'));
    });
    renderTable();
}

// ============================================================
// SMS Template Preview Engine
// ============================================================
function updateSmsPreview() {
    if (!studentsData.length) return;

    const template = document.getElementById('smsTemplateInput').value;
    const previewText = formatSmsMessage(template, studentsData[0]);
    document.getElementById('smsPreviewBox').textContent = previewText;
}

function formatSmsMessage(template, student) {
    return template
        .replace(/\{StudentName\}/g, student.name)
        .replace(/\{ParentPhone\}/g, student.phone)
        .replace(/\{SubjectResults\}/g, student.subjectSummaryText)
        .replace(/\{Position\}/g, student.position)
        .replace(/\{TotalStudents\}/g, student.totalStudents);
}

// ============================================================
// Table Rendering & Filters
// ============================================================
function renderTable() {
    const tbody = document.getElementById('tableBody');
    const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();

    const filtered = studentsData.filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(searchTerm) || s.phone.includes(searchTerm);
        if (!matchesSearch) return false;

        if (currentFilter === 'DELIVERED') return s.smsStatus === 'DELIVERED';
        if (currentFilter === 'SENDING') return ['PENDING','SENDING','SENT'].includes(s.smsStatus);
        if (currentFilter === 'FAILED') return ['FAILED','EXPIRED'].includes(s.smsStatus);
        if (currentFilter === 'MISSING') return s.phone === 'No Phone' || s.smsStatus === 'MISSING';
        return true;
    });

    if (!filtered.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-cell">No matching student records found for filter.</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(s => {
        const gradePills = Object.entries(s.subjects).map(([subj, gr]) => `
            <span class="grade-pill">${subj}: <b>${gr}</b></span>
        `).join('');

        const statusBadge = getStatusBadgeHtml(s.smsStatus);
        const matchBadge = s.isMatched
            ? '<span class="badge-status badge-delivered">🟢 MATCHED</span>'
            : '<span class="badge-status badge-failed">⚠️ NO PHONE</span>';

        const avatarInitial = s.name ? s.name.charAt(0).toUpperCase() : 'S';

        return `
            <tr>
                <td style="font-family:var(--font-mono); font-size:11px">${s.id}</td>
                <td>
                    <div class="student-pill">
                        <div class="student-avatar">${avatarInitial}</div>
                        <span style="font-weight:600">${s.name}</span>
                    </div>
                </td>
                <td style="font-family:var(--font-mono); font-size:12px">${s.phone}</td>
                <td>${gradePills || s.subjectSummaryText}</td>
                <td>${matchBadge}</td>
                <td>${statusBadge}</td>
                <td>
                    <button class="btn btn-sm btn-outline" onclick="sendSingleStudentSms(${s.id - 1})" ${s.phone === 'No Phone' ? 'disabled' : ''}>
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

// ============================================================
// API Dispatching & Bulk SMS Execution
// ============================================================
async function sendSingleStudentSms(index) {
    if (!API_KEY) {
        openConfigModal();
        alert('Please enter your REST API Key to send SMS!');
        return;
    }

    const student = studentsData[index];
    if (student.phone === 'No Phone') {
        logTerminalEvent('SKIPPED', `Skipped SMS for ${student.name}: No parent phone matched.`);
        return;
    }

    const template = document.getElementById('smsTemplateInput').value;
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
        updateProgressStats();
        renderTable();
    } catch (e) {
        student.smsStatus = 'FAILED';
        logTerminalEvent('FAILED', `Error sending to ${student.name}: ${e.message}`);
        updateProgressStats();
        renderTable();
    }
}

async function triggerSendAllSms() {
    if (!API_KEY) {
        openConfigModal();
        alert('Please configure your REST API Key first!');
        return;
    }

    const validStudents = studentsData.filter(s => s.phone !== 'No Phone');
    if (!confirm(`Send exam results SMS to all ${validStudents.length} matched parents now?`)) return;

    const btn = document.getElementById('sendAllBtn');
    btn.disabled = true;
    btn.textContent = '⏳ Dispatching SMS Batch...';

    logTerminalEvent('BATCH', `Starting batch dispatch to ${validStudents.length} parents...`);

    for (let i = 0; i < studentsData.length; i++) {
        if (studentsData[i].phone === 'No Phone' || studentsData[i].smsStatus === 'DELIVERED') continue;
        await sendSingleStudentSms(i);
        await new Promise(r => setTimeout(r, 300));
    }

    btn.disabled = false;
    btn.textContent = '🚀 Send Results to All Parents';
    logTerminalEvent('BATCH', `All ${validStudents.length} student SMS dispatches submitted to gateway.`);
}

async function retryAllFailedSms() {
    const failedList = studentsData.filter(s => ['FAILED','EXPIRED'].includes(s.smsStatus));
    if (!failedList.length) {
        alert('No failed SMS messages to retry!');
        return;
    }

    logTerminalEvent('RETRY', `Retrying ${failedList.length} failed SMS dispatches...`);
    for (let s of failedList) {
        const idx = studentsData.findIndex(x => x.id === s.id);
        if (idx !== -1) await sendSingleStudentSms(idx);
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
            // Silent background catch
        }
    }, 3000);
}

// ============================================================
// Export Merged Master Excel File (.xlsx)
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
// Sample Excel Generator (.xlsx)
// ============================================================
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
