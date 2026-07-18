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
let unsubscribeTxListener = null; 

// UI Bindings
let title, amount, type, category, status, addBtn, list, search, filterCategory;
let balance, income, expense, saving, healthBadge, pendingIncome, pendingExpense;
let theme, newCategory, addCategory, categoryList;
let authScreen, appScreen, googleBtn, logoutBtn, deleteAccountBtn, exportBtn, purgeCategoryBtn;

// Custom Modal Engine Bindings
let modalOverlay, modalTitle, modalDescription, modalConfirmBtn, modalCancelBtn, modalInput, modalIcon;
let activeModalAction = null; 

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

    // Modal elements
    modalOverlay = $("customModalOverlay");
    modalTitle = $("modalTitle");
    modalDescription = $("modalDescription");
    modalConfirmBtn = $("modalConfirmBtn");
    modalCancelBtn = $("modalCancelBtn");
    modalInput = $("modalConfirmationInput");
    modalIcon = $("modalIconContainer");

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
    modalInput.style.display = "none";
    modalCancelBtn.style.display = "none"; // Hide cancel for simple information notifications
    
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
    modalCancelBtn.style.display = "inline-block";

    if (requiresVerificationText) {
        modalInput.value = "";
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

function closeModal() {
    modalOverlay.children[0].style.transform = "scale(0.9)";
    setTimeout(() => { modalOverlay.style.display = "none"; }, 150);
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
    } else {
        await saveUserSettings(userUID, { theme: "dark", categories: categories });
        document.body.dataset.theme = "dark";
        theme.value = "dark";
    }

    loadCategories();

    function startLiveStream() {
        if (unsubscribeTxListener) unsubscribeTxListener(); 
        unsubscribeTxListener = syncTransactionsRealtime(userUID, (updatedTransactionsList) => {
            transactions = updatedTransactionsList;
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
    await saveUserSettings(userUID, { categories: categories });
    render();
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

        const card = document.createElement("div");
        card.className = "categoryCard";
        card.innerHTML = `
            <span>${cat}</span>
            <div>
                <button onclick="renameCategory(${index})">✏️</button>
                <button onclick="removeCategory(${index})">🗑️</button>
            </div>
        `;
        categoryList.appendChild(card);
    });

    if (categories.includes(currentFilterValue)) filterCategory.value = currentFilterValue;
}

async function renameCategory(i) {
    const oldName = categories[i];
    const name = prompt("Modify Category Designation Label:", oldName);
    if (!name || name.trim() === "") return;
    
    const targetName = name.trim();
    categories[i] = targetName;
    
    for (let t of transactions) {
        if (t.category === oldName) {
            await syncUpdateTransaction(userUID, t.docId, { category: targetName });
        }
    }
    await saveConfigState();
    loadCategories();
}

async function removeCategory(i) {
    const targetCat = categories[i];
    showCustomConfirm("Delete Category", `Are you sure you want to remove the category "${targetCat}"? Associated transactions will reset to "General".`, false, "", async () => {
        for (let t of transactions) {
            if (t.category === targetCat) {
                await syncUpdateTransaction(userUID, t.docId, { category: "General" });
            }
        }
        categories.splice(i, 1);
        if (!categories.includes("General")) categories.push("General");
        await saveConfigState();
        loadCategories();
    });
}
window.renameCategory = renameCategory;
window.removeCategory = removeCategory;

/* ==========================================
    Ledger Action Core Engine Interfaces
========================================== */
async function addTransaction() {
    const t = title.value.trim();
    const a = Number(amount.value);
    const ty = type.value;
    const c = category.value || "General";
    const st = status.value;

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
        date: new Date().toLocaleDateString('en-IN')
    };

    await syncAddTransaction(userUID, newTxPayload);
    title.value = ""; amount.value = "";
}

function deleteTransaction(id) {
    const target = transactions.find(item => item.id === id);
    if (!target) return;
    
    showCustomConfirm("Delete Record", `Delete operations record for "${target.title}"?`, false, "", async () => {
        await syncDeleteTransaction(userUID, target.docId);
    });
}
window.deleteTransaction = deleteTransaction;

async function editTransaction(id) {
    const item = transactions.find(x => x.id === id);
    if (!item) return;

    const t = prompt("Modify Description Designation:", item.title);
    if (t === null) return;

    const a = prompt("Modify Financial Metric Value Amount (₹):", item.amount);
    if (a === null || isNaN(Number(a)) || Number(a) <= 0) return;

    await syncUpdateTransaction(userUID, item.docId, {
        title: t.trim(),
        amount: Number(a)
    });
}
window.editTransaction = editTransaction;

async function toggleStatus(id) {
    const item = transactions.find(x => x.id === id);
    if (!item) return;
    const newStatus = item.status === "paid" ? "pending" : "paid";
    await syncUpdateTransaction(userUID, item.docId, { status: newStatus });
}
window.toggleStatus = toggleStatus;

/* ==========================================
    NEW FEATURE: PURGE ACTIVE CATEGORY VIEW
========================================== */
function purgeActiveCategoryTransactions() {
    const activeCategory = filterCategory.value;
    const searchKeyword = search.value.toLowerCase();

    // Identify exactly what matches the screen filters
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
            // Process the sync array execution deletions
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

    transactions.forEach(item => {
        const isPaid = (item.status === "paid" || !item.hasOwnProperty('status'));
        if (item.type === "income") {
            if (isPaid) paidIncome += item.amount; else pendIncome += item.amount;
        } else {
            if (isPaid) paidExpense += item.amount;
        }
    });

    const searchKeyword = search.value.toLowerCase();
    const targetCategoryFilter = filterCategory.value;
    const { savingsRate, netSavings } = runFinancialAnalytics(paidIncome, paidExpense);

    transactions
    .filter(item => {
        const matchesSearch = item.title.toLowerCase().includes(searchKeyword) || item.category.toLowerCase().includes(searchKeyword);
        const matchesCategoryDropdown = (targetCategoryFilter === "all" || item.category === targetCategoryFilter);
        return matchesSearch && matchesCategoryDropdown;
    })
    .forEach(item => {
        const li = document.createElement("li");
        li.className = "transaction";
        const isPaid = (item.status === "paid" || !item.hasOwnProperty('status'));
        
        li.innerHTML = `
            <div class="leftSide">
                <h3>${item.title}</h3>
                <p><strong>${item.category}</strong> • ${item.date}</p>
                <span class="status-badge ${isPaid ? 'status-paid' : 'status-pending'}" onclick="toggleStatus(${item.id})">
                    ${isPaid ? '✅ Paid' : '⏳ Pending'}
                </span>
            </div>
            <div class="rightSide">
                <span class="amount ${item.type === "income" ? "incomeText" : "expenseText"}">
                    ${item.type === "income" ? "+" : "-"} ₹${item.amount}
                </span>
                <div>
                    <button class="actionBtn" onclick="editTransaction(${item.id})">✏️</button>
                    <button class="actionBtn" onclick="deleteTransaction(${item.id})">🗑️</button>
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
}

function clearFormStateFields() {
    if (title) title.value = "";
    if (amount) amount.value = "";
    if (list) list.innerHTML = "";
    transactions = [];
}
