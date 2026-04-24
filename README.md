# Minimalist Weekly Budget Tracker

A vanilla JavaScript, single-page budget tracker with auto-rebalancing weeks, local storage, and real-time cloud sync using a 6-character code.

## Setup Instructions

### 1. Firebase Configuration (Mandatory for Cloud Sync)
1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Create a new project.
3. Navigate to **Build > Realtime Database** and create a database.
4. Set the Security Rules for testing (Remember to tighten these later!):
   ```json
   {
     "rules": {
       ".read": true,
       ".write": true
     }
   }
