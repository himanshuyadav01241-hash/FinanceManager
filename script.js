// ==========================================
// 1. FIREBASE & STATE INITIALIZATION
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

// Initialize Firebase Core & Auth instances
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const googleProvider = new firebase.auth.GoogleAuthProvider();

let state = {
    user: null,
    transactions: [],
    categories: {
        "Food": 5000,
        "Utilities": 3000,
        "Entertainment": 2000,
        "Salary": 0
    },
    theme: "dark"
};

const DEFAULT_CATEGORIES = { "Food": 5000, "Utilities": 3000, "Entertainment": 2000, "Salary": 0 };
let analyticsChart = null;
let currentModalAction = null;

// ==========================================
// 2. DOM ELEMENT SELECTORS
// ==========================================
const DOM = {
    authScreen: document.getElementById('authScreen'),
    app: document.getElementById('app'),
    googleBtn: document.getElementById('googleBtn'),
    logoutBtn: document.getElementById('logoutBtn'),
    themeSelect: document.getElementById('theme'),
    
    // Summary Cards
    balance: document.getElementById('balance'),
    healthBadge: document.getElementById('healthBadge'),
    income: document.getElementById('income'),
    pendingIncome: document.getElementById('pendingIncome'),
    expense: document.getElementById('expense'),
    pendingExpense: document.getElementById('pendingExpense'),
    savingRate: document.getElementById('saving'),
    
    // Ingestion Forms
    titleInput: document.getElementById('title'),
    amountInput: document.getElementById('amount'),
    typeSelect: document.getElementById('type'),
    categorySelect: document.getElementById('category'),
    statusSelect: document.getElementById('status'),
    isRecurringCheckbox: document.getElementById('isRecurring'),
    addTransactionBtn: document.getElementById('addBtn'),
    
    // Category Management
    newCategoryInput: document.getElementById('newCategory'),
    addCategoryBtn: document.getElementById('addCategory'),
    categoryList: document.getElementById('categoryList'),
    filterCategory: document.getElementById('filterCategory'),
    
    // Ledger History & Global Workspace Actions
    transactionList: document.getElementById('transactionList'),
    searchInput: document.getElementById('search'),
    startDateInput: document.getElementById('startDate'),
    endDateInput: document.getElementById('endDate'),
    exportBtn: document.getElementById('exportBtn'),
    purgeViewBtn: document.getElementById('purgeCategoryBtn'),
    deleteAccountBtn: document.getElementById('deleteAccountBtn'),
    
    // Custom Dialogue Engine Core Elements
    modalOverlay: document.getElementById('customModalOverlay'),
    modalIcon: document.getElementById('modalIconContainer'),
    modalTitle: document.getElementById('modalTitle'),
    modalDesc: document.getElementById('modalDescription'),
    modalInputConfirm: document.getElementById('modalConfirmationInput'),
    modalInputSecondary: document.getElementById('modalSecondaryInput'),
    modalInputBudget: document.getElementById('modalBudgetInput'),
    modalCancelBtn: document.getElementById('modalCancelBtn'),
    modalConfirmBtn: document.getElementById('modalConfirmBtn')
};

// ==========================================
// 3. STORAGE & STATE PERSISTENCE CONTROLLERS
// ==========================================
function saveStateToStorage() {
    if (state.user) {
        localStorage.setItem(`finance_tracker_user_${state.user}`, JSON.stringify({
            transactions: state.transactions,
            categories: state.categories,
            theme: state.theme
        }));
    }
}

function loadStateFromStorage(userId) {
    state.user = userId;
    const savedData = localStorage.getItem(`finance_tracker_user_${userId}`);
    if (savedData) {
        const parsed = JSON.parse(savedData);
        state.transactions = parsed.transactions || [];
        state.categories = parsed.categories || DEFAULT_CATEGORIES;
        state.theme = parsed.theme || "dark";
    } else {
        state.transactions = [];
        state.categories = { ...DEFAULT_CATEGORIES };
        state.theme = "dark";
    }
    
    checkAndProcessRecurringTransactions();
}

// ==========================================
// 4. DIALOGUE MODAL ENGINE SYSTEM (PROMPT ROUTING)
// ==========================================
function openModal({ icon, title, desc, type, onConfirm }) {
    DOM.modalOverlay.style.display = 'flex';
    DOM.modalConfirmBtn.style.display = 'inline-block';
    DOM.modalIcon.innerHTML = icon;
    DOM.modalTitle.textContent = title;
    DOM.modalDesc.textContent = desc;
    
    DOM.modalInputConfirm.style.display = 'none';
    DOM.modalInputSecondary.style.display = 'none';
    DOM.modalInputBudget.style.display = 'none';
    DOM.modalInputConfirm.value = '';
    DOM.modalInputSecondary.value = '';
    DOM.modalInputBudget.value = '';

    if (type === 'deleteAccount') {
        DOM.modalInputConfirm.style.display = 'block';
        DOM.modalInputConfirm.placeholder = 'Type "DELETE" to confirm';
    } else if (type === 'setBudget') {
        DOM.modalInputBudget.style.display = 'block';
        DOM.modalInputBudget.placeholder = 'Monthly Target (₹)';
    }

    currentModalAction = onConfirm;
}

function closeModal() {
    DOM.modalOverlay.style.display = 'none';
    currentModalAction = null;
}

// ==========================================
// 5. CORE TRANSACTION ENGINE & CALCULATIONS
// ==========================================
function checkAndProcessRecurringTransactions() {
    const today = new Date();
    const currentMonthYear = `${today.getMonth()}-${today.getFullYear()}`;
    let stateMutated = false;

    state.transactions.forEach(t => {
        if (t.isRecurring && t.lastGeneratedMonthYear !== currentMonthYear) {
            const lastGenDate = new Date(t.date);
            if (today.getMonth() !== lastGenDate.getMonth() || today.getFullYear() !== lastGenDate.getFullYear()) {
                
                const recurrenceClone = {
                    id: 'tx_' + Date.now() + Math.random().toString(36).substr(2, 4),
                    title: `[Auto-Repeat] ${t.title}`,
                    amount: t.amount,
                    type: t.type,
                    category: t.category,
                    status: t.status, 
                    date: today.toISOString().split('T')[0],
                    isRecurring: true,
                    lastGeneratedMonthYear: currentMonthYear
                };
                
                t.lastGeneratedMonthYear = currentMonthYear;
                state.transactions.push(recurrenceClone);
                stateMutated = true;
            }
        }
    });

    if (stateMutated) saveStateToStorage();
}

function updateApplicationUI() {
    document.body.setAttribute('data-theme', state.theme);
    DOM.themeSelect.value = state.theme;

    let totalSettledIncome = 0;
    let totalPendingIncome = 0;
    let totalSettledExpense = 0;
    let totalPendingExpense = 0;

    state.transactions.forEach(t => {
        const amt = parseFloat(t.amount) || 0;
        if (t.type === 'income') {
            if (t.status === 'paid') totalSettledIncome += amt;
            else totalPendingIncome += amt;
        } else {
            if (t.status === 'paid') totalSettledExpense += amt;
            else totalPendingExpense += amt;
        }
    });

    const absoluteWalletBalance = totalSettledIncome - totalSettledExpense;
    
    DOM.balance.textContent = `₹${absoluteWalletBalance.toLocaleString('en-IN')}`;
    DOM.income.textContent = `₹${totalSettledIncome.toLocaleString('en-IN')}`;
    DOM.pendingIncome.textContent = `₹${totalPendingIncome.toLocaleString('en-IN')}`;
    DOM.expense.textContent = `₹${totalSettledExpense.toLocaleString('en-IN')}`;
    DOM.pendingExpense.textContent = `₹${totalPendingExpense.toLocaleString('en-IN')}`;

    let savingsRatePercentage = 0;
    if (totalSettledIncome > 0) {
        savingsRatePercentage = Math.round(((totalSettledIncome - totalSettledExpense) / totalSettledIncome) * 100);
    }
    DOM.savingRate.textContent = `${savingsRatePercentage < 0 ? 0 : savingsRatePercentage}%`;

    DOM.healthBadge.className = 'badge';
    if (absoluteWalletBalance < 0) {
        DOM.healthBadge.textContent = "Deficit Danger";
        DOM.healthBadge.classList.add('badge-danger');
    } else if (savingsRatePercentage < 20) {
        DOM.healthBadge.textContent = "Low Savings Rate";
        DOM.healthBadge.classList.add('badge-warn');
    } else {
        DOM.healthBadge.textContent = "Healthy Cashflow";
        DOM.healthBadge.classList.add('badge-good');
    }

    populateCategorySelectors();
    renderCategorySettingsPanel(totalSettledExpense);
    renderLedgerTransactions();
    renderAnalyticsGraphs();
}

function populateCategorySelectors() {
    const currentFilterVal = DOM.filterCategory.value;
    
    DOM.categorySelect.innerHTML = '';
    DOM.filterCategory.innerHTML = '<option value="all">All Categories</option>';
    
    Object.keys(state.categories).forEach(cat => {
        const opt1 = document.createElement('option');
        opt1.value = cat; opt1.textContent = cat;
        DOM.categorySelect.appendChild(opt1);
        
        const opt2 = document.createElement('option');
        opt2.value = cat; opt2.textContent = cat;
        DOM.filterCategory.appendChild(opt2);
    });

    if (state.categories[currentFilterVal] || currentFilterVal === 'all') {
        DOM.filterCategory.value = currentFilterVal;
    }
}

function renderCategorySettingsPanel(totalSettledExpense) {
    DOM.categoryList.innerHTML = '';
    
    const spendingMap = {};
    state.transactions.forEach(t => {
        if (t.type === 'expense' && t.status === 'paid') {
            spendingMap[t.category] = (spendingMap[t.category] || 0) + parseFloat(t.amount);
        }
    });

    Object.keys(state.categories).forEach(catName => {
        const budgetTarget = state.categories[catName] || 0;
        const actualSpent = spendingMap[catName] || 0;
        
        const card = document.createElement('div');
        card.className = 'categoryCard';
        
        let budgetContextHtml = `<small style="display:block; opacity:0.6; margin-top:2px;">No Budget Set</small>`;
        if (budgetTarget > 0) {
            const percent = Math.round((actualSpent / budgetTarget) * 100);
            budgetContextHtml = `<small style="display:block; margin-top:2px; color:${percent > 100 ? '#d9534f' : 'inherit'}">Budget: ₹${actualSpent}/₹${budgetTarget} (${percent}%)</small>`;
        }

        card.innerHTML = `
            <div style="flex:1;">
                <strong>${catName}</strong>
                ${budgetContextHtml}
            </div>
            <div style="display:flex; gap:8px;">
                <button class="actionBtn editBudgetBtn" data-cat="${catName}" title="Set Target Budget" style="background:transparent; border:none; cursor:pointer;"><i class="fa-solid fa-sliders" style="color:#4285F4"></i></button>
                <button class="actionBtn removeCatBtn" data-cat="${catName}" title="Delete Category" style="background:transparent; border:none; cursor:pointer;"><i class="fa-solid fa-trash-can" style="color:#d9534f"></i></button>
            </div>
        `;
        DOM.categoryList.appendChild(card);
    });

    document.querySelectorAll('.editBudgetBtn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const cat = e.currentTarget.getAttribute('data-cat');
            openModal({
                icon: '<i class="fa-solid fa-money-bill-trend-up" style="color:#4285F4"></i>',
                title: `Budget Setup: ${cat}`,
                desc: `Adjust dynamic spending limits for this node:`,
                type: 'setBudget',
                onConfirm: () => {
                    const budgetValue = parseFloat(DOM.modalInputBudget.value);
                    if (!isNaN(budgetValue) && budgetValue >= 0) {
                        state.categories[cat] = budgetValue;
                        saveStateToStorage();
                        updateApplicationUI();
                        closeModal();
                    }
                }
            });
        });
    });

    document.querySelectorAll('.removeCatBtn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const cat = e.currentTarget.getAttribute('data-cat');
            openModal({
                icon: '<i class="fa-solid fa-triangle-exclamation" style="color:#d9534f"></i>',
                title: 'Delete Category?',
                desc: `Are you sure you want to drop standard configuration rules for "${cat}"?`,
                type: 'standard',
                onConfirm: () => {
                    delete state.categories[cat];
                    saveStateToStorage();
                    updateApplicationUI();
                    closeModal();
                }
            });
        });
    });
}

// ==========================================
// 6. LEDGER RENDERING ENGINE & FILTER RIBBON
// ==========================================
function getFilteredTransactions() {
    const searchTerm = DOM.searchInput.value.toLowerCase().trim();
    const catFilter = DOM.filterCategory.value;
    const startRange = DOM.startDateInput.value ? new Date(DOM.startDateInput.value) : null;
    const endRange = DOM.endDateInput.value ? new Date(DOM.endDateInput.value) : null;

    return state.transactions.filter(t => {
        const txDate = new Date(t.date);
        
        const matchSearch = t.title.toLowerCase().includes(searchTerm) || t.category.toLowerCase().includes(searchTerm);
        const matchCat = (catFilter === 'all') || (t.category === catFilter);
        
        let matchDate = true;
        if (startRange) { txDate.setHours(0,0,0,0); startRange.setHours(0,0,0,0); matchDate = matchDate && (txDate >= startRange); }
        if (endRange) { txDate.setHours(0,0,0,0); endRange.setHours(0,0,0,0); matchDate = matchDate && (txDate <= endRange); }

        return matchSearch && matchCat && matchDate;
    });
}

function renderLedgerTransactions() {
    DOM.transactionList.innerHTML = '';
    const itemsToView = getFilteredTransactions();

    if (itemsToView.length === 0) {
        DOM.transactionList.innerHTML = `<li style="padding:20px; text-align:center; opacity:0.5; list-style:none;">No records match your active query.</li>`;
        return;
    }

    itemsToView.sort((a,b) => new Date(b.date) - new Date(a.date));

    itemsToView.forEach(t => {
        const li = document.createElement('li');
        li.className = 'transaction';
        li.style.display = 'flex';
        li.style.justifyContent = 'between';
        li.style.alignItems = 'center';
        li.style.padding = '12px';
        li.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
        
        const isExpense = t.type === 'expense';
        const symbol = isExpense ? '-' : '+';
        const colorClass = isExpense ? 'expenseText' : 'incomeText';
        const statusBadgeClass = t.status === 'paid' ? 'status-paid' : 'status-pending';
        const statusText = t.status === 'paid' ? 'Settled' : 'Pending';
        const repeatIcon = t.isRecurring ? '<i class="fa-solid fa-arrows-rotate" style="font-size:10px; margin-left:4px; opacity:0.7;" title="Automation Enabled"></i>' : '';

        li.innerHTML = `
            <div style="flex:1;">
                <strong>${t.title}</strong> ${repeatIcon}
                <p style="margin:2px 0 0 0; font-size:0.8rem; opacity:0.6;">${t.category} • ${t.date}</p>
            </div>
            <div style="text-align:right; margin-right:16px;">
                <span class="amount ${colorClass}" style="font-weight:600; display:block;">${symbol}₹${parseFloat(t.amount).toLocaleString('en-IN')}</span>
                <span class="status-badge ${statusBadgeClass}" data-id="${t.id}" style="cursor:pointer; font-size:0.75rem; padding:2px 6px; border-radius:4px;">${statusText}</span>
            </div>
            <div>
                <button class="actionBtn deleteTxBtn" data-id="${t.id}" style="background:transparent; border:none; cursor:pointer;"><i class="fa-solid fa-circle-xmark" style="color:#d9534f; font-size:1.1rem;"></i></button>
            </div>
        `;
        DOM.transactionList.appendChild(li);
    });

    document.querySelectorAll('.status-badge').forEach(badge => {
        badge.addEventListener('click', (e) => {
            const txId = e.currentTarget.getAttribute('data-id');
            const targetTx = state.transactions.find(t => t.id === txId);
            if (targetTx) {
                targetTx.status = targetTx.status === 'paid' ? 'pending' : 'paid';
                saveStateToStorage();
                updateApplicationUI();
            }
        });
    });

    document.querySelectorAll('.deleteTxBtn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const txId = e.currentTarget.getAttribute('data-id');
            state.transactions = state.transactions.filter(t => t.id !== txId);
            saveStateToStorage();
            updateApplicationUI();
        });
    });
}

// ==========================================
// 7. CHART.JS GRAPHICAL ENGINE CONTROLLER
// ==========================================
function renderAnalyticsGraphs() {
    const canvasElement = document.getElementById('analyticsChart');
    if (!canvasElement) return;
    
    const ctx = canvasElement.getContext('2d');
    
    const analyticsMap = {};
    state.transactions.forEach(t => {
        if (t.type === 'expense' && t.status === 'paid') {
            analyticsMap[t.category] = (analyticsMap[t.category] || 0) + parseFloat(t.amount);
        }
    });

    const labels = Object.keys(analyticsMap);
    const dataValues = Object.values(analyticsMap);

    if (analyticsChart) {
        analyticsChart.destroy();
    }

    analyticsChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels.length > 0 ? labels : ['No Expenses Logs Found'],
            datasets: [{
                data: dataValues.length > 0 ? dataValues : [1],
                backgroundColor: labels.length > 0 ? [
                    '#4285F4', '#DB4437', '#F4B400', '#0F9D58', '#AB47BC', '#00ACC1', '#FF7043'
                ] : ['#444444'],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: state.theme === 'dark' ? '#e0e0e0' : '#333'
                    }
                }
            }
        }
    });
}

// ==========================================
// 8. GLOBAL ACTION HANDLERS & REGISTRATION
// ==========================================
DOM.addTransactionBtn.addEventListener('click', () => {
    const title = DOM.titleInput.value.trim();
    const amount = parseFloat(DOM.amountInput.value);
    const type = DOM.typeSelect.value;
    const category = DOM.categorySelect.value;
    const status = DOM.statusSelect.value;
    const isRecurring = DOM.isRecurringCheckbox.checked;

    if (!title || isNaN(amount) || amount <= 0 || !category) {
        alert("Please configure a valid title, valid amount, and valid category.");
        return;
    }

    const today = new Date();
    const currentMonthYear = `${today.getMonth()}-${today.getFullYear()}`;

    const newTx = {
        id: 'tx_' + Date.now() + Math.random().toString(36).substr(2, 4),
        title,
        amount,
        type,
        category,
        status,
        date: today.toISOString().split('T')[0],
        isRecurring,
        lastGeneratedMonthYear: isRecurring ? currentMonthYear : null
    };

    state.transactions.push(newTx);
    saveStateToStorage();
    updateApplicationUI();

    DOM.titleInput.value = '';
    DOM.amountInput.value = '';
    DOM.isRecurringCheckbox.checked = false;
});

DOM.addCategoryBtn.addEventListener('click', () => {
    const rawCatName = DOM.newCategoryInput.value.trim();
    if (!rawCatName) return;

    if (state.categories[rawCatName]) {
        alert("This category configuration rule already exists.");
        return;
    }

    state.categories[rawCatName] = 0; 
    DOM.newCategoryInput.value = '';
    saveStateToStorage();
    updateApplicationUI();
});

[DOM.searchInput, DOM.filterCategory].forEach(elem => {
    elem.addEventListener('input', () => {
        renderLedgerTransactions();
    });
});

DOM.exportBtn.addEventListener('click', () => {
    const collection = getFilteredTransactions();
    if (collection.length === 0) {
        alert("No transactional data records found to export.");
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,ID,Date,Title,Type,Category,Amount,Status,Recurring\n";
    collection.forEach(t => {
        csvContent += `"${t.id}","${t.date}","${t.title.replace(/"/g, '""')}","${t.type}","${t.category}",${t.amount},"${t.status}","${t.isRecurring}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", encodedUri);
    downloadAnchorNode.setAttribute("download", `Ledger_Report_${Date.now()}.csv`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
});

DOM.purgeViewBtn.addEventListener('click', () => {
    const targetedViewSubsets = getFilteredTransactions();
    if (targetedViewSubsets.length === 0) return;

    openModal({
        icon: '<i class="fa-solid fa-dumpster-fire" style="color:#d9534f"></i>',
        title: 'Purge Filtered Rows?',
        desc: `Warning: This configuration routine will instantly delete all ${targetedViewSubsets.length} matching data records currently visible inside the live filter viewport.`,
        type: 'standard',
        onConfirm: () => {
            const targetIds = new Set(targetedViewSubsets.map(t => t.id));
            state.transactions = state.transactions.filter(t => !targetIds.has(t.id));
            saveStateToStorage();
            updateApplicationUI();
            closeModal();
        }
    });
});

DOM.deleteAccountBtn.addEventListener('click', () => {
    openModal({
        icon: '<i class="fa-solid fa-skull-crossbones" style="color:#d9534f"></i>',
        title: 'Complete System Destruction',
        desc: 'This will completely drop all client local states bound to this account identity mapping from this device configuration profile.',
        type: 'deleteAccount',
        onConfirm: () => {
            const validationPhrase = DOM.modalInputConfirm.value.trim();
            if (validationPhrase === 'DELETE') {
                localStorage.removeItem(`finance_tracker_user_${state.user}`);
                state.transactions = [];
                state.categories = { ...DEFAULT_CATEGORIES };
                closeModal();
                auth.signOut();
            } else {
                alert("Incorrect validation confirmation value string.");
            }
        }
    });
});

DOM.themeSelect.addEventListener('change', (e) => {
    state.theme = e.target.value;
    saveStateToStorage();
    updateApplicationUI();
});

DOM.modalCancelBtn.addEventListener('click', closeModal);
DOM.modalConfirmBtn.addEventListener('click', () => {
    if (typeof currentModalAction === 'function') {
        currentModalAction();
    }
});

// ==========================================
// 9. HIGH-COMPATIBILITY AUTH ENGINE PIPELINE (MOBILE HARDENED)
// ==========================================

// Configure local persistence matrix immediately during script boot sequence.
// Moving this out of the click event preserves native "user gesture" verification.
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .catch((error) => console.error("Persistence declaration exception:", error));

DOM.googleBtn.addEventListener('click', () => {
    // Force clean account assessment configuration to dump locked loops
    googleProvider.setCustomParameters({ prompt: 'select_account' });
    
    // Direct popup initiation sequence maintains compliance with mobile browser gesture tokens
    auth.signInWithPopup(googleProvider)
        .then((result) => {
            if (result && result.user) {
                console.log("Popup login resolved successfully:", result.user.email);
                handleUserSessionRouting(result.user);
            }
        })
        .catch((error) => {
            console.error("Firebase Auth Exception Error Context:", error);
            
            // Invoke the redirect module exclusively if the browser blocks popups completely
            if (error.code === 'auth/popup-blocked' || error.code === 'auth/cancelled-popup-request') {
                console.log("Popup intercepted by engine layout. Redirecting window tree...");
                return auth.signInWithRedirect(googleProvider);
            } else {
                alert(`Authentication Error: ${error.message}`);
            }
        });
});

DOM.logoutBtn.addEventListener('click', () => {
    auth.signOut()
        .then(() => {
            window.location.reload(); 
        })
        .catch((error) => alert(`Sign Out Failed: ${error.message}`));
});

// Standalone UI switchboard context router
function handleUserSessionRouting(user) {
    if (user && user.email) {
        const userIdentityKey = user.email.trim().toLowerCase().replace(/[^a-z0-9@.]/g, '_');
        loadStateFromStorage(userIdentityKey);
        
        // Immediate conditional canvas manipulation
        if (DOM.authScreen) DOM.authScreen.style.display = 'none';
        if (DOM.app) DOM.app.style.display = 'block';
        
        updateApplicationUI();
    }
}

// Safely trap incoming tokens returning from a deep fallback redirect chain
auth.getRedirectResult()
    .then((result) => {
        if (result && result.user) {
            handleUserSessionRouting(result.user);
        }
    })
    .catch((error) => {
        console.error("Error processing authentication redirect loop callback:", error);
    });

// Global state observer loop handles ambient page mounts smoothly
auth.onAuthStateChanged((user) => {
    if (user) {
        handleUserSessionRouting(user);
    } else {
        state.user = null;
        state.transactions = [];
        state.categories = { ...DEFAULT_CATEGORIES };
        
        if (DOM.app) DOM.app.style.display = 'none';
        if (DOM.authScreen) DOM.authScreen.style.display = 'flex';
        
        if (analyticsChart) {
            analyticsChart.destroy();
            analyticsChart = null;
        }
    }
});

// Run a proactive micro-check to process early token state resolution
if (auth.currentUser) {
    handleUserSessionRouting(auth.currentUser);
}
