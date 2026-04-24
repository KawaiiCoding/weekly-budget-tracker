// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyDVc2cc-0Q2cnx_ev2jreni9rDZVF4IQgY",
  authDomain: "weekly-budget-planner-app.firebaseapp.com",
  databaseURL: "https://weekly-budget-planner-app-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "weekly-budget-planner-app",
  storageBucket: "weekly-budget-planner-app.firebasestorage.app",
  messagingSenderId: "563447884119",
  appId: "1:563447884119:web:bc3d5b57a90d098f9e3612"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();
let isSyncing = false;
let isOffline = !navigator.onLine;

// Detect Connection Changes
window.addEventListener('online', () => {
    isOffline = false;
    if (state.syncCode) {
        // When coming back online, pull first to merge, then push
        database.ref('sync/' + state.syncCode).once('value', snap => {
            if(snap.exists()) mergeData(snap.val());
            window.appSyncData(state); 
        });
    }
});

window.addEventListener('offline', () => {
    isOffline = true;
    updateSyncUI('disconnected', state.syncCode);
});

function updateSyncUI(status, code = null) {
    const dot = document.getElementById('sync-status-dot');
    const text = document.getElementById('sync-status-text');
    const disc = document.getElementById('sync-controls-disconnected');
    const conn = document.getElementById('sync-controls-connected');
    const hDisplay = document.getElementById('header-code-display');
    const hText = document.getElementById('header-code-text');

    if (isOffline) {
        dot.className = 'dot disconnected';
        text.innerText = 'OFFLINE';
    } else {
        dot.className = 'dot ' + status;
        text.innerText = status === 'syncing' ? 'SYNCING' : 'LIVE';
    }

    if(code) {
        state.syncCode = code;
        disc.classList.add('hidden');
        conn.classList.remove('hidden');
        hDisplay.classList.remove('hidden');
        hText.innerText = code;
    } else {
        disc.classList.remove('hidden');
        conn.classList.add('hidden');
        hDisplay.classList.add('hidden');
        text.innerText = 'LOCAL ONLY';
    }
    lucide.createIcons();
}

window.setSyncCodeUI = function(code) {
    updateSyncUI(isOffline ? 'disconnected' : 'connected', code);
    database.ref('sync/' + code).on('value', (snap) => {
        if(snap.exists() && !isSyncing && !isOffline) mergeData(snap.val());
    });
};

function generateSyncCode() {
    if (isOffline) return alert("Internet required to create wallet");
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    window.setSyncCodeUI(code);
    saveLocal(); 
    database.ref('sync/' + code).set(state);
}

function joinSync() {
    if (isOffline) return alert("Internet required to join wallet");
    const code = document.getElementById('sync-code-input').value.toUpperCase();
    if(code.length !== 6) return;
    database.ref('sync/' + code).once('value', snap => {
        if(snap.exists()) {
            mergeData(snap.val());
            window.setSyncCodeUI(code);
            saveLocal();
        } else alert("Wallet not found");
    });
}

function disconnectSync() {
    if(state.syncCode) database.ref('sync/' + state.syncCode).off();
    state.syncCode = null;
    saveLocal();
    updateSyncUI('disconnected');
}

window.copySyncCode = function(e) {
    e.stopPropagation();
    navigator.clipboard.writeText(state.syncCode).then(() => alert("Code Copied!"));
};

window.appSyncData = function(data) {
    if(!state.syncCode || isSyncing || isOffline) return;
    isSyncing = true;
    updateSyncUI('syncing', state.syncCode);
    database.ref('sync/' + state.syncCode).set(data).then(() => {
        setTimeout(() => { isSyncing = false; updateSyncUI('connected', state.syncCode); }, 500);
    });
};

// SMART MERGE: Combines local and cloud data without losing offline additions
function mergeData(cloud) {
    if(!cloud) return;
    isSyncing = true;
    
    // Update basic settings
    state.startDate = cloud.startDate || state.startDate;
    state.totalBudget = cloud.totalBudget || state.totalBudget;
    
    // Merge spendings by unique ID
    const localIds = new Set(state.spendings.map(s => s.id));
    const cloudSpendings = cloud.spendings || [];
    
    cloudSpendings.forEach(cs => {
        if (!localIds.has(cs.id)) {
            state.spendings.push(cs);
        }
    });

    render();
    localStorage.setItem('budgetTrackerState', JSON.stringify(state));
    isSyncing = false;
}
