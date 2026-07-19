// ==========================================
// 1. APPLICATION DATA STATE & INITIALIZATION
// ==========================================
let state = {
    user: null,
    transactions: [],
    categories: {
        "Food": 5000,
        "Utilities": 3000,
        "Entertainment": 2000,
        "Salary": 0
    },
    theme: "light"
};

// Default structures for new users
const DEFAULT_CATEGORIES = { "Food": 5000, "Utilities": 3000, "Entertainment": 2000, "Salary": 0 };

// Chart.js Context Pointer
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
    localStorage.setItem('finance_tracker_active_session', state.user);
}

function loadStateFromStorage(userId) {
    state.user = userId;
    const savedData = localStorage.getItem(`finance_tracker_user_${userId}`);
    if (savedData) {
        const parsed = JSON.parse(savedData);
        state.transactions = parsed.transactions || [];
        state.categories = parsed.categories || DEFAULT_CATEGORIES;
        state.theme = parsed.theme || "light";
    } else {
        state.transactions = [];
        state.categories = { ...DEFAULT_CATEGORIES };
        state.theme = "light";
    }
    
    // Look ahead to process recurring automated balances due for the current calendar cycle
    checkAndProcessRecurringTransactions();
}

// ==========================================
// 4. DIALOGUE MODAL ENGINE SYSTEM (PROMPT ROUTING)
// ==========================================
function openModal({ icon, title, desc, type, onConfirm }) {
    DOM.modalOverlay.style.display = 'flex'; // Fixed double .style typo
    DOM.modalConfirmBtn.style.display = 'inline-block'; // Reset display state for safety
    DOM.modalIcon.innerHTML = icon;
    DOM.modalTitle.textContent = title;
    DOM.modalDesc.textContent = desc;
    
    // Reset inputs
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
        DOM.modalInputBudget.placeholder = 'Monthly Budget Target Amount (₹)';
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

    // Filter out historical recurring items to test if they need generation this month
    state.transactions.forEach(t => {
        if (t.isRecurring && t.lastGeneratedMonthYear !== currentMonthYear) {
            const lastGenDate = new Date(t.date);
            // Check if we advanced into a new month boundary
            if (today.getMonth() !== lastGenDate.getMonth() || today.getFullYear() !== lastGenDate.getFullYear()) {
                
                // Clone instance item over to this month workspace records
                const recurrenceClone = {
                    id: 'tx_' + Date.now() + Math.random().toString(36).substr(2, 4),
                    title: `[Auto-Repeat] ${t.title}`,
                    amount: t.amount,
                    type: t.type,
                    category: t.category,
                    status: t.status, // Maintains standard paid/pending state flags
                    date: today.toISOString().split('T')[0],
                    isRecurring: true,
                    lastGeneratedMonthYear: currentMonthYear
                };
                
                // Seal historical parent object generation timestamps
                t.lastGeneratedMonthYear = currentMonthYear;
                state.transactions.push(recurrenceClone);
                stateMutated = true;
            }
        }
    });

    if (stateMutated) saveStateToStorage();
}

function updateApplicationUI() {
    // 1. Theme Configuration Initialization
    document.documentElement.setAttribute('data-theme', state.theme);
    DOM.themeSelect.value = state.theme;

    // 2. Compute Master Wallet Metrics Data
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
    
    // Render Card Targets
    DOM.balance.textContent = `₹${absoluteWalletBalance.toLocaleString('en-IN')}`;
    DOM.income.textContent = `₹${totalSettledIncome.toLocaleString('en-IN')}`;
    DOM.pendingIncome.textContent = `₹${totalPendingIncome.toLocaleString('en-IN')}`;
    DOM.expense.textContent = `₹${totalSettledExpense.toLocaleString('en-IN')}`;
    DOM.pendingExpense.textContent = `₹${totalPendingExpense.toLocaleString('en-IN')}`;

    // Compute Savings Rate Metric Percentage Ratio
    let savingsRatePercentage = 0;
    if (totalSettledIncome > 0) {
        savingsRatePercentage = Math.round(((totalSettledIncome - totalSettledExpense) / totalSettledIncome) * 100);
    }
    DOM.savingRate.textContent = `${savingsRatePercentage < 0 ? 0 : savingsRatePercentage}%`;

    // Health Assessment Logic
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

    // 3. Render Ingestion Choice Dropdowns and Settings Panes
    populateCategorySelectors();
    renderCategorySettingsPanel(totalSettledExpense);

    // 4. Refresh Ledger Items View lists
    renderLedgerTransactions();

    // 5. Fire Chart Canvas Graph Re-draw Engine
    renderAnalyticsGraphs();
}

function populateCategorySelectors() {
    const currentFilterVal = DOM.filterCategory.value;
    
    // Purge elements
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
    
    // Compute operational totals clustered into matching category groupings
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
        
        let budgetContextHtml = `<small>No Budget Set</small>`;
        if (budgetTarget > 0) {
            const percent = Math.round((actualSpent / budgetTarget) * 100);
            budgetContextHtml = `<small style="color:${percent > 100 ? 'var(--danger-color)' : 'inherit'}">Budget: ₹${actualSpent}/₹${budgetTarget} (${percent}%)</small>`;
        }

        card.innerHTML = `
            <div>
                <strong>${catName}</strong>
                ${budgetContextHtml}
            </div>
            <div>
                <button class="actionBtn editBudgetBtn" data-cat="${catName}" title="Set Monthly Budget"><i class="fa-solid fa-sliders" style="color:var(--primary-color)"></i></button>
                <button class="actionBtn removeCatBtn" data-cat="${catName}" title="Delete Category"><i class="fa-solid fa-trash-can" style="color:var(--danger-color)"></i></button>
            </div>
        `;
        DOM.categoryList.appendChild(card);
    });

    // Wire up panel action lifecycle handles dynamically
    document.querySelectorAll('.editBudgetBtn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const cat = e.currentTarget.getAttribute('data-cat');
            openModal({
                icon: '<i class="fa-solid fa-money-bill-trend-up" style="color:var(--warning-color)"></i>',
                title: `Budget Setup: ${cat}`,
                desc: `Establish or adjust a safe operational baseline spending threshold context parameters limit target values for this expense line item:`,
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
                icon: '<i class="fa-solid fa-triangle-exclamation" style="color:var(--danger-color)"></i>',
                title: 'Delete Category?',
                desc: `Are you sure you want to delete "${cat}"? Historical items bound within this scope classification logic schema will survive but will require reassignment.`,
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
        DOM.transactionList.innerHTML = `<li style="padding:20px; text-align:center; opacity:0.5;">No historical ledger logs match current viewport window bounds.</li>`;
        return;
    }

    // Sort items newest first
    itemsToView.sort((a,b) => new Date(b.date) - new Date(a.date));

    itemsToView.forEach(t => {
        const li = document.createElement('li');
        li.className = 'transaction';
        
        const isExpense = t.type === 'expense';
        const symbol = isExpense ? '-' : '+';
        const colorClass = isExpense ? 'expenseText' : 'incomeText';
        const statusBadgeClass = t.status === 'paid' ? 'status-paid' : 'status-pending';
        const statusText = t.status === 'paid' ? 'Settled' : 'Unpaid / Pending';
        const repeatIcon = t.isRecurring ? '<i class="fa-solid fa-arrows-rotate" style="font-size:10px; margin-left:4px; opacity:0.7;" title="Monthly Automation Active"></i>' : '';

        li.innerHTML = `
            <div class="leftSide">
                <strong>${t.title}</strong> ${repeatIcon}
                <p>${t.category} • ${t.date}</p>
            </div>
            <div class="rightSide">
                <span class="amount ${colorClass}">${symbol}₹${parseFloat(t.amount).toLocaleString('en-IN')}</span>
                <span class="status-badge ${statusBadgeClass}" data-id="${t.id}" title="Toggle Settlement State">${statusText}</span>
            </div>
            <div>
                <button class="actionBtn deleteTxBtn" data-id="${t.id}"><i class="fa-solid fa-circle-xmark" style="color:var(--danger-color)"></i></button>
            </div>
        `;
        DOM.transactionList.appendChild(li);
    });

    // Toggle Settle Status Implementation Flow
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

    // Row Element Purge Binding Actions
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
    const ctx = document.getElementById('analyticsChart').getContext('2d');
    
    // Process cluster map aggregates
    const analyticsMap = {};
    state.transactions.forEach(t => {
        if (t.type === 'expense' && t.status === 'paid') {
            analyticsMap[t.category] = (analyticsMap[t.category] || 0) + parseFloat(t.amount);
        }
    });

    const labels = Object.keys(analyticsMap);
    const dataValues = Object.values(analyticsMap);

    // If historical framework references exist, destroy them cleanly to prevent layout leaks
    if (analyticsChart) {
        analyticsChart.destroy();
    }

    // Initialize New Chart Canvas Matrix instance options references
    analyticsChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels.length > 0 ? labels : ['No Expense Logs Found'],
            datasets: [{
                data: dataValues.length > 0 ? dataValues : [1],
                backgroundColor: labels.length > 0 ? [
                    '#4285F4', '#DB4437', '#F4B400', '#0F9D58', '#AB47BC', '#00ACC1', '#FF7043'
                ] : ['#e0e0e0'],
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

// Ingestion Form Submit Handler Event Listener Actions Flow Controls
DOM.addTransactionBtn.addEventListener('click', () => {
    const title = DOM.titleInput.value.trim();
    const amount = parseFloat(DOM.amountInput.value);
    const type = DOM.typeSelect.value;
    const category = DOM.categorySelect.value;
    const status = DOM.statusSelect.value;
    const isRecurring = DOM.isRecurringCheckbox.checked;

    if (!title || isNaN(amount) || amount <= 0 || !category) {
        alert("Please configure proper transactional metadata titles and baseline dynamic currency variables elements balances parameters values.");
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

    // Clear operational inputs fields
    DOM.titleInput.value = '';
    DOM.amountInput.value = '';
    DOM.isRecurringCheckbox.checked = false;
});

// Category Expansion Builder Execution Handling Block Actions Framework Options
DOM.addCategoryBtn.addEventListener('click', () => {
    const rawCatName = DOM.newCategoryInput.value.trim();
    if (!rawCatName) return;

    if (state.categories[rawCatName]) {
        alert("Target structural classification configuration scheme mapping indices records duplicate error.");
        return;
    }

    state.categories[rawCatName] = 0; 
    DOM.newCategoryInput.value = '';
    saveStateToStorage();
    updateApplicationUI();
});

// Realtime Viewport Filter Query String Keydown Context Events Updates Pipeline Routing Engine
[DOM.searchInput, DOM.filterCategory, DOM.startDateInput, DOM.endDateInput].forEach(elem => {
    elem.addEventListener('input', () => {
        renderLedgerTransactions();
    });
});

// CSV Data Export Matrix Pipeline Core Controller Strategy Module Output Block
DOM.exportBtn.addEventListener('click', () => {
    const collection = getFilteredTransactions();
    if (collection.length === 0) {
        alert("No target matching records isolated within historical ledger state parameters framework matrix nodes.");
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,ID,Date,Title,Type,Category,Amount,Status,Recurring\n";
    collection.forEach(t => {
        csvContent += `"${t.id}","${t.date}","${t.title.replace(/"/g, '""')}","${t.type}","${t.category}",${t.amount},"${t.status}","${t.isRecurring}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", encodedUri);
    downloadAnchorNode.setAttribute("download", `Ledger_Report_Workspace_Snapshot_${Date.now()}.csv`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
});

// Purge Active Target Matrix Viewport Ledger Row Entries Context Flow Routine
DOM.purgeViewBtn.addEventListener('click', () => {
    const targetedViewSubsets = getFilteredTransactions();
    if (targetedViewSubsets.length === 0) return;

    openModal({
        icon: '<i class="fa-solid fa-dumpster-fire" style="color:var(--danger-color)"></i>',
        title: 'Purge Filtered Rows?',
        desc: `Warning: This configuration routine will instantly expunge all ${targetedViewSubsets.length} matching data records currently visible inside the live isolated viewport scope bounds schema filter criteria.`,
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

// Account Workspace Deletion Flow Routines Operations Setup Lifecycle Hook
DOM.deleteAccountBtn.addEventListener('click', () => {
    openModal({
        icon: '<i class="fa-solid fa-skull-crossbones" style="color:var(--danger-color)"></i>',
        title: 'Complete System Destruction',
        desc: 'This is an absolute master reset routine option event execution logic sequence. It will fully wipe clean all client workspace nodes records structural maps data states context from this sandbox engine environment.',
        type: 'deleteAccount',
        onConfirm: () => {
            const validationPhrase = DOM.modalInputConfirm.value.trim();
            if (validationPhrase === 'DELETE') {
                localStorage.removeItem(`finance_tracker_user_${state.user}`);
                localStorage.removeItem('finance_tracker_active_session');
                state.user = null;
                state.transactions = [];
                state.categories = { ...DEFAULT_CATEGORIES };
                closeModal();
                checkAuthSessionState();
            } else {
                alert("Incorrect identity assertion validation confirmation verification strings parameters.");
            }
        }
    });
});

// Interactive Theme Picker Switch Options Controls Change Engine Logic Elements Routing
DOM.themeSelect.addEventListener('change', (e) => {
    state.theme = e.target.value;
    saveStateToStorage();
    updateApplicationUI();
});

// Dialogue Modal Interception Buttons Execution Action Listeners Wiring Maps Framework
DOM.modalCancelBtn.addEventListener('click', closeModal);
DOM.modalConfirmBtn.addEventListener('click', () => {
    if (typeof currentModalAction === 'function') {
        currentModalAction();
    }
});

// ==========================================
// 9. IDENTITY CONTROLLER & GOOGLE SIGN-IN INTERACTIVE MOCK
// ==========================================
DOM.googleBtn.addEventListener('click', () => {
    // Open the modal base canvas cleanly
    openModal({
        icon: '<i class="fa-brands fa-google" style="color:#4285F4; font-size: 2rem;"></i>',
        title: 'Sign in with Google',
        desc: 'Select a Google account to continue to your Personal Finance Workspace Sandbox:',
        type: 'standard',
        onConfirm: () => {
            // Callback placeholder: handled contextually by individual profile buttons
        }
    });

    // Populate profile selector markup structure dynamically inside description area
    DOM.modalDesc.innerHTML = `
        <p style="margin-bottom: 15px; font-size: 0.9rem; opacity: 0.8;">Choose a Gmail workspace account profile to isolate your transaction records database:</p>
        <div class="google-account-picker" style="display: flex; flex-direction: column; gap: 8px; width: 100%;">
            <button class="g-account-chip" data-email="alpha_user@gmail.com" style="display: flex; align-items: center; justify-content: flex-start; gap: 12px; padding: 10px 14px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; text-align: left; font-family: inherit; width: 100%;">
                <div style="background: #4285F4; color: white; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.85rem;">A</div>
                <div>
                    <div style="font-weight: 600; font-size: 0.85rem; color: var(--text-color);">Alpha Tester</div>
                    <div style="font-size: 0.75rem; opacity: 0.6;">alpha_user@gmail.com</div>
                </div>
            </button>
            <button class="g-account-chip" data-email="developer_sandbox@gmail.com" style="display: flex; align-items: center; justify-content: flex-start; gap: 12px; padding: 10px 14px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; text-align: left; font-family: inherit; width: 100%;">
                <div style="background: #0F9D58; color: white; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.85rem;">D</div>
                <div>
                    <div style="font-weight: 600; font-size: 0.85rem; color: var(--text-color);">Dev Workspace</div>
                    <div style="font-size: 0.75rem; opacity: 0.6;">developer_sandbox@gmail.com</div>
                </div>
            </button>
            <button class="g-account-chip" data-email="beta_tester@gmail.com" style="display: flex; align-items: center; justify-content: flex-start; gap: 12px; padding: 10px 14px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; text-align: left; font-family: inherit; width: 100%;">
                <div style="background: #DB4437; color: white; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.85rem;">B</div>
                <div>
                    <div style="font-weight: 600; font-size: 0.85rem; color: var(--text-color);">Beta Profile</div>
                    <div style="font-size: 0.75rem; opacity: 0.6;">beta_tester@gmail.com</div>
                </div>
            </button>
            <div style="border-top: 1px solid var(--border-color); margin-top: 4px; padding-top: 8px;">
                <button id="addCustomGmailBtn" style="background: none; border: none; color: #4285F4; font-size: 0.8rem; cursor: pointer; padding: 4px; font-weight: 600; font-family: inherit;">+ Use another account</button>
            </div>
        </div>
    `;

    // Hide default footer action confirmation button as the chips handle validation lifecycle actions
    DOM.modalConfirmBtn.style.display = 'none';

    // Apply interactive listener triggers to internal template chip components
    document.querySelectorAll('.g-account-chip').forEach(chip => {
        chip.addEventListener('click', (e) => {
            const chosenEmail = e.currentTarget.getAttribute('data-email');
            executeMockGoogleAuth(chosenEmail);
        });
    });

    // Custom secondary text option flow prompt binding strategy
    document.getElementById('addCustomGmailBtn').addEventListener('click', () => {
        const customEmail = prompt("Enter custom Gmail address identifier:", "yourname@gmail.com");
        if (customEmail && customEmail.trim() !== "") {
            executeMockGoogleAuth(customEmail.trim().toLowerCase());
        }
    });
});

function executeMockGoogleAuth(emailId) {
    loadStateFromStorage(emailId);
    saveStateToStorage();
    DOM.modalConfirmBtn.style.display = 'inline-block'; // Restore visibility rules defaults
    closeModal();
    checkAuthSessionState();
}

DOM.logoutBtn.addEventListener('click', () => {
    state.user = null;
    localStorage.removeItem('finance_tracker_active_session');
    checkAuthSessionState();
});

function checkAuthSessionState() {
    const activeSessionId = localStorage.getItem('finance_tracker_active_session');
    if (activeSessionId && activeSessionId !== 'null') {
        loadStateFromStorage(activeSessionId);
        DOM.authScreen.style.display = 'none';
        DOM.app.style.display = 'block';
        updateApplicationUI();
    } else {
        DOM.app.style.display = 'none';
        DOM.authScreen.style.display = 'flex';
        if (analyticsChart) {
            analyticsChart.destroy();
            analyticsChart = null;
        }
    }
}

// Fire Session Assessment Routine Engine Instantly on Entry Bounds Loading Lifecycle Events Hook
document.addEventListener('DOMContentLoaded', checkAuthSessionState);
