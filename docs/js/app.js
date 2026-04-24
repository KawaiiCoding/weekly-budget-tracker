let state = {
    startDate: '2026-05-23',
    totalBudget: 1000,
    spendings: [],
    syncCode: null,
    theme: 'auto',
    collapsed: {}
};

let itemToDelete = null;

function init() {
    loadLocal();
    applyTheme();
    applyCollapsedStates();
    render();
    
    // Auto-sync heartbeat
    setInterval(() => {
        if(window.appSyncData) window.appSyncData(state);
    }, 10000);
}

// --- Theme & UI ---
function applyTheme() {
    if (state.theme === 'auto') {
        const darkPref = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.setAttribute('data-theme', darkPref ? 'dark' : 'light');
        document.getElementById('theme-toggle').innerText = darkPref ? '☀️' : '🌙';
    } else {
        document.documentElement.setAttribute('data-theme', state.theme);
        document.getElementById('theme-toggle').innerText = state.theme === 'dark' ? '☀️' : '🌙';
    }
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    state.theme = current === 'dark' ? 'light' : 'dark';
    saveLocal();
    applyTheme();
}

function toggleCollapse(id) {
    const el = document.getElementById(id);
    el.classList.toggle('collapsed');
    state.collapsed[id] = el.classList.contains('collapsed');
    saveLocal();
}

function applyCollapsedStates() {
    for (const [id, isCollapsed] of Object.entries(state.collapsed)) {
        const el = document.getElementById(id);
        if (el && isCollapsed) el.classList.add('collapsed');
    }
}

// --- Date Formatting ---
function formatDateDisplay(dateStr) {
    const [y, m, d] = dateStr.split('-');
    return `${d}.${m}.${y}`;
}

// --- Storage & Data ---
function saveLocal() {
    localStorage.setItem('budgetTrackerState', JSON.stringify(state));
    if(window.appSyncData) window.appSyncData(state); 
}

function loadLocal() {
    const saved = localStorage.getItem('budgetTrackerState');
    if (saved) {
        state = { ...state, ...JSON.parse(saved) };
        document.getElementById('start-date').value = state.startDate;
        document.getElementById('total-budget').value = state.totalBudget;
        if(state.syncCode && window.setSyncCodeUI) window.setSyncCodeUI(state.syncCode);
    }
}

function updateSettings() {
    state.startDate = document.getElementById('start-date').value;
    state.totalBudget = parseFloat(document.getElementById('total-budget').value);
    state.spendings.forEach(s => s.weekIndex = calculateWeekIndex(s.date, state.startDate));
    saveLocal();
    render();
}

function calculateWeekIndex(spendStr, startStr) {
    const start = new Date(startStr);
    const spend = new Date(spendStr);
    const diffDays = Math.floor((spend - start) / (1000 * 60 * 60 * 24));
    let week = Math.floor(diffDays / 7);
    return Math.max(0, Math.min(week, 3));
}

// --- Spending & Modals ---
function addSpending(weekIndex) {
    const amount = parseFloat(document.getElementById(`amount-w${weekIndex}`).value);
    const date = document.getElementById(`date-w${weekIndex}`).value;
    if (!amount || amount <= 0) return alert("Enter a valid amount");

    state.spendings.push({
        id: crypto.randomUUID(),
        amount: amount,
        date: date,
        weekIndex: weekIndex,
        timestamp: Date.now()
    });
    saveLocal();
    render();
}

function promptDelete(id) {
    itemToDelete = id;
    document.getElementById('delete-modal').classList.remove('hidden');
}

function closeDeleteModal() {
    itemToDelete = null;
    document.getElementById('delete-modal').classList.add('hidden');
}

document.getElementById('confirm-delete-btn').addEventListener('click', () => {
    if (itemToDelete) {
        state.spendings = state.spendings.filter(s => s.id !== itemToDelete);
        saveLocal(); // Triggers sync automatically
        render();
        closeDeleteModal();
    }
});

// --- Logic & Render ---
function render() {
    let totalSpent = 0;
    let weekSpends = [0, 0, 0, 0];

    state.spendings.forEach(s => {
        totalSpent += s.amount;
        if(s.weekIndex >= 0 && s.weekIndex <= 3) weekSpends[s.weekIndex] += s.amount;
    });

    let remainingTotal = state.totalBudget;
    let weekBudgets = [0, 0, 0, 0];
    let weeksLeft = 4;
    
    // CORRECTED MATH: Only reduce future weeks if a week overspends.
    for (let i = 0; i < 4; i++) {
        let baseForWeek = remainingTotal / weeksLeft;
        weekBudgets[i] = baseForWeek;
        
        let wSpent = weekSpends[i];
        
        if (wSpent > baseForWeek) {
            // Overspent: Deduct exactly what was spent to reduce future pools
            remainingTotal -= wSpent; 
        } else {
            // Under/On budget: Deduct the standard base so future weeks stay at €250
            remainingTotal -= baseForWeek; 
        }
        weeksLeft--;
    }

    document.getElementById('dash-total').innerText = `€${state.totalBudget.toFixed(2)}`;
    document.getElementById('dash-spent').innerText = `€${totalSpent.toFixed(2)}`;
    document.getElementById('dash-remaining').innerText = `€${(state.totalBudget - totalSpent).toFixed(2)}`;

    const container = document.getElementById('weeks-container');
    container.innerHTML = '';
    const today = new Date().toISOString().split('T')[0];

    for (let i = 0; i < 4; i++) {
        const wSpent = weekSpends[i];
        const wBudget = weekBudgets[i];
        const wRemaining = wBudget - wSpent;
        const isOver = wRemaining < 0;
        
        const weekId = `card-week-${i}`;
        const isCollapsed = state.collapsed[weekId] ? 'collapsed' : '';

        const weekHTML = `
            <div class="mantine-card week-card ${isOver ? 'over-budget' : ''} ${isCollapsed}" id="${weekId}">
                <div class="card-header" onclick="toggleCollapse('${weekId}')">
                    <h3>Week ${i + 1}</h3>
                    <span class="collapse-icon">▼</span>
                </div>
                
                <div class="collapsible-content">
                    <p style="color: ${isOver ? 'var(--warning)' : 'inherit'}; margin-top: 10px;">
                        <strong>Budget:</strong> €${wBudget.toFixed(2)}<br>
                        <strong>Remaining:</strong> €${wRemaining.toFixed(2)}
                    </p>
                    
                    <div class="input-group mt-1">
                        <input type="number" id="amount-w${i}" placeholder="Amount (€)" step="0.01">
                    </div>
                    <div class="input-group">
                        <input type="date" id="date-w${i}" value="${today}">
                    </div>
                    <button class="btn btn-outline" style="width:100%" onclick="addSpending(${i})">Add</button>

                    <div class="spending-list">
                        ${state.spendings.filter(s => s.weekIndex === i).sort((a,b) => new Date(b.date) - new Date(a.date)).map(s => `
                            <div class="spending-item">
                                <span>€${s.amount.toFixed(2)} <small style="opacity:0.7">(${formatDateDisplay(s.date)})</small></span>
                                <button class="btn btn-danger" style="padding:4px 8px; font-size:12px;" onclick="promptDelete('${s.id}')">X</button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
        container.innerHTML += weekHTML;
    }
}

// --- Import / Export ---
function exportData() { navigator.clipboard.writeText(JSON.stringify(state, null, 2)).then(() => alert("Copied!")); }
function openImport() { document.getElementById('import-modal').classList.remove('hidden'); }
function closeImport() { document.getElementById('import-modal').classList.add('hidden'); }
function importData() {
    try {
        const data = JSON.parse(document.getElementById('import-json').value);
        if(data.spendings) {
            state = { ...state, ...data };
            saveLocal(); render(); closeImport(); alert("Imported!");
        }
    } catch(e) { alert("Invalid JSON format."); }
}

init();
