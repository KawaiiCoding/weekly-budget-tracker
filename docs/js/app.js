let state = {
    startDate: new Date().toISOString().split('T')[0],
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
    // Re-bind sync UI if a wallet code exists
    if(state.syncCode && window.setSyncCodeUI) {
        window.setSyncCodeUI(state.syncCode);
    }
    render();
}

function parsePrice(val) {
    if (typeof val !== 'string') val = String(val);
    const normalized = val.replace(',', '.');
    return parseFloat(normalized) || 0;
}

function loadLocal() {
    const saved = localStorage.getItem('budgetTrackerState');
    if (saved) state = { ...state, ...JSON.parse(saved) };
    document.getElementById('start-date').value = state.startDate;
    document.getElementById('total-budget').value = state.totalBudget;
}

function saveLocal() {
    localStorage.setItem('budgetTrackerState', JSON.stringify(state));
    // Trigger sync if online
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

    const totalSpent = weekSpends.reduce((a,b) => a+b, 0);
    document.getElementById('dash-total').innerText = `€${state.totalBudget.toFixed(2)}`;
    document.getElementById('dash-spent').innerText = `€${totalSpent.toFixed(2)}`;
    document.getElementById('dash-remaining').innerText = `€${(state.totalBudget - totalSpent).toFixed(2)}`;

    const container = document.getElementById('weeks-container');
    container.innerHTML = '';
    
    for (let i = 0; i < 4; i++) {
        const isCollapsed = state.collapsed[`week-${i}`] ? 'collapsed' : '';
        const wRem = weekBudgets[i] - weekSpends[i];
        
        container.innerHTML += `
            <div class="mantine-card ${isCollapsed}" id="week-${i}">
                <div class="card-header" onclick="toggleCollapse('week-${i}')">
                    <h3>Week ${i+1}</h3>
                    <div style="display:flex; align-items:center; gap:8px">
                        <span style="font-size:12px; font-weight:800; color:${wRem < 0 ? 'var(--warning)' : 'var(--success)'}">
                            €${wRem.toFixed(2)}
                        </span>
                        <i data-lucide="chevron-down" class="collapse-icon"></i>
                    </div>
                </div>
                <div class="collapsible-content">
                    <p style="font-size:10px; opacity:0.5; margin: 12px 0 6px 0; font-weight:800;">LIMIT: €${weekBudgets[i].toFixed(2)}</p>
                    <div class="config-grid">
                        <input type="text" id="amt-${i}" placeholder="€" placeholder="10.00" inputmode="decimal">
                        <input type="date" id="date-${i}" value="${new Date().toISOString().split('T')[0]}">
                    </div>
                    <button class="btn btn-primary" style="width:100%; margin-top:10px" onclick="addSpending(${i})">Add Spending</button>
                    <div class="spending-list">
                        ${state.spendings.filter(s => s.weekIndex === i).sort((a,b) => b.timestamp - a.timestamp).map(s => `
                            <div class="spending-item">
                                <span>€${s.amount.toFixed(2)} <small style="opacity:0.5; margin-left:4px">${s.date.split('-').reverse().join('.')}</small></span>
                                <button class="btn-danger btn icon-btn" onclick="promptDelete('${s.id}')">
                                    <i data-lucide="trash-2" class="lucide-sm"></i>
                                </button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }
    lucide.createIcons();
}

function addSpending(idx) {
    const amt = parsePrice(document.getElementById(`amt-${idx}`).value);
    const date = document.getElementById(`date-${idx}`).value;
    if(!amt) return;
    state.spendings.push({ id: crypto.randomUUID(), amount: amt, date, weekIndex: idx, timestamp: Date.now() });
    saveLocal(); render();
}

function promptDelete(id) { itemToDelete = id; document.getElementById('delete-modal').classList.remove('hidden'); }
function closeDeleteModal() { document.getElementById('delete-modal').classList.add('hidden'); }
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

init();
