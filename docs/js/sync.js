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

function updateSyncUI(status, code = null) {
    const dot = document.getElementById('sync-status-dot');
    const text = document.getElementById('sync-status-text');
    const controlsDisconnected = document.getElementById('sync-controls-disconnected');
    const controlsConnected = document.getElementById('sync-controls-connected');

    dot.className = 'dot'; 
    
    if (code) {
        // Connected mode
        controlsDisconnected.classList.add('hidden');
        controlsConnected.classList.remove('hidden');
        document.getElementById('active-code-display').innerHTML = `<strong>Code:</strong> ${code}`;
        
        if (status === 'syncing') {
            dot.classList.add('syncing');
            text.innerText = 'Syncing...';
        } else {
            dot.classList.add('connected');
            text.innerText = 'Connected';
        }
    } else {
        // Disconnected mode
        controlsDisconnected.classList.remove('hidden');
        controlsConnected.classList.add('hidden');
        dot.classList.add('disconnected');
        text.innerText = 'Disconnected';
    }
}

window.setSyncCodeUI = function(code) {
    currentSyncCode = code;
    updateSyncUI('connected', code);
    listenToCloud(code);
};

function generateSyncCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    
    state.syncCode = code;
    saveLocal(); // in app.js
    window.setSyncCodeUI(code);
    
    database.ref('sync/' + code).set(state).then(() => updateSyncUI('connected', code));
}

function joinSync() {
    const code = document.getElementById('sync-code-input').value.toUpperCase();
    if(code.length !== 6) return alert("Code must be 6 characters.");
    
    database.ref('sync/' + code).once('value').then((snapshot) => {
        if(snapshot.exists()) {
            state.syncCode = code;
            mergeData(snapshot.val());
            window.setSyncCodeUI(code);
        } else {
            alert("Code not found or expired.");
        }
    });
}

function disconnectSync() {
    if (currentSyncCode) {
        database.ref('sync/' + currentSyncCode).off(); // Stop listening
    }
    currentSyncCode = null;
    state.syncCode = null;
    saveLocal(); // Save cleared state to local storage
    updateSyncUI('disconnected', null);
}

function listenToCloud(code) {
    updateSyncUI('connected', code);
    database.ref('sync/' + code).on('value', (snapshot) => {
        if(snapshot.exists() && !isSyncing) {
            mergeData(snapshot.val());
        }
    });
}

window.appSyncData = function(localState) {
    if(!currentSyncCode) return;
    isSyncing = true;
    updateSyncUI('syncing', currentSyncCode);
    
    // Completely overwrite cloud with local state to ensure deletions sync
    database.ref('sync/' + currentSyncCode).set(localState)
        .then(() => {
            setTimeout(() => {
                isSyncing = false;
                updateSyncUI('connected', currentSyncCode);
            }, 800);
        });
}

function mergeData(cloudState) {
    if(!cloudState) return;
    
    let changed = false;
    
    if(cloudState.startDate && cloudState.startDate !== state.startDate) {
        state.startDate = cloudState.startDate;
        changed = true;
    }
    if(cloudState.totalBudget && cloudState.totalBudget !== state.totalBudget) {
        state.totalBudget = cloudState.totalBudget;
        changed = true;
    }
    
    // Because we support deletions, we just adopt the cloud state's spendings array directly
    // This assumes the last writer wins (which works for our strict set() above)
    const cloudSpendingsStr = JSON.stringify(cloudState.spendings || []);
    const localSpendingsStr = JSON.stringify(state.spendings || []);
    
    if (cloudSpendingsStr !== localSpendingsStr) {
        state.spendings = cloudState.spendings || [];
        changed = true;
    }
    
    if(changed) {
        localStorage.setItem('budgetTrackerState', JSON.stringify(state));
        if (typeof render === "function") render(); 
    }
}
