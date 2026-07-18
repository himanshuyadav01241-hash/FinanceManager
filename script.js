// script.js
import { 
    monitorAuthState, logoutUser, deleteCurrentUserAccount,
    saveUserSettings, getUserSettings,
    syncAddTransaction, syncUpdateTransaction, syncDeleteTransaction,
    loginWithGoogle,
    syncTransactionsRealtime 
} from "./firebase.js";

const $ = id => document.getElementById(id);

// Runtime Memory State
let userUID = null;
let transactions = [];
let categories = ["Food", "Transport", "Shopping", "Bills", "Entertainment", "General"];
let categoryBudgets = {}; // Structural storage for tracking limits: { "CategoryName": 5000 }
let unsubscribeTxListener = null; 
let financialChart = null; // Chart instance holder

// UI Bindings
let title, amount, type, category, status, addBtn, list, search, filterCategory;
let balance, income, expense, saving, healthBadge, pendingIncome, pendingExpense;
let theme, newCategory, addCategory, categoryList;
let authScreen, appScreen, googleBtn, logoutBtn, deleteAccountBtn, exportBtn, purgeCategoryBtn;

// New Feature UI Bindings
let startDateInput, endDateInput, isRecurringCheckbox, modalBudgetInput;

// Custom Modal Engine Bindings
let modalOverlay, modalTitle, modalDescription, modalConfirmBtn, modalCancelBtn, modalInput, modalIcon, modalInputSec;

document.addEventListener("DOMContentLoaded", () => {
    // Basic elements
    title = $("title");
    amount = $("amount");
    type = $("type");
    category = $("category");
    status = $("status");
    addBtn = $("addBtn");
    list = $("transactionList");
    search = $("search");
    filterCategory = $("filterCategory");
    balance = $("balance");
    income = $("income");
    expense = $("expense");
    saving = $("saving");
    healthBadge = $("healthBadge");
    pendingIncome = $("pendingIncome");
    pendingExpense = $("pendingExpense");
    theme = $("theme");
    newCategory = $("newCategory");
    addCategory = $("addCategory");
    categoryList = $("categoryList");
    authScreen = $("authScreen");
    appScreen = $("app");
    googleBtn = $("googleBtn"); 
    logoutBtn = $("logoutBtn");
    deleteAccountBtn = $("deleteAccountBtn"); 
    exportBtn = $("exportBtn");
    purgeCategoryBtn = $("purgeCategoryBtn");

    // New Feature Bindings (Ensure these IDs exist in your HTML layout)
    startDateInput = $("startDate") || document.createElement("input");
    endDateInput = $("endDate") || document.createElement("input");
    isRecurringCheckbox = $("isRecurring") || document.createElement("input");

    // Modal elements
    modalOverlay = $("customModalOverlay");
    modalTitle = $("modalTitle");
    modalDescription = $("modalDescription");
    modalConfirmBtn = $("modalConfirmBtn");
    modalCancelBtn = $("modalCancelBtn");
    modalInput = $("modalConfirmationInput");
    modalInputSec = $("modalSecondaryInput");
    modalIcon = $("modalIconContainer");
    modalBudgetInput = $("modalBudgetInput") || document.createElement("input");

    /* ==========================================
        Authentication Lifecycle Observer 
    ========================================== */
    monitorAuthState(async (user) => {
        if (user) {
            userUID = user.uid;
            authScreen.style.display = "none";
            appScreen.style.display = "block";
            await initializeUserDashboard();
        } else {
            if (unsubscribeTxListener) {
                unsubscribeTxListener();
                unsubscribeTxListener = null;
            }
            userUID = null;
            appScreen.style.display = "none";
            authScreen.style.display = "flex";
            clearFormStateFields();
        }
    });

    if (googleBtn) {
        googleBtn.onclick = async () => {
            try { await loginWithGoogle(); } catch (e) { showCustomAlert("Error", "Google Auth Error: " + e.message, true); }
        };
    }

    logoutBtn.onclick = () => logoutUser();

    if (deleteAccountBtn) {
        deleteAccountBtn.onclick = () => {
            if (!userUID) return;
            
            showCustomConfirm(
                "Critical Purge Account",
                "Are you entirely sure you want to delete your profile? This permanently clears your custom categories and credentials.",
                true,
                "CONFIRM",
                async () => {
                    try {
                        await deleteCurrentUserAccount(userUID);
                        showCustomAlert("Success", "Account removed from the cloud framework.", false);
                    } catch (e) {
                        if (e.code === "auth/requires-recent-login") {
                            showCustomAlert("Security Barrier", "Please log out, log back in immediately, and try again.", true);
                        } else {
                            showCustomAlert("Error", e.message, true);
                        }
                    }
                }
            );
        };
    }

    /* --- INPUT EVENT HANDLERS --- */
    addBtn.addEventListener("click", addTransaction);
    search.addEventListener("input", render);
    filterCategory.addEventListener("change", render);
    startDateInput.addEventListener("change", render);
    endDateInput.addEventListener("change", render);
    if (exportBtn) exportBtn.addEventListener("click", downloadExcelSpreadsheet);
    if (purgeCategoryBtn) purgeCategoryBtn.addEventListener("click", purgeActiveCategoryTransactions);

    theme.onchange = async () => {
        if (!userUID) return;
        document.body.dataset.theme = theme.value;
        await saveUserSettings(userUID, { theme: theme.value });
    };

    addCategory.onclick = async () => {
        const value = newCategory.value.trim();
        if (value === "") return;
        if (categories.map(c => c.toLowerCase()).includes(value.toLowerCase())) {
            showCustomAlert("Validation Warning", "Ecosystem already contains this category.", true);
            return;
        }
        categories.push(value);
        newCategory.value = "";
        await saveConfigState();
        loadCategories();
    };

    // Close Modal Events
    modalCancelBtn.onclick = closeModal;
});

/* ==========================================
    CUSTOM DIALOG SYSTEM (MODAL ENGINE)
========================================== */
function showCustomAlert(titleText, descText, isNegative = false) {
    modalTitle.innerText = titleText;
    modalDescription.innerText = descText;
    modalIcon.innerHTML = isNegative ? '<i class="fa-solid fa-circle-xmark"></i>' : '<i class="fa-solid fa-circle-check"></i>';
    modalIcon.style.color = isNegative ? "#d9534f" : "#5cb85c";
    modalConfirmBtn.style.background = isNegative ? "#d9534f" : "#4285F4";
    modalConfirmBtn.innerText = "OK";
    modalInput.style.display = "none";
    modalInputSec.style.display = "none";
    modalBudgetInput.style.display = "none";
    modalCancelBtn.style.display = "none"; 
    
    modalOverlay.style.display = "flex";
    setTimeout(() => { modalOverlay.children[0].style.transform = "scale(1)"; }, 10);

    modalConfirmBtn.onclick = closeModal;
}

function showCustomConfirm(titleText, descText, requiresVerificationText = false, matchingText = "", onConfirmCallback = null) {
    modalTitle.innerText = titleText;
    modalDescription.innerText = descText;
    modalIcon.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';
    modalIcon.style.color = "#d9534f";
    modalConfirmBtn.style.background = "#d9534f";
    modalConfirmBtn.innerText = "Confirm";
    modalCancelBtn.style.display = "inline-block";
    modalInputSec.style.display = "none";
    modalBudgetInput.style.display = "none";

    if (requiresVerificationText) {
        modalInput.value = "";
        modalInput.placeholder = `Type "${matchingText}" to confirm`;
        modalInput.style.borderColor = "rgba(255,255,255,0.2)";
        modalInput.style.display = "block";
    } else {
        modalInput.style.display = "none";
    }

    modalOverlay.style.display = "flex";
    setTimeout(() => { modalOverlay.children[0].style.transform = "scale(1)"; }, 10);

    modalConfirmBtn.onclick = () => {
        if (requiresVerificationText && modalInput.value.trim() !== matchingText) {
            modalInput.style.borderColor = "#d9534f";
            return;
        }
        closeModal();
        if (onConfirmCallback) onConfirmCallback();
    };
}

function showCustomPrompt(titleText, descText, initialInputValue, placeholderText, onSaveCallback) {
    modalTitle.innerText = titleText;
    modalDescription.innerText = descText;
    modalIcon.innerHTML = '<i class="fa-solid fa-pen-to-square"></i>';
    modalIcon.style.color = "#4285F4";
    modalConfirmBtn.style.background = "#4285F4";
    modalConfirmBtn.innerText = "Save Changes";
    modalCancelBtn.style.display = "inline-block";
    modalInputSec.style.display = "none";
    modalBudgetInput.style.display = "none";
    
    modalInput.value = initialInputValue;
    modalInput.placeholder = placeholderText;
    modalInput.style.borderColor = "rgba(255,255,255,0.15)";
    modalInput.style.display = "block";

    modalOverlay.style.display = "flex";
    setTimeout(() => { modalOverlay.children[0].style.transform = "scale(1)"; }, 10);

    modalConfirmBtn.onclick = () => {
        const val = modalInput.value.trim();
        if (val === "") {
            modalInput.style.borderColor = "#d9534f";
            return;
        }
        closeModal();
        if (onSaveCallback) onSaveCallback(val);
    };
}

function showCustomCategorySettings(catName, currentBudget, onSaveCallback) {
    modalTitle.innerText = `Configure ${catName}`;
    modalDescription.innerText = "Modify designation name and baseline budget limits below:";
    modalIcon.innerHTML = '<i class="fa-solid fa-sliders"></i>';
    modalIcon.style.color = "#4285F4";
    modalConfirmBtn.style.background = "#4285F4";
    modalConfirmBtn.innerText = "Save Settings";
    modalCancelBtn.style.display = "inline-block";

    modalInput.value = catName;
    modalInput.placeholder = "Category Name";
    modalInput.style.display = "block";

    modalBudgetInput.value = currentBudget || "";
    modalBudgetInput.placeholder = "Monthly Budget Limit (₹)";
    modalBudgetInput.style.display = "block";
    
    modalInputSec.style.display = "none";

    modalOverlay.style.display = "flex";
    setTimeout(() => { modalOverlay.children[0].style.transform = "scale(1)"; }, 10);

    modalConfirmBtn.onclick = () => {
        const newName = modalInput.value.trim();
        const budgetVal = modalBudgetInput.value.trim() === "" ? 0 : Number(modalBudgetInput.value);

        if (newName === "" || isNaN(budgetVal) || budgetVal < 0) {
            modalInput.style.borderColor = newName === "" ? "#d9534f" : "rgba(255,255,255,0.15)";
            modalBudgetInput.style.borderColor = (isNaN(budgetVal) || budgetVal < 0) ? "#d9534f" : "rgba(255,255,255,0.15)";
            return;
        }
        closeModal();
        if (onSaveCallback) onSaveCallback(newName, budgetVal);
    };
}

function showCustomTransactionEditor(currentTitle, currentAmount, onSaveCallback) {
    modalTitle.innerText = "Edit Transaction Details";
    modalDescription.innerText = "Update entry details below:";
    modalIcon.innerHTML = '<i class="fa-solid fa-pen-to-square"></i>';
    modalIcon.style.color = "#4285F4";
    modalConfirmBtn.style.background = "#4285F4";
    modalConfirmBtn.innerText = "Update";
    modalCancelBtn.style.display = "inline-block";
    modalBudgetInput.style.display = "none";

    modalInput.value = currentTitle;
    modalInput.placeholder = "Transaction Name";
    modalInput.style.borderColor = "rgba(255,255,255,0.15)";
    modalInput.style.display = "block";

    modalInputSec.value = currentAmount;
    modalInputSec.placeholder = "Amount (₹)";
    modalInputSec.style.borderColor = "rgba(255,255,255,0.15)";
    modalInputSec.style.display = "block";

    modalOverlay.style.display = "flex";
    setTimeout(() => { modalOverlay.children[0].style.transform = "scale(1)"; }, 10);

    modalConfirmBtn.onclick = () => {
        const titleVal = modalInput.value.trim();
        const amountVal = Number(modalInputSec.value);

        if (titleVal === "" || isNaN(amountVal) || amountVal <= 0) {
            if (titleVal === "") modalInput.style.borderColor = "#d9534f";
            if (isNaN(amountVal) || amountVal <= 0) modalInputSec.style.borderColor = "#d9534f";
            return;
        }
        closeModal();
        if (onSaveCallback) onSaveCallback(titleVal, amountVal);
    };
}

function closeModal() {
    modalOverlay.children[0].style.transform = "scale(0.9)";
    setTimeout(() => { 
        modalOverlay.style.display = "none"; 
        modalBudgetInput.style.display = "none";
    }, 150);
}

/* --- SYSTEM SYNC DATA INTAKE PIPELINE --- */
async function initializeUserDashboard() {
    const cloudConfigs = await getUserSettings(userUID);
    if (cloudConfigs) {
        if (cloudConfigs.theme) {
            document.body.dataset.theme = cloudConfigs.theme;
            theme.value = cloudConfigs.theme;
        }
        if (cloudConfigs.categories && cloudConfigs.categories.length > 0) {
            categories = cloudConfigs.categories;
        }
        if (cloudConfigs.categoryBudgets) {
            categoryBudgets = cloudConfigs.categoryBudgets;
        }
    } else {
        await saveUserSettings(userUID, { theme: "dark", categories: categories, categoryBudgets: {} });
        document.body.dataset.theme = "dark";
        theme.value = "dark";
    }

    loadCategories();

    function startLiveStream() {
        if (unsubscribeTxListener) unsubscribeTxListener(); 
        unsubscribeTxListener = syncTransactionsRealtime(userUID, (updatedTransactionsList) => {
            transactions = processRecurringTransactions(updatedTransactionsList);
            render(); 
        });
    }
    startLiveStream();

    document.onvisibilitychange = () => {
        if (document.visibilityState === "visible" && userUID) startLiveStream();
    };
}

async function saveConfigState() {
    if (!userUID) return;
    await saveUserSettings(userUID, { categories: categories, categoryBudgets: categoryBudgets });
    render();
}

/* ==========================================
    FEATURE: RECURRING ENGINE LOGIC
========================================== */
function processRecurringTransactions(txList) {
    const todayStr = new Date().toLocaleDateString('en-IN');
    let dynamicUpdates = false;

    txList.forEach(async (tx) => {
        if (tx.isRecurring && tx.lastGeneratedDate !== todayStr) {
            const lastGen = tx.lastGeneratedDate ? parseDate(tx.lastGeneratedDate) : parseDate(tx.date);
            const today = new Date();
            
            // Generate entries if a calendar month milestone has rolled over
            if (today.getMonth() !== lastGen.getMonth() || today.getFullYear() !== lastGen.getFullYear()) {
                dynamicUpdates = true;
                const clonedTx = {
                    id: Date.now() + Math.floor(Math.random() * 1000),
                    title: `${tx.title} (Recurring Instance)`,
                    amount: tx.amount,
                    type: tx.type,
                    category: tx.category,
                    status: "pending",
                    date: todayStr
                };
                await syncAddTransaction(userUID, clonedTx);
                await syncUpdateTransaction(userUID, tx.docId, { lastGeneratedDate: todayStr });
            }
        }
    });

    return txList;
}

function parseDate(dateStr) {
    const parts = dateStr.split('/');
    return new Date(parts[2], parts[1] - 1, parts[0]);
}

/* ==========================================
    Category Configuration Control Engines 
========================================== */
function loadCategories() {
    const currentFilterValue = filterCategory ? filterCategory.value : "all";
    category.innerHTML = "";
    categoryList.innerHTML = "";
    filterCategory.innerHTML = '<option value="all">All Categories</option>';

    categories.forEach((cat, index) => {
        const option = document.createElement("option");
        option.textContent = cat; option.value = cat;
        category.appendChild(option);

        const filterOption = document.createElement("option");
        filterOption.textContent = cat; filterOption.value = cat;
        filterCategory.appendChild(filterOption);

        const currentLimit = categoryBudgets[cat] || 0;
        const budgetText = currentLimit > 0 ? ` Budget: ₹${currentLimit}` : " No Limit";

        const card = document.createElement("div");
        card.className = "categoryCard";
        card.innerHTML = `
            <span><strong>${cat}</strong><small>${budgetText}</small></span>
            <div>
                <button onclick="window.configureCategorySettings(${index})">⚙️</button>
                <button onclick="window.removeCategory(${index})">🗑️</button>
            </div>
        `;
        categoryList.appendChild(card);
    });

    if (categories.includes(currentFilterValue)) filterCategory.value = currentFilterValue;
}

window.configureCategorySettings = function(i) {
    const oldName = categories[i];
    const currentBudget = categoryBudgets[oldName] || 0;

    showCustomCategorySettings(oldName, currentBudget, async (targetName, budgetLimit) => {
        categories[i] = targetName;
        
        // Retain budget maps across renames
        delete categoryBudgets[oldName];
        if (budgetLimit > 0) categoryBudgets[targetName] = budgetLimit;

        for (let t of transactions) {
            if (t.category === oldName) {
                await syncUpdateTransaction(userUID, t.docId, { category: targetName });
            }
        }
        await saveConfigState();
        loadCategories();
    });
};

window.removeCategory = async function(i) {
    const targetCat = categories[i];
    
    showCustomConfirm(
        "Delete Category", 
        `Are you sure you want to remove the category "${targetCat}"? Associated transactions will reset to "General".`, 
        false, 
        "", 
        async () => {
            if (!categories.map(c => c.toLowerCase()).includes("general")) {
                categories.push("General");
            }

            const updatePromises = transactions
                .filter(t => t.category === targetCat)
                .map(t => syncUpdateTransaction(userUID, t.docId, { category: "General" }));

            try {
                await Promise.all(updatePromises);
                
                categories.splice(i, 1);
                delete categoryBudgets[targetCat];
                await saveConfigState();
                loadCategories();
            } catch (error) {
                showCustomAlert("Sync Error", "Failed to clear out associated categories smoothly.", true);
            }
        }
    );
};

/* ==========================================
    Ledger Action Core Engine Interfaces
========================================== */
async function addTransaction() {
    const t = title.value.trim();
    const a = Number(amount.value);
    const ty = type.value;
    const c = category.value || "General";
    const st = status.value;
    const isRec = isRecurringCheckbox.checked;

    if (t === "" || isNaN(a) || a <= 0) {
        showCustomAlert("Validation Error", "Enter valid transaction details and positive amounts.", true);
        return;
    }

    const newTxPayload = {
        id: Date.now(),
        title: t,
        amount: a,
        type: ty,
        category: c,
        status: st,
        date: new Date().toLocaleDateString('en-IN'),
        isRecurring: isRec,
        lastGeneratedDate: isRec ? new Date().toLocaleDateString('en-IN') : null
    };

    await syncAddTransaction(userUID, newTxPayload);
    title.value = ""; amount.value = "";
    isRecurringCheckbox.checked = false;
}

window.deleteTransaction = function(id) {
    const target = transactions.find(item => item.id === id);
    if (!target) return;
    
    showCustomConfirm("Delete Record", `Delete operations record for "${target.title}"?`, false, "", async () => {
        await syncDeleteTransaction(userUID, target.docId);
    });
};

window.editTransaction = function(id) {
    const item = transactions.find(x => x.id === id);
    if (!item) return;

    showCustomTransactionEditor(
        item.title, 
        item.amount, 
        async (newTitle, newAmount) => {
            await syncUpdateTransaction(userUID, item.docId, {
                title: newTitle,
                amount: newAmount
            });
        }
    );
};

window.toggleStatus = async function(id) {
    const item = transactions.find(x => x.id === id);
    if (!item) return;
    const newStatus = item.status === "paid" ? "pending" : "paid";
    await syncUpdateTransaction(userUID, item.docId, { status: newStatus });
};

/* ==========================================
    MASS PURGE ACTIVE CATEGORY VIEW
========================================== */
function purgeActiveCategoryTransactions() {
    const activeCategory = filterCategory.value;
    const searchKeyword = search.value.toLowerCase();

    const matchedItems = transactions.filter(item => {
        const matchesSearch = item.title.toLowerCase().includes(searchKeyword) || item.category.toLowerCase().includes(searchKeyword);
        const matchesCategory = (activeCategory === "all" || item.category === activeCategory);
        return matchesSearch && matchesCategory;
    });

    if (matchedItems.length === 0) {
        showCustomAlert("Empty Viewport", "There are no transaction records currently visible matching this criteria to clear.", true);
        return;
    }

    const targetsDescription = activeCategory === "all" ? "ALL transactions" : `all entries listed under "${activeCategory}"`;

    showCustomConfirm(
        "🚨 Mass Deletion Action",
        `You are about to permanently erase ${matchedItems.length} records matching ${targetsDescription}. Type DELETE to execute.`,
        true,
        "DELETE",
        async () => {
            for (let item of matchedItems) {
                await syncDeleteTransaction(userUID, item.docId);
            }
            showCustomAlert("Purge Successful", `Successfully cleaned ${matchedItems.length} records.`, false);
        }
    );
}

/* ==========================================
    Data Export Pipeline (Excel/CSV Engine)
========================================== */
function downloadExcelSpreadsheet() {
    if (transactions.length === 0) {
        showCustomAlert("Error", "There is no ledger data available to download.", true);
        return;
    }

    const targetCategoryFilter = filterCategory.value;
    const searchKeyword = search.value.toLowerCase();

    const targetedRows = transactions.filter(item => {
        const matchesSearch = item.title.toLowerCase().includes(searchKeyword) || item.category.toLowerCase().includes(searchKeyword);
        const matchesCategoryDropdown = (targetCategoryFilter === "all" || item.category === targetCategoryFilter);
        return matchesSearch && matchesCategoryDropdown;
    });

    if (targetedRows.length === 0) {
        showCustomAlert("Error", "The current filtered view contains no dataset entries to export.", true);
        return;
    }

    const headers = ["Date", "Description", "Category", "Type", "Amount (INR)", "Status"];
    const csvContent = [
        headers.join(","),
        ...targetedRows.map(t => {
            const safeTitle = `"${t.title.replace(/"/g, '""')}"`;
            const safeCategory = `"${t.category.replace(/"/g, '""')}"`;
            const currentStatus = (t.status === "paid" || !t.hasOwnProperty('status')) ? "Paid" : "Pending";
            return [t.date, safeTitle, safeCategory, t.type.toUpperCase(), t.amount, currentStatus].join(",");
        })
    ].join("\n");

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    
    const fileTimestamp = new Date().toISOString().split('T')[0];
    const viewContextName = targetCategoryFilter === "all" ? "All_Categories" : targetCategoryFilter.replace(/\s+/g, '_');
    link.setAttribute("download", `Ledger_Report_${viewContextName}_${fileTimestamp}.csv`);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/* ==========================================
    FEATURE: CHART.JS ANALYTICS ENGINE
========================================== */
function updateAnalyticsChart(categoryDataMap) {
    const ctx = document.getElementById("analyticsChart");
    if (!ctx) return;

    const labels = Object.keys(categoryDataMap);
    const dataValues = Object.values(categoryDataMap);

    if (financialChart) {
        financialChart.data.labels = labels;
        financialChart.data.datasets[0].data = dataValues;
        financialChart.update();
    } else {
        financialChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Expenses by Category (₹)',
                    data: dataValues,
                    backgroundColor: [
                        '#d9534f', '#4285F4', '#5cb85c', '#f0ad4e', '#5bc0de', '#9b59b6'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { position: 'bottom', labels: { color: document.body.dataset.theme === 'dark' ? '#fff' : '#000' } }
                }
            }
        });
    }
}

/* ==========================================
    Financial Engine Metrics Analytics 
========================================== */
function runFinancialAnalytics(paidIncome, paidExpense) {
    const netSavings = paidIncome - paidExpense;
    let savingsRate = 0;
    if (paidIncome > 0) savingsRate = Math.round((netSavings / paidIncome) * 100);
    else if (paidIncome === 0 && paidExpense > 0) savingsRate = -100;

    healthBadge.className = "badge"; 
    if (savingsRate >= 50) { healthBadge.innerText = "Elite Wealth Builder"; healthBadge.classList.add("badge-good"); }
    else if (savingsRate >= 20) { healthBadge.innerText = "Healthy Buffer Rate"; healthBadge.classList.add("badge-warn"); }
    else { healthBadge.innerText = "Low Reserves"; healthBadge.classList.add("badge-danger"); }

    return { savingsRate, netSavings };
}

/* ==========================================
    Global Interface Rendering Log Pipeline
========================================== */
function render() {
    list.innerHTML = "";
    let paidIncome = 0; let paidExpense = 0; let pendIncome = 0;
    let categoryExpenseTracker = {};

    // Initial Global Matrix Loop
    transactions.forEach(item => {
        const isPaid = (item.status === "paid" || !item.hasOwnProperty('status'));
        if (item.type === "income") {
            if (isPaid) paidIncome += item.amount; else pendIncome += item.amount;
        } else {
            if (isPaid) {
                paidExpense += item.amount;
                // Accumulate metrics specifically for visual metrics chart arrays
                categoryExpenseTracker[item.category] = (categoryExpenseTracker[item.category] || 0) + item.amount;
            }
        }
    });

    const searchKeyword = search.value.toLowerCase();
    const targetCategoryFilter = filterCategory.value;
    const startFilter = startDateInput.value ? new Date(startDateInput.value) : null;
    const endFilter = endDateInput.value ? new Date(endDateInput.value) : null;

    const { savingsRate, netSavings } = runFinancialAnalytics(paidIncome, paidExpense);

    // Filtered Rendering Cycle
    transactions
    .filter(item => {
        const matchesSearch = item.title.toLowerCase().includes(searchKeyword) || item.category.toLowerCase().includes(searchKeyword);
        const matchesCategoryDropdown = (targetCategoryFilter === "all" || item.category === targetCategoryFilter);
        
        // Date range parse pipeline logic
        const txDate = parseDate(item.date);
        if (startFilter) txDate.setHours(0,0,0,0); startFilter && startFilter.setHours(0,0,0,0);
        if (endFilter) txDate.setHours(0,0,0,0); endFilter && endFilter.setHours(0,0,0,0);
        
        const matchesStartDate = startFilter ? txDate >= startFilter : true;
        const matchesEndDate = endFilter ? txDate <= endFilter : true;

        return matchesSearch && matchesCategoryDropdown && matchesStartDate && matchesEndDate;
    })
    .forEach(item => {
        const li = document.createElement("li");
        li.className = "transaction";
        const isPaid = (item.status === "paid" || !item.hasOwnProperty('status'));
        
        // Dynamic structural checks to evaluate baseline performance against targets
        let budgetOverrunWarning = "";
        if (item.type === "expense" && categoryBudgets[item.category]) {
            const currentTotal = categoryExpenseTracker[item.category] || 0;
            const threshold = categoryBudgets[item.category];
            if (currentTotal > threshold) {
                budgetOverrunWarning = ` <span style="color:#d9534f; font-size:11px;">⚠️ Over Budget (Limit: ₹${threshold})</span>`;
            }
        }

        li.innerHTML = `
            <div class="leftSide">
                <h3>${item.title}${item.isRecurring ? ' 🔄' : ''}</h3>
                <p><strong>${item.category}</strong> • ${item.date}${budgetOverrunWarning}</p>
                <span class="status-badge ${isPaid ? 'status-paid' : 'status-pending'}" onclick="window.toggleStatus(${item.id})">
                    ${isPaid ? '✅ Paid' : '⏳ Pending'}
                </span>
            </div>
            <div class="rightSide">
                <span class="amount ${item.type === "income" ? "incomeText" : "expenseText"}">
                    ${item.type === "income" ? "+" : "-"} ₹${item.amount}
                </span>
                <div>
                    <button class="actionBtn" onclick="window.editTransaction(${item.id})">✏️</button>
                    <button class="actionBtn" onclick="window.deleteTransaction(${item.id})">🗑️</button>
                </div>
            </div>
        `;
        list.appendChild(li);
    });

    balance.innerText = "₹" + netSavings.toLocaleString('en-IN');
    income.innerText = "₹" + paidIncome.toLocaleString('en-IN');
    
    let currentPendingExpense = 0;
    transactions.forEach(item => {
        if (item.type === "expense" && item.status === "pending") currentPendingExpense += item.amount;
    });
    
    expense.innerText = "₹" + paidExpense.toLocaleString('en-IN');
    saving.innerText = `${netSavings < 0 ? '-' : ''}₹${Math.abs(netSavings).toLocaleString('en-IN')} (${savingsRate}%)`;
    pendingIncome.innerText = "₹" + pendIncome.toLocaleString('en-IN');
    pendingExpense.innerText = "₹" + currentPendingExpense.toLocaleString('en-IN');

    // Trigger chart calculations
    updateAnalyticsChart(categoryExpenseTracker);
}

function clearFormStateFields() {
    if (title) title.value = "";
    if (amount) amount.value = "";
    if (list) list.innerHTML = "";
    transactions = [];
    if (financialChart) {
        financialChart.destroy();
        financialChart = null;
    }
}
