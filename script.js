// ==========================================
// 1. INITIALIZATION & FIREBASE CONFIGURATION
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyCCnwz-4HDj0baMMfhJ0oHWXfuhrFTvIr0",
  authDomain: "financeos-6eaf2.firebaseapp.com",
  projectId: "financeos-6eaf2",
  storageBucket: "financeos-6eaf2.firebasestorage.app",
  messagingSenderId: "503013740949",
  appId: "1:503013740949:web:a18ef8f8433711a672e69c",
  measurementId: "G-F769EYMHLJ"
};

// Initialize Firebase Instance Safely
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

// Application Reactive State Variables
let currentUser = null;
let unsubscribeTransactions = null;
let unsubscribeCategories = null;
let transactions = [];
let categories = ['Food', 'Utilities', 'Salary', 'Entertainment', 'Rent'];
let chartInstance = null;
let modalCallback = null;

// DOM Elements Selection Archetype
const authScreen = document.getElementById('authScreen');
const appScreen = document.getElementById('app');
const emailAuthForm = document.getElementById('emailAuthForm');
const authEmail = document.getElementById('authEmail');
const authPassword = document.getElementById('authPassword');
const customAuthBtn = document.getElementById('customAuthBtn');
const googleBtn = document.getElementById('googleBtn');
const logoutBtn = document.getElementById('logoutBtn');
const themeSelect = document.getElementById('theme');

const balanceEl = document.getElementById('balance');
const healthBadge = document.getElementById('healthBadge');
const incomeEl = document.getElementById('income');
const pendingIncomeEl = document.getElementById('pendingIncome');
const expenseEl = document.getElementById('expense');
const pendingExpenseEl = document.getElementById('pendingExpense');
const savingEl = document.getElementById('saving');

const txTitle = document.getElementById('title');
const txAmount = document.getElementById('amount');
const txType = document.getElementById('type');
const txCategory = document.getElementById('category');
const txStatus = document.getElementById('status');
const txIsRecurring = document.getElementById('isRecurring');
const addBtn = document.getElementById('addBtn');

const newCategoryInput = document.getElementById('newCategory');
const addCategoryBtn = document.getElementById('addCategory');
const categoryListEl = document.getElementById('categoryList');
const filterCategorySelect = document.getElementById('filterCategory');

const searchInput = document.getElementById('search');
const startDateInput = document.getElementById('startDate');
const endDateInput = document.getElementById('endDate');
const transactionListEl = document.getElementById('transactionList');
const exportBtn = document.getElementById('exportBtn');
const purgeCategoryBtn = document.getElementById('purgeCategoryBtn');
const deleteAccountBtn = document.getElementById('deleteAccountBtn');

const customModalOverlay = document.getElementById('customModalOverlay');
const modalIconContainer = document.getElementById('modalIconContainer');
const modalTitle = document.getElementById('modalTitle');
const modalDescription = document.getElementById('modalDescription');
const modalCancelBtn = document.getElementById('modalCancelBtn');
const modalConfirmBtn = document.getElementById('modalConfirmBtn');

// ==========================================
// 2. AUTHENTICATION & ROUTING CONTROLLERS
// ==========================================
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        authScreen.style.display = 'none';
        appScreen.style.display = 'block';
        initializeDashboard();
    } else {
        currentUser = null;
        authScreen.style.display = 'flex';
        appScreen.style.display = 'none';
        cleanupDashboardSubscriptions();
    }
});

// Hybrid Email Flow: Automatic Account Login/Registration Setup
customAuthBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    const email = authEmail.value.trim();
    const password = authPassword.value;

    if (!email || !password) return alert('Please enter both email and password.');

    try {
        await auth.signInWithEmailAndPassword(email, password);
    } catch (loginError) {
        if (loginError.code === 'auth/user-not-found') {
            try {
                await auth.createUserWithEmailAndPassword(email, password);
            } catch (createError) {
                alert(createError.message);
            }
        } else {
            alert(loginError.message);
        }
    }
});

// Google Authentication Flow Provider
googleBtn.addEventListener('click', async () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        await auth.signInWithPopup(provider);
    } catch (error) {
        alert(error.message);
    }
});

// User Session Termination
logoutBtn.addEventListener('click', () => {
    auth.signOut();
});

// ==========================================
// 3. LIFECYCLE MANAGEMENT & REAL-TIME DATA
// ==========================================
function initializeDashboard() {
    setupThemeController();
    
    // Continuous User Document Streams (Custom Category Data Storage)
    unsubscribeCategories = db.collection('users').doc(currentUser.uid)
        .onSnapshot(doc => {
            if (doc.exists && doc.data().categories) {
                categories = doc.data().categories;
            } else {
                db.collection('users').doc(currentUser.uid).set({ categories }, { merge: true });
            }
            renderCategoryUI();
        });

    // Sub-Collection Streams (Dynamic Live Transactions Ledger)
    unsubscribeTransactions = db.collection('users').doc(currentUser.uid).collection('transactions')
        .orderBy('createdAt', 'desc')
        .onSnapshot(snapshot => {
            transactions = [];
            snapshot.forEach(doc => {
                transactions.push({ id: doc.id, ...doc.data() });
            });
            processAndRenderDashboard();
        }, error => console.error("Firestore real-time error:", error));
}

function cleanupDashboardSubscriptions() {
    if (unsubscribeTransactions) unsubscribeTransactions();
    if (unsubscribeCategories) unsubscribeCategories();
    transactions = [];
}

// ==========================================
// 4. TRANSACTION ENGINE & DATA RECORDING
// ==========================================
addBtn.addEventListener('click', async () => {
    const title = txTitle.value.trim();
    const amount = parseFloat(txAmount.value);
    const type = txType.value;
    const category = txCategory.value;
    const status = txStatus.value;
    const isRecurring = txIsRecurring.checked;

    if (!title || isNaN(amount) || amount <= 0) {
        return alert('Please fill in a valid transaction name and numerical amount.');
    }

    const payload = {
        title,
        amount,
        type,
        category,
        status,
        isRecurring,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        await db.collection('users').doc(currentUser.uid).collection('transactions').add(payload);
        txTitle.value = '';
        txAmount.value = '';
        txIsRecurring.checked = false;
    } catch (error) {
        alert('Error saving record: ' + error.message);
    }
});

async function deleteTransaction(id) {
    try {
        await db.collection('users').doc(currentUser.uid).collection('transactions').doc(id).delete();
    } catch (error) {
        alert('Deletion error: ' + error.message);
    }
}

// ==========================================
// 5. METRIC AGGREGATION & DATA ANALYSIS
// ==========================================
function processAndRenderDashboard() {
    let settledIncome = 0;
    let pendingIncome = 0;
    let settledExpense = 0;
    let pendingExpense = 0;

    transactions.forEach(t => {
        if (t.type === 'income') {
            if (t.status === 'paid') settledIncome += t.amount;
            else pendingIncome += t.amount;
        } else {
            if (t.status === 'paid') settledExpense += t.amount;
            else pendingExpense += t.amount;
        }
    });

    const netBalance = settledIncome - settledExpense;
    
    // Savings Margin Percentage Calculation
    let savingsMargin = 0;
    if (settledIncome > 0) {
        savingsMargin = Math.round(((settledIncome - settledExpense) / settledIncome) * 100);
    }

    // UI Panel Values Interpolation
    balanceEl.textContent = `₹${netBalance.toLocaleString('en-IN')}`;
    incomeEl.textContent = `₹${settledIncome.toLocaleString('en-IN')}`;
    pendingIncomeEl.textContent = `Pending: ₹${pendingIncome.toLocaleString('en-IN')}`;
    expenseEl.textContent = `₹${settledExpense.toLocaleString('en-IN')}`;
    pendingExpenseEl.textContent = `Pending: ₹${pendingExpense.toLocaleString('en-IN')}`;
    savingEl.textContent = `${savingsMargin}%`;

    // Dynamic Financial Safety Health Badge Assignment
    healthBadge.className = 'badge';
    if (netBalance > settledExpense * 0.5) {
        healthBadge.textContent = 'Healthy';
        healthBadge.classList.add('badge-good');
    } else if (netBalance >= 0) {
        healthBadge.textContent = 'Warning';
        healthBadge.classList.add('badge-warn');
    } else {
        healthBadge.textContent = 'Critical';
        healthBadge.classList.add('badge-danger');
    }

    renderLedger();
    renderAnalyticsChart();
}

// ==========================================
// 6. LEDGER RENDERER & RUNTIME FILTERING
// ==========================================
function renderLedger() {
    transactionListEl.innerHTML = '';
    const query = searchInput.value.toLowerCase();
    const selectedCat = filterCategorySelect.value;
    const start = startDateInput.value ? new Date(startDateInput.value) : null;
    const end = endDateInput.value ? new Date(endDateInput.value) : null;

    if (end) end.setHours(23, 59, 59, 999);

    const filtered = transactions.filter(t => {
        const matchesSearch = t.title.toLowerCase().includes(query);
        const matchesCategory = selectedCat === 'all' || t.category === selectedCat;
        
        let matchesDate = true;
        if (t.createdAt && t.createdAt.toDate) {
            const dateObj = t.createdAt.toDate();
            if (start && dateObj < start) matchesDate = false;
            if (end && dateObj > end) matchesDate = false;
        }

        return matchesSearch && matchesCategory && matchesDate;
    });

    if (filtered.length === 0) {
        transactionListEl.innerHTML = `<li style="text-align:center; padding: 20px; color:var(--text-muted);">No records match current filters</li>`;
        return;
    }

    filtered.forEach(t => {
        const li = document.createElement('li');
        li.className = 'categoryCard';
        li.style.borderLeft = `4px solid ${t.type === 'income' ? 'var(--success-accent)' : 'var(--danger-accent)'}`;
        
        const timestamp = t.createdAt && t.createdAt.toDate ? t.createdAt.toDate().toLocaleDateString('en-IN') : 'Syncing...';
        const recurringTag = t.isRecurring ? ' <i class="fa-solid fa-arrows-spin" title="Monthly Recurring"></i>' : '';

        li.innerHTML = `
            <div>
                <strong style="display:block;">${t.title}${recurringTag}</strong>
                <small style="color:var(--text-muted);">${t.category} • ${timestamp}</small>
            </div>
            <div style="display:flex; align-items:center; gap:12px;">
                <span class="status-badge ${t.status === 'paid' ? 'status-paid' : 'status-pending'}">
                    ${t.status === 'paid' ? 'Settled' : 'Pending'}
                </span>
                <span style="font-weight:bold;">${t.type === 'income' ? '+' : '-'}₹${t.amount}</span>
                <button onclick="deleteTransaction('${t.id}')" style="background:transparent; border:none; color:var(--danger-accent); cursor:pointer;">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;
        transactionListEl.appendChild(li);
    });
}

// Map transaction context globally for execution inside runtime elements
window.deleteTransaction = deleteTransaction;

// Set up event listeners for filters
[searchInput, filterCategorySelect, startDateInput, endDateInput].forEach(elem => {
    elem.addEventListener('input', renderLedger);
});

// ==========================================
// 7. CATEGORY MANAGEMENT SYSTEMS
// ==========================================
function renderCategoryUI() {
    const priorAddSelection = txCategory.value;
    const priorFilterSelection = filterCategorySelect.value;

    txCategory.innerHTML = '';
    filterCategorySelect.innerHTML = '<option value="all">All Categories</option>';
    categoryListEl.innerHTML = '';

    categories.forEach(cat => {
        const opt1 = document.createElement('option');
        opt1.value = cat; opt1.textContent = cat;
        txCategory.appendChild(opt1);

        const opt2 = document.createElement('option');
        opt2.value = cat; opt2.textContent = cat;
        filterCategorySelect.appendChild(opt2);

        const row = document.createElement('div');
        row.className = 'categoryCard';
        row.innerHTML = `
            <span>${cat}</span>
            <button onclick="removeCategory('${cat}')" style="background:transparent; border:none; color:var(--text-muted); cursor:pointer;">
                <i class="fa-solid fa-xmark"></i>
            </button>
        `;
        categoryListEl.appendChild(row);
    });

    if (categories.includes(priorAddSelection)) txCategory.value = priorAddSelection;
    if (categories.includes(priorFilterSelection)) filterCategorySelect.value = priorFilterSelection;
}

addCategoryBtn.addEventListener('click', async () => {
    const freshCat = newCategoryInput.value.trim();
    if (!freshCat || categories.includes(freshCat)) return;
    
    categories.push(freshCat);
    newCategoryInput.value = '';
    
    await db.collection('users').doc(currentUser.uid).set({ categories }, { merge: true });
});

window.removeCategory = async function(targetCat) {
    const updated = categories.filter(c => c !== targetCat);
    await db.collection('users').doc(currentUser.uid).set({ categories: updated }, { merge: true });
};

// ==========================================
// 8. CANVAS GRAPHICS SYSTEM (CHART.JS)
// ==========================================
function renderAnalyticsChart() {
    const ctx = document.getElementById('analyticsChart').getContext('2d');
    
    const summary = {};
    transactions.filter(t => t.type === 'expense').forEach(t => {
        summary[t.category] = (summary[t.category] || 0) + t.amount;
    });

    const labels = Object.keys(summary);
    const data = Object.values(summary);

    if (chartInstance) {
        chartInstance.destroy();
    }

    if (labels.length === 0) {
        ctx.clearRect(0, 0, 320, 320);
        return;
    }

    const computedStyle = getComputedStyle(document.body);
    const primaryText = computedStyle.getPropertyValue('--text-primary').trim();
    const inputBg = computedStyle.getPropertyValue('--bg-input').trim();

    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: [
                    '#4285F4', '#0F9D58', '#F4B400', '#db4437', '#9c27b0', '#00bcd4', '#ff5722'
                ],
                borderWidth: 2,
                borderColor: inputBg
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: primaryText, font: { family: 'sans-serif', size: 11 } }
                }
            }
        }
    });
}

// ==========================================
// 9. THEME ENGINE CONTROLLER
// ==========================================
function setupThemeController() {
    const storedTheme = localStorage.getItem('tracker-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', storedTheme);
    themeSelect.value = storedTheme;

    themeSelect.addEventListener('change', (e) => {
        const selectedTheme = e.target.value;
        document.documentElement.setAttribute('data-theme', selectedTheme);
        localStorage.setItem('tracker-theme', selectedTheme);
        renderAnalyticsChart();
    });
}

// ==========================================
// 10. SYSTEM POP-UP MODALS & CLEANUP UTILS
// ==========================================
function triggerModal(title, description, iconClass, onConfirm) {
    modalTitle.textContent = title;
    modalDescription.textContent = description;
    modalIconContainer.innerHTML = `<i class="${iconClass}"></i>`;
    customModalOverlay.style.display = 'flex';
    modalCallback = onConfirm;
}

modalCancelBtn.addEventListener('click', () => {
    customModalOverlay.style.display = 'none';
    modalCallback = null;
});

modalConfirmBtn.addEventListener('click', () => {
    if (modalCallback) modalCallback();
    customModalOverlay.style.display = 'none';
});

// Purge Targeted Records
purgeCategoryBtn.addEventListener('click', () => {
    const targetCat = filterCategorySelect.value;
    const scopeMessage = targetCat === 'all' 
        ? "all transactional logs currently saved inside this account profile" 
        : `all logs mapped under the "${targetCat}" category matching your workspace setup`;

    triggerModal(
        "Purge Records?",
        `Are you sure you want to permanently clear ${scopeMessage}? This change cannot be reverted.`,
        "fa-solid fa-triangle-exclamation",
        async () => {
            const batch = db.batch();
            const query = searchInput.value.toLowerCase();
            const start = startDateInput.value ? new Date(startDateInput.value) : null;
            const end = endDateInput.value ? new Date(endDateInput.value) : null;
            if (end) end.setHours(23, 59, 59, 999);

            transactions.forEach(t => {
                const matchesSearch = t.title.toLowerCase().includes(query);
                const matchesCategory = targetCat === 'all' || t.category === targetCat;
                let matchesDate = true;
                if (t.createdAt && t.createdAt.toDate) {
                    const dateObj = t.createdAt.toDate();
                    if (start && dateObj < start) matchesDate = false;
                    if (end && dateObj > end) matchesDate = false;
                }

                if (matchesSearch && matchesCategory && matchesDate) {
                    const ref = db.collection('users').doc(currentUser.uid).collection('transactions').doc(t.id);
                    batch.delete(ref);
                }
            });

            await batch.commit();
        }
    );
});

// Profile Data Reset Engine
deleteAccountBtn.addEventListener('click', () => {
    triggerModal(
        "Wipe Out Ledger Profiles?",
        "CRITICAL WARNING: This completely deletes all custom categories and structural transaction instances permanently.",
        "fa-solid fa-radiation",
        async () => {
            try {
                const snapshot = await db.collection('users').doc(currentUser.uid).collection('transactions').get();
                const batch = db.batch();
                snapshot.forEach(doc => batch.delete(doc.ref));
                await batch.commit();

                await db.collection('users').doc(currentUser.uid).delete();
                alert("Profile data wiped successfully.");
            } catch (err) {
                alert("Error during structural wipeout: " + err.message);
            }
        }
    );
});

// ==========================================
// 11. FILE EXPORT: FLAT ARCHIVE COMPILES (CSV)
// ==========================================
exportBtn.addEventListener('click', () => {
    if (transactions.length === 0) return alert("No operational data targets present to pack.");

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "ID,Description,Amount,Type,Category,Status,Recurring,Date\r\n";

    transactions.forEach(t => {
        const dateStr = t.createdAt && t.createdAt.toDate ? t.createdAt.toDate().toISOString() : 'Pending';
        const cleanTitle = t.title.replace(/,/g, '');
        const row = `${t.id},${cleanTitle},${t.amount},${t.type},${t.category},${t.status},${t.isRecurring},${dateStr}`;
        csvContent += row + "\r\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Finance_Export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});
