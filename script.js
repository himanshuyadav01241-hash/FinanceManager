// ==========================================
// 1. FIREBASE CONFIGURATION & INITIALIZATION
// ==========================================
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

// ==========================================
// 2. DOM ELEMENT SELECTORS
// ==========================================
const authScreen = document.getElementById('authScreen');
const appScreen = document.getElementById('app');
const googleBtn = document.getElementById('googleBtn');
const logoutBtn = document.getElementById('logoutBtn');
const themeSelect = document.getElementById('theme');

const emailAuthForm = document.getElementById('emailAuthForm');
const authEmail = document.getElementById('authEmail');
const authPassword = document.getElementById('authPassword');
const customAuthBtn = document.getElementById('customAuthBtn');
const toggleAuthMode = document.getElementById('toggleAuthMode');
const authTitle = document.getElementById('authTitle');
const authSubtitle = document.getElementById('authSubtitle');

const titleInput = document.getElementById('title');
const amountInput = document.getElementById('amount');
const typeSelect = document.getElementById('type');
const categorySelect = document.getElementById('category');
const statusSelect = document.getElementById('status');
const isRecurringCheck = document.getElementById('isRecurring');
const addBtn = document.getElementById('addBtn');

const balanceEl = document.getElementById('balance');
const healthBadgeEl = document.getElementById('healthBadge');
const incomeEl = document.getElementById('income');
const pendingIncomeEl = document.getElementById('pendingIncome');
const expenseEl = document.getElementById('expense');
const pendingExpenseEl = document.getElementById('pendingExpense');
const savingEl = document.getElementById('saving');

const newCategoryInput = document.getElementById('newCategory');
const addCategoryBtn = document.getElementById('addCategory');
const categoryListEl = document.getElementById('categoryList');

const searchInput = document.getElementById('search');
const filterCategorySelect = document.getElementById('filterCategory');
const startDateInput = document.getElementById('startDate');
const endDateInput = document.getElementById('endDate');
const transactionListEl = document.getElementById('transactionList');
const exportBtn = document.getElementById('exportBtn');
const purgeCategoryBtn = document.getElementById('purgeCategoryBtn');
const deleteAccountBtn = document.getElementById('deleteAccountBtn');

const modalOverlay = document.getElementById('customModalOverlay');
const modalTitle = document.getElementById('modalTitle');
const modalDescription = document.getElementById('modalDescription');
const modalIconContainer = document.getElementById('modalIconContainer');
const modalConfirmBtn = document.getElementById('modalConfirmBtn');
const modalCancelBtn = document.getElementById('modalCancelBtn');

// Global Application State Variables
let currentUser = null;
let transactions = [];
let userCategories = ["Salary", "Food", "Rent", "Utilities", "Entertainment"];
let analyticsChart = null;
let currentModalAction = null;
let isLoginMode = true;

// ==========================================
// 3. AUTHENTICATION SERVICES
// ==========================================

toggleAuthMode.addEventListener('click', () => {
    isLoginMode = !isLoginMode;
    if (isLoginMode) {
        authTitle.textContent = "Welcome Back";
        authSubtitle.textContent = "Sign in to manage and secure your transactions across all your devices instantly.";
        customAuthBtn.textContent = "Sign In";
        toggleAuthMode.textContent = "Don't have an account? Sign Up";
    } else {
        authTitle.textContent = "Create Account";
        authSubtitle.textContent = "Sign up now to start tracking your finances across devices seamlessly.";
        customAuthBtn.textContent = "Sign Up";
        toggleAuthMode.textContent = "Already have an account? Sign In";
    }
});

customAuthBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    const email = authEmail.value.trim();
    const password = authPassword.value;

    if (!email || !password) {
        alert("Please complete all requested sign-in credentials.");
        return;
    }

    try {
        if (isLoginMode) {
            await auth.signInWithEmailAndPassword(email, password);
        } else {
            await auth.createUserWithEmailAndPassword(email, password);
        }
        authEmail.value = "";
        authPassword.value = "";
    } catch (error) {
        alert(error.message);
    }
});

googleBtn.addEventListener('click', async () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        await auth.signInWithPopup(provider);
    } catch (error) {
        alert("Google Sign-In Failed: " + error.message);
    }
});

logoutBtn.addEventListener('click', () => {
    auth.signOut();
});

auth.onAuthStateChanged((user) => {
    if (user) {
        currentUser = user;
        authScreen.style.display = 'none';
        appScreen.style.display = 'block';
        initializeUserWorkspace();
    } else {
        currentUser = null;
        transactions = [];
        authScreen.style.display = 'flex';
        appScreen.style.display = 'none';
        if(analyticsChart) analyticsChart.destroy();
    }
});

// ==========================================
// 4. DATA ENGINE & DATABASE WORKSPACE
// ==========================================

function initializeUserWorkspace() {
    db.collection('users').doc(currentUser.uid).onSnapshot(doc => {
        if (doc.exists && doc.data().categories) {
            userCategories = doc.data().categories;
        } else {
            db.collection('users').doc(currentUser.uid).set({ categories: userCategories });
        }
        renderCategorySelectors();
    });

    db.collection('users').doc(currentUser.uid).collection('transactions')
        .orderBy('createdAt', 'desc')
        .onSnapshot(snapshot => {
            transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            processCalculationsAndRender();
        }, error => {
            console.error("Firestore synchronizer crash: ", error);
        });
}

// ==========================================
// 5. TRANSACTIONS & MANAGEMENT LOGIC
// ==========================================

addBtn.addEventListener('click', async () => {
    const title = titleInput.value.trim();
    const amount = parseFloat(amountInput.value);
    const type = typeSelect.value;
    const category = categorySelect.value;
    const status = statusSelect.value;
    const isRecurring = isRecurringCheck.checked;

    if (!title || isNaN(amount) || amount <= 0) {
        alert("Provide valid description and amount quantities.");
        return;
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
        titleInput.value = '';
        amountInput.value = '';
        isRecurringCheck.checked = false;
    } catch (error) {
        alert("Operation failed targeting data pipeline.");
    }
});

async function deleteTransaction(id) {
    try {
        await db.collection('users').doc(currentUser.uid).collection('transactions').doc(id).delete();
    } catch (error) {
        alert("Failed to erase log segment.");
    }
}

async function toggleStatus(id, currentStatus) {
    const nextStatus = currentStatus === 'paid' ? 'pending' : 'paid';
    try {
        await db.collection('users').doc(currentUser.uid).collection('transactions').doc(id).update({
            status: nextStatus
        });
    } catch (error) {
        console.error("Failed to alter status indicator.");
    }
}

// ==========================================
// 6. CATEGORIES ENGINE MODULES
// ==========================================

function renderCategorySelectors() {
    categorySelect.innerHTML = userCategories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
    filterCategorySelect.innerHTML = `<option value="all">All Categories</option>` + userCategories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
    categoryListEl.innerHTML = userCategories.map(cat => `
        <div class="categoryCard">
            <span>${cat}</span>
            <button onclick="deleteCategory('${cat}')" style="background:transparent; border:none; color:var(--danger-accent); padding:2px 6px;">
                <i class="fa-solid fa-trash-can"></i>
            </button>
        </div>
    `).join('');
}

addCategoryBtn.addEventListener('click', async () => {
    const newCat = newCategoryInput.value.trim();
    if (!newCat || userCategories.includes(newCat)) return;

    const updatedCategories = [...userCategories, newCat];
    try {
        await db.collection('users').doc(currentUser.uid).update({ categories: updatedCategories });
        newCategoryInput.value = '';
    } catch (error) {
        alert("Failed to synchronize category collection metadata.");
    }
});

async function deleteCategory(categoryName) {
    const updatedCategories = userCategories.filter(cat => cat !== categoryName);
    try {
        await db.collection('users').doc(currentUser.uid).update({ categories: updatedCategories });
    } catch (error) {
        console.error("Failed modification routines.");
    }
}

// ==========================================
// 7. MATH CALCULATIONS & UI RENDERING
// ==========================================

function processCalculationsAndRender() {
    let totalBalance = 0;
    let totalIncome = 0;
    let totalExpense = 0;
    let pendingIncome = 0;
    let pendingExpense = 0;

    transactions.forEach(t => {
        if (t.type === 'income') {
            if (t.status === 'paid') totalIncome += t.amount;
            else pendingIncome += t.amount;
        } else {
            if (t.status === 'paid') totalExpense += t.amount;
            else pendingExpense += t.amount;
        }
    });

    totalBalance = totalIncome - totalExpense;

    balanceEl.textContent = `₹${totalBalance.toLocaleString()}`;
    incomeEl.textContent = `₹${totalIncome.toLocaleString()}`;
    expenseEl.textContent = `₹${totalExpense.toLocaleString()}`;
    pendingIncomeEl.textContent = `Pending: ₹${pendingIncome.toLocaleString()}`;
    pendingExpenseEl.textContent = `Pending: ₹${pendingExpense.toLocaleString()}`;

    if (totalBalance > 5000) {
        healthBadgeEl.textContent = "Healthy";
        healthBadgeEl.className = "badge badge-good";
    } else if (totalBalance >= 0) {
        healthBadgeEl.textContent = "Warning";
        healthBadgeEl.className = "badge badge-warn";
    } else {
        healthBadgeEl.textContent = "Deficit";
        healthBadgeEl.className = "badge badge-danger";
    }

    if (totalIncome > 0) {
        const rate = ((totalIncome - totalExpense) / totalIncome) * 100;
        savingEl.textContent = `${Math.max(0, Math.round(rate))}%`;
    } else {
        savingEl.textContent = "0%";
    }

    renderLedger();
    renderAnalyticsChart();
}

function renderLedger() {
    const searchVal = searchInput.value.toLowerCase();
    const catFilter = filterCategorySelect.value;
    const startVal = startDateInput.value ? new Date(startDateInput.value) : null;
    const endVal = endDateInput.value ? new Date(endDateInput.value) : null;

    const filtered = transactions.filter(t => {
        const matchesSearch = t.title.toLowerCase().includes(searchVal);
        const matchesCat = (catFilter === 'all') || (t.category === catFilter);
        
        let matchesDate = true;
        if (t.createdAt && t.createdAt.toDate) {
            const txDate = t.createdAt.toDate();
            if (startVal && txDate < startVal) matchesDate = false;
            if (endVal && txDate > endVal) matchesDate = false;
        }
        
        return matchesSearch && matchesCat && matchesDate;
    });

    transactionListEl.innerHTML = filtered.map(t => {
        const sign = t.type === 'income' ? '+' : '-';
        const colorClass = t.type === 'income' ? 'incomeText' : 'expenseText';
        const statusClass = t.status === 'paid' ? 'status-paid' : 'status-pending';
        const statusText = t.status === 'paid' ? 'Settled' : 'Pending';
        const repeatIcon = t.isRecurring ? `<i class="fa-solid fa-arrows-rotate" title="Recurring Event" style="margin-left:5px; font-size:0.8rem; opacity:0.6;"></i>` : '';

        return `
            <li class="categoryCard" style="margin-bottom: 10px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <strong style="font-size: 1rem;">${t.title}</strong> ${repeatIcon}
                    <div style="font-size: 0.75rem; color:var(--text-muted); margin-top:4px;">
                        <span class="status-badge ${statusClass}" style="cursor:pointer;" onclick="toggleStatus('${t.id}', '${t.status}')">${statusText}</span> · ${t.category}
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap:15px;">
                    <span class="${colorClass}" style="font-weight:bold; font-size:1.05rem;">${sign}₹${t.amount}</span>
                    <button onclick="deleteTransaction('${t.id}')" style="background:transparent; border:none; color:var(--danger-accent); cursor:pointer;">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </li>
        `;
    }).join('');
}

[searchInput, filterCategorySelect, startDateInput, endDateInput].forEach(el => {
    el.addEventListener('input', renderLedger);
});

// ==========================================
// 8. GRAPHICAL ANALYTICS COMPONENT
// ==========================================

function renderAnalyticsChart() {
    const ctx = document.getElementById('analyticsChart').getContext('2d');
    const expenseDataMap = {};
    userCategories.forEach(c => expenseDataMap[c] = 0);

    transactions.forEach(t => {
        if (t.type === 'expense' && t.status === 'paid' && expenseDataMap[t.category] !== undefined) {
            expenseDataMap[t.category] += t.amount;
        }
    });

    const labels = Object.keys(expenseDataMap).filter(c => expenseDataMap[c] > 0);
    const data = labels.map(c => expenseDataMap[c]);

    if (analyticsChart) {
        analyticsChart.destroy();
    }

    if (data.length === 0) {
        if(ctx.canvas) ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        return;
    }

    // Dynamic contrast balancing for the 4 explicit theme presets
    const activeTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const labelColor = (activeTheme === 'light' || activeTheme === 'emerald') ? '#333333' : '#ffffff';

    analyticsChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: [
                    '#4285F4', '#EA4335', '#FBBC05', '#34A853', 
                    '#8E44AD', '#34495E', '#16A085', '#D35400'
                ],
                borderWidth: 1,
                borderColor: 'var(--bg-surface)'
            }]
        },
        options: {
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: labelColor }
                }
            },
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

// ==========================================
// 9. DATA CONVERSION EXPORT MODULES (CSV)
// ==========================================

exportBtn.addEventListener('click', () => {
    if (transactions.length === 0) {
        alert("No transaction entries available for extraction.");
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,Description,Amount,Type,Category,Status,Recurring\n";
    transactions.forEach(t => {
        csvContent += `"${t.title.replace(/"/g, '""')}",${t.amount},${t.type},${t.category},${t.status},${t.isRecurring}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Finance_Export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

// ==========================================
// 10. PROMPT MODAL INTERFACES
// ==========================================

function displayModal(title, description, iconClass, confirmAction) {
    modalTitle.textContent = title;
    modalDescription.textContent = description;
    modalIconContainer.innerHTML = `<i class="${iconClass}"></i>`;
    currentModalAction = confirmAction;
    modalOverlay.style.display = 'flex';
}

modalCancelBtn.addEventListener('click', () => {
    modalOverlay.style.display = 'none';
    currentModalAction = null;
});

modalConfirmBtn.addEventListener('click', () => {
    if (typeof currentModalAction === 'function') {
        currentModalAction();
    }
    modalOverlay.style.display = 'none';
});

purgeCategoryBtn.addEventListener('click', () => {
    const targetCat = filterCategorySelect.value;
    const desc = targetCat === 'all' 
        ? "This will delete every transaction history item logged in your profile."
        : `This will completely wipe all ledger entries under the category: "${targetCat}".`;

    displayModal(
        "Purge Transaction Logs?",
        desc,
        "fa-solid fa-triangle-exclamation",
        async () => {
            const batch = db.batch();
            transactions.forEach(t => {
                if (targetCat === 'all' || t.category === targetCat) {
                    const ref = db.collection('users').doc(currentUser.uid).collection('transactions').doc(t.id);
                    batch.delete(ref);
                }
            });
            await batch.commit();
        }
    );
});

deleteAccountBtn.addEventListener('click', () => {
    displayModal(
        "Permanently Wipe All Data?",
        "Warning: This action completely empties all cloud records. You will log out immediately and this process cannot be undone.",
        "fa-solid fa-skull-crossbones",
        async () => {
            try {
                const snapshot = await db.collection('users').doc(currentUser.uid).collection('transactions').get();
                const batch = db.batch();
                snapshot.docs.forEach(doc => batch.delete(doc.ref));
                await batch.commit();
                await db.collection('users').doc(currentUser.uid).delete();
                await auth.currentUser.delete();
            } catch (error) {
                alert("Account destruction failure. Logging out as precaution. Error: " + error.message);
                auth.signOut();
            }
        }
    );
});

// ==========================================
// 11. LAYOUT THEME MANAGEMENT CONTROL SWITCH
// ==========================================

themeSelect.addEventListener('change', (e) => {
    const selectedTheme = e.target.value;
    document.documentElement.setAttribute('data-theme', selectedTheme);
    renderAnalyticsChart();
});
