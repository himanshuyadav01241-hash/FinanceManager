// ==========================================
// 1. SAFE FIREBASE INITIALIZATION
// ==========================================
// REPLACE THIS CONFIG OBJECT WITH YOUR ACTUAL FIREBASE SECURE KEY MATRIX!
const firebaseConfig = {
    apiKey: "YOUR_API_KEY_HERE",
    authDomain: "YOUR_AUTH_DOMAIN_HERE",
    projectId: "YOUR_PROJECT_ID_HERE",
    storageBucket: "YOUR_STORAGE_BUCKET_HERE",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID_HERE",
    appId: "YOUR_APP_ID_HERE"
};

// Global handles for database state
let db;
let auth;

try {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    db = firebase.firestore();
    auth = firebase.auth();
    console.log("Firebase initialized successfully.");
} catch (error) {
    console.error("Firebase initialization failed! Check your configuration details inside script.js:", error);
}

// ==========================================
// 2. DOM ELEMENT WIRE-UP & THEME MANAGEMENT
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    const themeSelector = document.getElementById('theme');
    const addBtn = document.getElementById('addBtn');
    const customAuthBtn = document.getElementById('customAuthBtn');
    const googleBtn = document.getElementById('googleBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    
    // Core Interface Toggle Switch Elements
    const authScreen = document.getElementById('authScreen');
    const appScreen = document.getElementById('app');

    // Restore user visual system environment choice
    const localTheme = localStorage.getItem('selected-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', localTheme);
    if(themeSelector) themeSelector.value = localTheme;

    // Theme Switch Event Listener
    if (themeSelector) {
        themeSelector.addEventListener('change', (e) => {
            const chosenTheme = e.target.value;
            document.documentElement.setAttribute('data-theme', chosenTheme);
            localStorage.setItem('selected-theme', chosenTheme);
        });
    }

    // ==========================================
    // 3. TRANSACTION ACTION EVENT LISTENER
    // ==========================================
    if (addBtn) {
        addBtn.addEventListener('click', (e) => {
            e.preventDefault(); // Stop accidental form refreshing
            console.log("Save Button was pressed!");

            const titleVal = document.getElementById('title').value.trim();
            const amountVal = parseFloat(document.getElementById('amount').value);
            const typeVal = document.getElementById('type').value;
            const categoryVal = document.getElementById('category') ? document.getElementById('category').value : 'General';
            const statusVal = document.getElementById('status').value;
            const isRecurringVal = document.getElementById('isRecurring') ? document.getElementById('isRecurring').checked : false;

            if (!titleVal || isNaN(amountVal)) {
                alert("Please complete the Description and Amount fields with valid details.");
                return;
            }

            console.log("Payload verified successfully:", { titleVal, amountVal, typeVal, categoryVal, statusVal, isRecurringVal });
            
            // Temporary baseline local test to ensure your UI works without Firebase active
            alert(`Success! Saved transaction: "${titleVal}" for ₹${amountVal}`);
            
            /* 
            // When your Firebase setup is configured correctly, uncomment this block to push live:
            const user = auth.currentUser;
            if(user) {
                db.collection("users").doc(user.uid).collection("transactions").add({
                    title: titleVal,
                    amount: amountVal,
                    type: typeVal,
                    category: categoryVal,
                    status: statusVal,
                    isRecurring: isRecurringVal,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                })
                .then(() => {
                    console.log("Transaction successfully committed to cloud store.");
                    // Reset fields
                    document.getElementById('title').value = '';
                    document.getElementById('amount').value = '';
                })
                .catch(err => console.error("Database error writing document: ", err));
            }
            */
        });
    }

    // ==========================================
    // 4. AUTHENTICATION STATE WATCHDOG
    // ==========================================
    if(auth) {
        auth.onAuthStateChanged((user) => {
            if (user) {
                console.log("Active login authenticated:", user.email);
                if(authScreen) authScreen.style.display = 'none';
                if(appScreen) appScreen.style.display = 'block';
                // Trigger your balance calculations/ledger drawing scripts here...
            } else {
                console.log("No authenticated user session.");
                if(authScreen) authScreen.style.display = 'flex';
                if(appScreen) appScreen.style.display = 'none';
            }
        });
    } else {
        // Fallback layout bypass if running a local mockup design without Firebase connected
        console.warn("Bypassing login screen framework. Running in Mockup Local Development mode.");
        if(authScreen) authScreen.style.display = 'none';
        if(appScreen) appScreen.style.display = 'block';
    }

    // Social & Standard Login Event Hooks
    if(googleBtn) {
        googleBtn.addEventListener('click', () => {
            if(!auth) return alert("Firebase Auth not loaded yet.");
            const provider = new firebase.auth.GoogleAuthProvider();
            auth.signInWithPopup(provider).catch(err => alert("Google Sign-In failed: " + err.message));
        });
    }

    if(logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if(auth) auth.signOut();
        });
    }
});
