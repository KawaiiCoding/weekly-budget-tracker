let state = {
    startDate: new Date().toISOString().split('T')[0],
    totalBudget: 1000,
    spendings: [],
    history: [], // Stores archived months
    syncCode: null,
    theme: 'auto',
    persona: 'dude', // NEW: 'dude' or 'girl'
    collapsed: {}
};

let itemToDelete = null;

function init() {
    loadLocal();
    applyTheme();
    applyPersona(); // Apply Dude/Girl style on startup
    if(state.syncCode && window.setSyncCodeUI) {
        window.setSyncCodeUI(state.syncCode);
    }
    render();
}

// --- PERSONA LOGIC (DUDE/GIRL) ---
function togglePersona() {
    state.persona = state.persona === 'dude' ? 'girl' : 'dude';
    applyPersona();
    saveLocal(); // Saves to LocalStorage and Syncs
}

function applyPersona() {
    const htmlEl = document.documentElement;
    // This triggers the CSS variables in your style.css
    htmlEl.setAttribute('data-style', state.persona);
    
    const icon = document.getElementById('persona-icon');
    if (icon) {
        // Change icon to heart for girl mode, user for dude mode
        icon.setAttribute('data-lucide', state.persona === 'girl' ? 'heart' : 'user');
    }
    lucide.createIcons();
}

// --- MODAL HELPERS ---
function openModal(id) { 
    document.getElementById(id).classList.remove('hidden'); 
    if(id === 'history-modal') renderHistory(); 
}

function closeModal(id) { 
    document.getElementById(id).classList.add('hidden'); 
}

// --- ARCHIVE LOGIC ---
function confirmNewMonth() {
    const totalSpent = state.spendings.reduce((a, b) => a + b.amount, 0);
    const saved = state.totalBudget - totalSpent;

    const archiveEntry = {
        id: crypto.randomUUID(),
        startDate: state.startDate,
        totalBudget: state.totalBudget,
        totalSpent: totalSpent,
        saved: saved,
        spendings: [...state.spendings]
    };

    state.history.unshift(archiveEntry);
    state.spendings = [];
    
    let d = new Date(state.startDate);
    d.setDate(d.getDate() + 28);
    state.startDate = d.toISOString().split('T')[0];
    
    const dateInput = document.getElementById('start-date');
    if(dateInput) dateInput.value = state.startDate;

    closeModal('new-month-modal');
    saveLocal();
    render();
}

// HELPER: Week Ranges
function getWeekRange(startStr, weekIdx) {
    let start = new Date(startStr);
    let firstDay = new Date(start);
    firstDay.setDate(start.getDate() + (weekIdx * 7));
    
    let lastDay = new Date(firstDay);
    lastDay.setDate(firstDay.getDate() + 6);

    const format = (d) => d.getDate() + "/" + (d.getMonth() + 1);
    return {
        text: `${format(firstDay)} - ${format(lastDay)}`,
        min: firstDay.toISOString().split('T')[0],
        max: lastDay.toISOString().split('T')[0]
    };
}

function parsePrice(val) {
    if (typeof val !== 'string') val = String(val);
    const normalized = val.replace(',', '.');
    return parseFloat(normalized) || 0;
}

// --- STORAGE & SYNC ---
function loadLocal() {
    const saved = localStorage.getItem('budgetTrackerState');
    if (saved) {
        const parsed = JSON.parse(saved);
        state = { ...state, ...parsed };
    }
    // Update UI elements to match loaded state
    document.getElementById('start-date').value = state.startDate;
    document.getElementById('total-budget').value = state.totalBudget;
}

function saveLocal() {
    localStorage.setItem('budgetTrackerState', JSON.stringify(state));
    // If sync.js is loaded, push to Firebase
    if(window.appSyncData) window.appSyncData(state);
}

function updateSettings() {
    state.startDate = document.getElementById('start-date').value;
    state.totalBudget = parsePrice(document.getElementById('total-budget').value);
    state.spendings.forEach(s => s.weekIndex = calculateWeekIndex(s.date, state.startDate));
    saveLocal();
    render();
}

function calculateWeekIndex(spendStr, startStr) {
    const start = new Date(startStr);
    const spend = new Date(spendStr);
    const diff = Math.floor((spend - start) / 86400000);
    return Math.max(0, Math.min(Math.floor(diff / 7), 3));
}

// --- RENDER LOGIC ---
function render() {
    let weekSpends = [0, 0, 0, 0];
    state.spendings.forEach(s => {
        if(s.weekIndex >= 0 && s.weekIndex <= 3) weekSpends[s.weekIndex] += s.amount;
    });

    let remainingPool = state.totalBudget;
    let weekBudgets = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) {
        let weeksLeft = 4 - i;
        let budgetThisWeek = remainingPool / weeksLeft;
        weekBudgets[i] = budgetThisWeek;
        if (weekSpends[i] > budgetThisWeek) remainingPool -= weekSpends[i];
        else remainingPool -= budgetThisWeek;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const container = document.getElementById('weeks-container');
    container.innerHTML = '';
    
    for (let i = 0; i < 4; i++) {
        const range = getWeekRange(state.startDate, i);
        const isCurrentWeek = (todayStr >= range.min && todayStr <= range.max);
        const isCollapsed = isCurrentWeek ? '' : (state.collapsed[`week-${i}`] ? 'collapsed' : '');
        const wRem = weekBudgets[i] - weekSpends[i];
        
        container.innerHTML += `
            <div class="mantine-card ${isCollapsed}" id="week-${i}">
                <div class="card-header" onclick="toggleCollapse('week-${i}')">
                    <div style="display:flex; flex-direction:column">
                        <h3 style="font-size: 14px; margin:0">Week ${i+1}</h3>
                        <small style="font-size: 10px; opacity: 0.5; font-weight: 700;">(${range.text})</small>
                    </div>
                    <div style="display:flex; align-items:center; gap:10px">
                        <span style="font-size:18px; font-weight:700; letter-spacing:-0.8px; color:${wRem < 0 ? 'var(--warning)' : 'var(--success)'}">
                            €${wRem.toFixed(2)}
                        </span>
                        <i data-lucide="chevron-down" class="collapse-icon"></i>
                    </div>
                </div>
                <div class="collapsible-content">
                    <p style="font-size:10px; opacity:0.5; margin: 12px 0 6px 0; font-weight:800;">WEEKLY LIMIT: €${weekBudgets[i].toFixed(2)}</p>
                    <div class="config-grid">
                        <div class="input-group">
                            <label>Amount</label>
                            <input type="text" id="amt-${i}" placeholder="10,00" inputmode="decimal">
                        </div>
                        <div class="input-group">
                            <label>Date</label>
                            <input type="date" id="date-${i}" 
                                value="${isCurrentWeek ? todayStr : range.min}" 
                                min="${range.min}" 
                                max="${range.max}">
                        </div>
                    </div>
                    <button class="btn btn-primary" style="width:100%; margin-top:12px" onclick="addSpending(${i})">Add Spending</button>
                    <div class="spending-list">
                        ${state.spendings.filter(s => s.weekIndex === i).sort((a,b) => b.timestamp - a.timestamp).map(s => `
                            <div class="spending-item">
                                <span style="font-weight: 600;">€${s.amount.toFixed(2)} <small style="opacity:0.4; font-weight: 400; margin-left:6px">${s.date.split('-').reverse().join('.')}</small></span>
                                <button class="btn-danger btn icon-btn" style="width:32px; height:32px;" onclick="promptDelete('${s.id}')">
                                    <i data-lucide="trash-2" style="width:12px; height:12px;"></i>
                                </button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    // History & New Month Buttons
    container.innerHTML += `
        <div style="display: flex; gap: 10px; margin-top: 20px; margin-bottom: 40px;">
            <button class="btn btn-outline" style="flex: 1;" onclick="openModal('history-modal')">
                <i data-lucide="history" style="width: 14px; margin-right: 6px;"></i> History
            </button>
            <button class="btn btn-primary" style="flex: 1;" onclick="openModal('new-month-modal')">
                <i data-lucide="calendar-plus" style="width: 14px; margin-right: 6px;"></i> Next Month
            </button>
        </div>
    `;

    const totalSpent = weekSpends.reduce((a,b) => a+b, 0);
    document.getElementById('dash-total').innerText = `€${state.totalBudget.toFixed(2)}`;
    document.getElementById('dash-spent').innerText = `€${totalSpent.toFixed(2)}`;
    document.getElementById('dash-remaining').innerText = `€${(state.totalBudget - totalSpent).toFixed(2)}`;
    lucide.createIcons();
}

function renderHistory() {
    const list = document.getElementById('history-list');
    const currentSpent = state.spendings.reduce((a, b) => a + b.amount, 0);
    const currentSaved = state.totalBudget - currentSpent;

    let html = `
        <div class="mantine-card" style="border: 2px solid var(--primary); background: rgba(34, 139, 230, 0.05); margin-bottom: 20px;">
            <small style="font-weight: 800; color: var(--primary)">CURRENT ACTIVE CYCLE</small>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
                <div>
                    <h3 style="margin:0">${new Date(state.startDate).toLocaleDateString('default', {month:'long', year:'numeric'})}</h3>
                    <p style="font-size: 12px; opacity: 0.6; margin:0">Spent: €${currentSpent.toFixed(2)}</p>
                </div>
                <div style="text-align: right">
                    <span style="font-size: 18px; font-weight: 900; color: var(--success)">€${currentSaved.toFixed(2)}</span>
                </div>
            </div>
        </div>
    `;

    state.history.forEach(item => {
        const dateObj = new Date(item.startDate);
        const monthName = dateObj.toLocaleDateString('default', { month: 'long', year: 'numeric' });
        html += `
            <div class="spending-item" style="padding: 15px 0; border-bottom: 1px solid var(--border);">
                <div>
                    <strong style="font-size: 15px;">${monthName}</strong>
                    <div style="font-size: 12px; opacity: 0.6;">Spent: €${item.totalSpent.toFixed(2)}</div>
                </div>
                <div style="text-align: right">
                    <div style="font-weight: 800; color: ${item.saved >= 0 ? 'var(--success)' : 'var(--warning)'}">
                        ${item.saved >= 0 ? '+' : ''}€${item.saved.toFixed(2)}
                    </div>
                </div>
            </div>
        `;
    });

    list.innerHTML = html || '<p style="text-align:center; opacity:0.5;">No history yet.</p>';
    lucide.createIcons();
}

function addSpending(idx) {
    const amt = parsePrice(document.getElementById(`amt-${idx}`).value);
    const date = document.getElementById(`date-${idx}`).value;
    if(!amt) return;
    state.spendings.push({ id: crypto.randomUUID(), amount: amt, date, weekIndex: idx, timestamp: Date.now() });
    saveLocal(); render();
}

function promptDelete(id) { 
    itemToDelete = id; 
    document.getElementById('delete-modal').classList.remove('hidden'); 
}
function closeDeleteModal() { 
    document.getElementById('delete-modal').classList.add('hidden'); 
}
document.getElementById('confirm-delete-btn').onclick = () => {
    state.spendings = state.spendings.filter(s => s.id !== itemToDelete);
    saveLocal(); render(); closeDeleteModal();
};

function toggleCollapse(id) {
    const el = document.getElementById(id);
    el.classList.toggle('collapsed');
    state.collapsed[id] = el.classList.contains('collapsed');
    saveLocal();
}

function toggleTheme() {
    state.theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(); saveLocal();
}

function applyTheme() {
    const t = state.theme === 'auto' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : state.theme;
    document.documentElement.setAttribute('data-theme', t);
    const icon = document.getElementById('theme-icon');
    if(icon) icon.setAttribute('data-lucide', t === 'dark' ? 'sun' : 'moon');
    lucide.createIcons();
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(err => console.log("SW failed", err));
    });
}

init();
