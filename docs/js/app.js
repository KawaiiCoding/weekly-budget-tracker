// --- State Management ---
let state = {
    startDate: '2026-05-23',
    totalBudget: 1000,
    spendings: [], // {id, amount, date, weekIndex, timestamp}
    syncCode: null
};

// --- Initialization ---
function init() {
    loadLocal();
    render();
    
    // Set default add spending dates to today
    setInterval(() => {
        if(window.appSyncData) window.appSyncData(state);
    }, 10000); // 10s sync loop hook
}

function saveLocal() {
    localStorage.setItem('budgetTrackerState', JSON.stringify(state));
    if(window.appSyncData) window.appSyncData(state); // Trigger sync on change
}

function loadLocal() {
    const saved = localStorage.getItem('budgetTrackerState');
    if (saved) {
        state = JSON.parse(saved);
        document.getElementById('start-date').value = state.startDate;
        document.getElementById('total-budget').value = state.totalBudget;
        if(state.syncCode && window.setSyncCodeUI) window.setSyncCodeUI(state.syncCode);
    }
}

// --- Logic ---
function updateSettings() {
    state.startDate = document.getElementById('start-date').value;
    state.totalBudget = parseFloat(document.getElementById('total-budget').value);
    
    // Re-evaluate week indices for all spendings based on new start date
    state.spendings.forEach(s => {
        s.weekIndex = calculateWeekIndex(s.date, state.startDate);
    });
    
    saveLocal();
    render();
}

function calculateWeekIndex(spendStr, startStr) {
    const start = new Date(startStr);
    const spend = new Date(spendStr);
    const diffTime = spend - start;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    let week = Math.floor(diffDays / 7);
    if (week < 0) week = 0;
    if (week > 3) week = 3;
    return week;
}

function addSpending(weekIndex) {
    const amountInput = document.getElementById(`amount-w${weekIndex}`);
    const dateInput = document.getElementById(`date-w${weekIndex}`);
    
    const amount = parseFloat(amountInput.value);
    if (!amount || amount <= 0) return alert("Enter a valid amount");

    const entry = {
        id: crypto.randomUUID(),
        amount: amount,
        date: dateInput.value,
        weekIndex: weekIndex,
        timestamp: Date.now()
    };

    state.spendings.push(entry);
    saveLocal();
    render();
}

function deleteSpending(id) {
    state.spendings = state.spendings.filter(s => s.id !== id);
    saveLocal();
    render();
}

// --- Rebalancing & Rendering ---
function render() {
    let totalSpent = 0;
    let weekSpends = [0, 0, 0, 0];

    state.spendings.forEach(s => {
        totalSpent += s.amount;
        if(s.weekIndex >= 0 && s.weekIndex <= 3) {
            weekSpends[s.weekIndex] += s.amount;
        }
    });

    // Rebalancing Logic
    let remainingTotal = state.totalBudget;
    let weekBudgets = [0,0,0,0];
    
    for (let i = 0; i < 4; i++) {
        let weeksLeft = 4 - i;
        let baseForWeek = remainingTotal / weeksLeft;
        weekBudgets[i] = baseForWeek;
        
        // Deduct what was actually spent this week from the running total
        remainingTotal -= weekSpends[i]; 
    }

    // Dashboard
    document.getElementById('dash-total').innerText = `€${state.totalBudget.toFixed(2)}`;
    document.getElementById('dash-spent').innerText = `€${totalSpent.toFixed(2)}`;
    document.getElementById('dash-remaining').innerText = `€${(state.totalBudget - totalSpent).toFixed(2)}`;

    // Render Weeks
    const container = document.getElementById('weeks-container');
    container.innerHTML = '';
    
    const today = new Date().toISOString().split('T')[0];

    for (let i = 0; i < 4; i++) {
        const wSpent = weekSpends[i];
        const wBudget = weekBudgets[i];
        const wRemaining = wBudget - wSpent;
        const isOver = wRemaining < 0;

        const weekHTML = `
            <div class="mantine-card week-card ${isOver ? 'over-budget' : ''}">
                <h3>Week ${i + 1}</h3>
                <p style="color: ${isOver ? 'var(--warning)' : 'inherit'}">
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
                            <span>€${s.amount.toFixed(2)} <small style="color:#888">(${s.date})</small></span>
                            <button class="btn btn-danger" onclick="deleteSpending('${s.id}')">X</button>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        container.innerHTML += weekHTML;
    }
}

// --- Import / Export ---
function exportData() {
    navigator.clipboard.writeText(JSON.stringify(state, null, 2))
        .then(() => alert("Data copied to clipboard!"))
        .catch(() => alert("Failed to copy."));
}

function openImport() { document.getElementById('import-modal').classList.remove('hidden'); }
function closeImport() { document.getElementById('import-modal').classList.add('hidden'); }

function importData() {
    try {
        const data = JSON.parse(document.getElementById('import-json').value);
        if(data.startDate && data.spendings) {
            state = data;
            saveLocal();
            render();
            closeImport();
            alert("Data imported successfully");
        }
    } catch(e) {
        alert("Invalid JSON format.");
    }
}

// Start app
init();
