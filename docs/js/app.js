let state = {
    startDate: new Date().toISOString().split('T')[0],
    totalBudget: 1000,
    spendings: [],
    history: [],
    syncCode: null,
    theme: 'auto',
    persona: 'dude',
    collapsed: {}
};

let itemToDelete = null;

function init() {
    loadLocal();
    applyTheme();
    applyPersona(); 
    if(state.syncCode && window.setSyncCodeUI) {
        window.setSyncCodeUI(state.syncCode);
    }
    render();
}

// --- PERSONA LOGIC ---
function togglePersona() {
    state.persona = state.persona === 'dude' ? 'girl' : 'dude';
    applyPersona();
    saveLocal(); 
}

function applyPersona() {
    const htmlEl = document.documentElement;
    htmlEl.setAttribute('data-style', state.persona);
    const themeColor = state.persona === 'girl' ? '#ff85a2' : '#228be6';
    let metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute('content', themeColor);

    const icon = document.getElementById('persona-icon');
    if (icon) {
        const iconName = state.persona === 'girl' ? 'sparkles' : 'user-round';
        icon.setAttribute('data-lucide', iconName);
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

function showError(msg) {
    document.getElementById('error-message').innerText = msg;
    openModal('error-modal');
    lucide.createIcons();
}

// --- LOGIC ---
function addSpending(idx) {
    const amtInput = document.getElementById(`amt-${idx}`);
    const dateInput = document.getElementById(`date-${idx}`);
    const amt = parsePrice(amtInput.value);
    const date = dateInput.value;

    if(!amt) return;

    const min = dateInput.getAttribute('min');
    const max = dateInput.getAttribute('max');
    
    if (date < min || date > max) {
        const dMin = min.split('-').reverse().join('.');
        const dMax = max.split('-').reverse().join('.');
        showError(`For Week ${idx + 1}, please pick a date between ${dMin} and ${dMax}.`);
        return;
    }

    state.spendings.push({ 
        id: crypto.randomUUID(), 
        amount: amt, 
        date, 
        weekIndex: idx, 
        timestamp: Date.now() 
    });

    amtInput.value = '';
    saveLocal(); 
    render();
}

function promptDelete(id) { 
    itemToDelete = id; 
    const s = state.spendings.find(x => x.id === id);
    const msg = document.querySelector('#delete-modal p');
    if (msg && s) {
        msg.innerHTML = `Delete entry for <strong>€${s.amount.toFixed(2)}</strong>?<br><small style="opacity:0.6">This cannot be undone.</small>`;
    }
    openModal('delete-modal'); 
}

function confirmNewMonth() {
    const totalSpent = state.spendings.reduce((a, b) => a + b.amount, 0);
    state.history.unshift({
        id: crypto.randomUUID(),
        startDate: state.startDate,
        totalBudget: state.totalBudget,
        totalSpent: totalSpent,
        saved: state.totalBudget - totalSpent,
        spendings: [...state.spendings]
    });
    state.spendings = [];
    let d = new Date(state.startDate);
    d.setDate(d.getDate() + 28);
    state.startDate = d.toISOString().split('T')[0];
    document.getElementById('start-date').value = state.startDate;
    closeModal('new-month-modal');
    saveLocal();
    render();
}

// --- HELPERS ---
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

function parsePrice(v) {
    return parseFloat(String(v).replace(',', '.')) || 0;
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
    saveLocal();
    render();
}

function toggleCollapse(id) {
    document.getElementById(id).classList.toggle('collapsed');
    state.collapsed[id] = document.getElementById(id).classList.contains('collapsed');
    saveLocal();
}

function render() {
    let weekSpends = [0, 0, 0, 0];
    state.spendings.forEach(s => {
        if(s.weekIndex >= 0 && s.weekIndex <= 3) weekSpends[s.weekIndex] += s.amount;
    });

    let pool = state.totalBudget;
    let weekBudgets = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) {
        weekBudgets[i] = pool / (4 - i);
        pool -= (weekSpends[i] > weekBudgets[i]) ? weekSpends[i] : weekBudgets[i];
    }

    const today = new Date().toISOString().split('T')[0];
    const container = document.getElementById('weeks-container');
    container.innerHTML = '';
    
    for (let i = 0; i < 4; i++) {
        const range = getWeekRange(state.startDate, i);
        const isCurrent = (today >= range.min && today <= range.max);
        const isCollapsed = isCurrent ? '' : (state.collapsed[`week-${i}`] ? 'collapsed' : '');
        const wRem = weekBudgets[i] - weekSpends[i];
        
        container.innerHTML += `
            <div class="mantine-card ${isCollapsed}" id="week-${i}">
                <div class="card-header" onclick="toggleCollapse('week-${i}')">
                    <div style="display:flex; flex-direction:column">
                        <h3 style="font-size: 14px; margin:0">Week ${i+1}</h3>
                        <small style="font-size: 10px; opacity: 0.5; font-weight: 700;">(${range.text})</small>
                    </div>
                    <div style="display:flex; align-items:center; gap:10px">
                        <span style="font-size:18px; font-weight:700; color:${wRem < 0 ? 'var(--warning)' : 'var(--success)'}">
                            €${wRem.toFixed(2)}
                        </span>
                        <i data-lucide="chevron-down" class="collapse-icon"></i>
                    </div>
                </div>
                <div class="collapsible-content">
                    <p style="font-size:10px; opacity:0.5; margin: 12px 0 6px 0; font-weight:800;">LIMIT: €${weekBudgets[i].toFixed(2)}</p>
                    <div class="config-grid">
                        <div class="input-group">
                            <label>Amount</label>
                            <input type="text" id="amt-${i}" placeholder="0,00" inputmode="decimal">
                        </div>
                        <div class="input-group">
                            <label>Date</label>
                            <input type="date" id="date-${i}" 
                                value="${isCurrent ? today : range.min}" 
                                min="${range.min}" 
                                max="${range.max}">
                        </div>
                    </div>
                    <button class="btn btn-primary" style="width:100%; margin-top:12px" onclick="addSpending(${i})">Add Spending</button>
                    <div class="spending-list">
                        ${state.spendings.filter(s => s.weekIndex === i).sort((a,b) => b.timestamp - a.timestamp).map(s => `
                            <div class="spending-item">
                                <span>
                                    <strong>€${s.amount.toFixed(2)}</strong> 
                                    <small style="opacity:0.4; margin-left:6px">${s.date.split('-').reverse().join('.')}</small>
                                </span>
                                <button class="btn-danger btn icon-btn" onclick="promptDelete('${s.id}')">
                                    <i data-lucide="trash-2"></i>
                                </button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

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

    document.getElementById('dash-total').innerText = `€${state.totalBudget.toFixed(2)}`;
    document.getElementById('dash-spent').innerText = `€${(weekSpends.reduce((a,b)=>a+b,0)).toFixed(2)}`;
    document.getElementById('dash-remaining').innerText = `€${(state.totalBudget - weekSpends.reduce((a,b)=>a+b,0)).toFixed(2)}`;
    lucide.createIcons();
}

document.getElementById('confirm-delete-btn').onclick = () => {
    if (itemToDelete) {
        state.spendings = state.spendings.filter(s => s.id !== itemToDelete);
        saveLocal(); 
        render(); 
        closeModal('delete-modal');
        itemToDelete = null; // Reset it
    }
};

function toggleTheme() {
    // Cycles: light -> dark -> light
    state.theme = state.theme === 'light' ? 'dark' : 'light';
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
