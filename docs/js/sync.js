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

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

let currentSyncCode = null;
let isSyncing = false;

// --- Sync Functions ---
function setSyncStatus(status) {
    const dot = document.getElementById('sync-status-dot');
    const text = document.getElementById('sync-status-text');
    dot.className = 'dot'; // reset
    
    if(status === 'connected') {
        dot.classList.add('connected');
        text.innerText = 'Connected';
    } else if (status === 'syncing') {
        dot.classList.add('syncing');
        text.innerText = 'Syncing...';
    } else {
        dot.classList.add('disconnected');
        text.innerText = 'Disconnected';
    }
}

window.setSyncCodeUI = function(code) {
    currentSyncCode = code;
    document.getElementById('active-code-display').innerHTML = `<strong>Code:</strong> ${code}`;
    listenToCloud(code);
};

function generateSyncCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    
    state.syncCode = code; // Update app.js state
    saveLocal();
    window.setSyncCodeUI(code);
    
    // Initial push
    database.ref('sync/' + code).set(state).then(() => setSyncStatus('connected'));
}

function joinSync() {
    const code = document.getElementById('sync-code-input').value.toUpperCase();
    if(code.length !== 6) return alert("Code must be 6 characters.");
    
    database.ref('sync/' + code).once('value').then((snapshot) => {
        if(snapshot.exists()) {
            state.syncCode = code;
            mergeData(snapshot.val());
            window.setSyncCodeUI(code);
            alert("Joined successfully!");
        } else {
            alert("Code not found or expired.");
        }
    });
}

function listenToCloud(code) {
    setSyncStatus('connected');
    database.ref('sync/' + code).on('value', (snapshot) => {
        if(snapshot.exists() && !isSyncing) {
            mergeData(snapshot.val());
        }
    });
}

// Hook called by app.js every 10s and on change
window.appSyncData = function(localState) {
    if(!currentSyncCode) return;
    isSyncing = true;
    setSyncStatus('syncing');
    
    database.ref('sync/' + currentSyncCode).set(localState)
        .then(() => {
            setTimeout(() => {
                isSyncing = false;
                setSyncStatus('connected');
            }, 1000);
        });
}

// Merge cloud data with local data
function mergeData(cloudState) {
    if(!cloudState) return;
    
    let changed = false;
    
    // Merge basic settings if newer (simplified: cloud overrides basic settings)
    if(cloudState.startDate && cloudState.startDate !== state.startDate) {
        state.startDate = cloudState.startDate;
        changed = true;
    }
    if(cloudState.totalBudget && cloudState.totalBudget !== state.totalBudget) {
        state.totalBudget = cloudState.totalBudget;
        changed = true;
    }
    
    // Merge spendings (avoid duplicates based on ID)
    const localIds = state.spendings.map(s => s.id);
    const cloudSpendings = cloudState.spendings || [];
    
    cloudSpendings.forEach(cs => {
        if(!localIds.includes(cs.id)) {
            state.spendings.push(cs);
            changed = true;
        }
    });
    
    if(changed) {
        // Save without triggering a re-sync back to cloud immediately
        localStorage.setItem('budgetTrackerState', JSON.stringify(state));
        render(); // from app.js
    }
}
