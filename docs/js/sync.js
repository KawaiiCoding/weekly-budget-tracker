// --- Firebase Configuration ---
// REPLACE THIS WITH YOUR FIREBASE CONFIG
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

let currentSyncCode = null;
let isSyncing = false;

// ... (Your Firebase Config at the top)

function updateSyncUI(status, code = null) {
    const dot = document.getElementById('sync-status-dot');
    const text = document.getElementById('sync-status-text');
    const disc = document.getElementById('sync-controls-disconnected');
    const conn = document.getElementById('sync-controls-connected');
    const hDisplay = document.getElementById('header-code-display');
    const hText = document.getElementById('header-code-text');

    dot.className = 'dot ' + status;
    if(code) {
        state.syncCode = code;
        disc.classList.add('hidden');
        conn.classList.remove('hidden');
        hDisplay.classList.remove('hidden');
        hText.innerText = code;
        text.innerText = status === 'syncing' ? 'SYNCING' : 'LIVE';
    } else {
        disc.classList.remove('hidden');
        conn.classList.add('hidden');
        hDisplay.classList.add('hidden');
        text.innerText = 'OFFLINE';
    }
    lucide.createIcons();
}

window.setSyncCodeUI = function(code) {
    updateSyncUI('connected', code);
    database.ref('sync/' + code).on('value', (snap) => {
        if(snap.exists() && !isSyncing) mergeData(snap.val());
    });
};

function generateSyncCode() {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    window.setSyncCodeUI(code);
    saveLocal(); 
    database.ref('sync/' + code).set(state);
}

function joinSync() {
    const code = document.getElementById('sync-code-input').value.toUpperCase();
    if(code.length !== 6) return;
    database.ref('sync/' + code).once('value', snap => {
        if(snap.exists()) {
            mergeData(snap.val());
            window.setSyncCodeUI(code);
            saveLocal();
        } else alert("Room not found");
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
    if(!state.syncCode || isSyncing) return;
    isSyncing = true;
    updateSyncUI('syncing', state.syncCode);
    database.ref('sync/' + state.syncCode).set(data).then(() => {
        setTimeout(() => { isSyncing = false; updateSyncUI('connected', state.syncCode); }, 500);
    });
};

function mergeData(cloud) {
    if(!cloud) return;
    isSyncing = true;
    state.startDate = cloud.startDate || state.startDate;
    state.totalBudget = cloud.totalBudget || state.totalBudget;
    state.spendings = cloud.spendings || [];
    render();
    localStorage.setItem('budgetTrackerState', JSON.stringify(state));
    isSyncing = false;
}
