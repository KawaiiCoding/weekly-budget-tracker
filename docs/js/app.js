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

/** * HELPER: Calculates the date range for a specific week 
 * based on the global Start Date.
 */
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

function loadLocal() {
    const saved = localStorage.getItem('budgetTrackerState');
    if (saved) state = { ...state, ...JSON.parse(saved) };
    document.getElementById('start-date').value = state.startDate;
    document.getElementById('total-budget').value = state.totalBudget;
}

function saveLocal() {
    localStorage.setItem('budgetTrackerState', JSON.stringify(state));
    if(window.appSyncData) window.appSyncData(state);
}

function updateSettings() {
    state.startDate = document.getElementById('start-date').value;
    state.totalBudget = parsePrice(document.getElementById('total-budget').value);
    // Re-calculate which week each spending belongs to based on new start date
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

    const todayStr = new Date().toISOString().split('T')[0];
    const container = document.getElementById('weeks-container');
    container.innerHTML = '';
    
    for (let i = 0; i < 4; i++) {
        const range = getWeekRange(state.startDate, i);
        const isCurrentWeek = (todayStr >= range.min && todayStr <= range.max);
        
        // Auto-expand current week, otherwise use user's saved preference
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

    // Update Main Dashboard
    const totalSpent = weekSpends.reduce((a,b) => a+b, 0);
    document.getElementById('dash-total').innerText = `€${state.totalBudget.toFixed(2)}`;
    document.getElementById('dash-spent').innerText = `€${totalSpent.toFixed(2)}`;
    document.getElementById('dash-remaining').innerText = `€${(state.totalBudget - totalSpent).toFixed(2)}`;
    
    lucide.createIcons();
}

function addSpending(idx) {
    const amt = parsePrice(document.getElementById(`amt-${idx}`).value);
    const date = document.getElementById(`date-${idx}`).value;
    if(!amt) return;
    state.spendings.push({ id: crypto.randomUUID(), amount: amt, date, weekIndex: idx, timestamp: Date.now() });
    saveLocal(); 
    render();
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
    applyTheme(); 
    saveLocal();
}

function applyTheme() {
    const t = state.theme === 'auto' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : state.theme;
    document.documentElement.setAttribute('data-theme', t);
    const icon = document.getElementById('theme-icon');
    if(icon) icon.setAttribute('data-lucide', t === 'dark' ? 'sun' : 'moon');
    lucide.createIcons();
}

init();
