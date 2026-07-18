// script.js
import { 
    monitorAuthState, logoutUser, deleteCurrentUserAccount,
    saveUserSettings, getUserSettings,
    syncAddTransaction, syncUpdateTransaction, syncDeleteTransaction,
    loginWithGoogle,
    syncTransactionsRealtime // 👈 Changed import to real-time engine
} from "./firebase.js";

const $ = id => document.getElementById(id);

// Runtime Memory State
let userUID = null;
let transactions = [];
let categories = ["Food", "Transport", "Shopping", "Bills", "Entertainment", "General"];
let unsubscribeTxListener = null; // 👈 Keeps track of the active data stream listener

// Declare global element variables to be populated when DOM is ready
let title, amount, type, category, status, addBtn, list, search, filterCategory;
let balance, income, expense, saving, healthBadge, pendingIncome, pendingExpense;
let theme, newCategory, addCategory, categoryList;
let authScreen, appScreen, googleBtn, logoutBtn, deleteAccountBtn;

/* ==========================================
    Initialization & DOM Binding Setup 
========================================== */
document.addEventListener("DOMContentLoaded", () => {
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
            // ✅ Clean up memory stream listener upon logout context
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

    /* --- AUTH TRIGGERS CONFIG --- */
    if (googleBtn) {
        googleBtn.onclick = async () => {
            try {
                await loginWithGoogle();
            } catch (e) {
                alert("Google Authentication Error: " + e.message);
            }
        };
    }

    logoutBtn.onclick = () => logoutUser();

    if (deleteAccountBtn) {
        deleteAccountBtn.onclick = async () => {
            if (!userUID) return;
            
            const confirmation = confirm("⚠️ CRITICAL WARNING: Are you completely sure you want to delete your profile? This will permanently purge all your transaction balances, custom categories, and credentials.");
            if (!confirmation) return;

            const textCheck = prompt("To confirm this dangerous destructive action, please type CONFIRM in the input box below:");
            
            if (textCheck !== "CONFIRM") {
                alert("❌ Verification mismatch! Deletion process cancelled.");
                return;
            }

            try {
                await deleteCurrentUserAccount(userUID);
                alert("Account successfully deleted from the cloud matrix. Returning to layout panel.");
            } catch (e) {
                if (e.code === "auth/requires-recent-login") {
                    alert("🔒 Security Action Blocked: This operation requires recent authentication. Please log out, sign back in immediately, and try again.");
                } else {
                    alert("Deletion Error: " + e.message);
                }
            }
        };
    }

    /* --- INPUT EVENT HANDLERS --- */
    addBtn.addEventListener("click", addTransaction);
    search.addEventListener("input", render);
    filterCategory.addEventListener("change", render);

    theme.onchange = async () => {
        if (!userUID) return;
        document.body.dataset.theme = theme.value;
        await saveUserSettings(userUID, { theme: theme.value });
    };

    addCategory.onclick = async () => {
        const value = newCategory.value.trim();
        if (value === "") return;
        if (categories.map(c => c.toLowerCase()).includes(value.toLowerCase())) {
            alert("Ecosystem already contains this category.");
            return;
        }
        categories.push(value);
        newCategory.value = "";
        await saveConfigState();
        loadCategories();
    };
});

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

    // ✅ Switch to real-time live data streaming pipeline
    if (unsubscribeTxListener) unsubscribeTxListener(); // kill any stale connections
    
    unsubscribeTxListener = syncTransactionsRealtime(userUID, (updatedTransactionsList) => {
        transactions = updatedTransactionsList;
        render(); // 👈 Automatically updates the UI interface instantly on any DB change!
    });
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
    category.innerHTML = "";
    categoryList.innerHTML = "";
    filterCategory.innerHTML = '<option value="all">All Categories</option>';

    categories.forEach((cat, index) => {
        const option = document.createElement("option");
        option.textContent = cat;
        option.value = cat;
        category.appendChild(option);

        const filterOption = document.createElement("option");
        filterOption.textContent = cat;
        filterOption.value = cat;
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
}

async function renameCategory(i) {
    const oldName = categories[i];
    const name = prompt("Modify Category Designation Label:", oldName);
    if (!name || name.trim() === "") return;
    
    const targetName = name.trim();
    categories[i] = targetName;
    
    for (let t of transactions) {
        if (t.category === oldName) {
            t.category = targetName;
            await syncUpdateTransaction(userUID, t.docId, { category: targetName });
        }
    }

    await saveConfigState();
    loadCategories();
}

async function removeCategory(i) {
    const targetCat = categories[i];
    if (confirm(`Are you sure you want to delete "${targetCat}"? Associated transactions will drop back into a "General" category label.`)) {
        for (let t of transactions) {
            if (t.category === targetCat) {
                t.category = "General";
                await syncUpdateTransaction(userUID, t.docId, { category: "General" });
            }
        }
        
        categories.splice(i, 1);
        if (!categories.includes("General")) {
            categories.push("General");
        }
        await saveConfigState();
        loadCategories();
    }
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
        alert("Verification check failed. Enter positive analytical values.");
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

    // ✅ Cleaned up code: We no longer need to push manually into memory list array here.
    // The real-time listener will instantly capture the server document write and run render() for us!
    await syncAddTransaction(userUID, newTxPayload);

    title.value = "";
    amount.value = "";
}

async function deleteTransaction(id) {
    const target = transactions.find(item => item.id === id);
    if (!target) return;
    
    if (confirm(`Delete operations record "${target.title}"?`)) {
        await syncDeleteTransaction(userUID, target.docId);
        // Handled automatically via database stream
    }
}
window.deleteTransaction = deleteTransaction;

async function editTransaction(id) {
    const item = transactions.find(x => x.id === id);
    if (!item) return;

    const t = prompt("Modify Description Designation:", item.title);
    if (t === null) return;

    const a = prompt("Modify Financial Metric Value Amount (₹):", item.amount);
    if (a === null || isNaN(Number(a)) || Number(a) <= 0) return;

    const updatedTitle = t.trim();
    const updatedAmount = Number(a);

    await syncUpdateTransaction(userUID, item.docId, {
        title: updatedTitle,
        amount: updatedAmount
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
    Financial Engine Metrics Analytics 
========================================== */
function runFinancialAnalytics(paidIncome, paidExpense) {
    const netSavings = paidIncome - paidExpense;
    let savingsRate = 0;
    
    if (paidIncome > 0) {
        savingsRate = Math.round((netSavings / paidIncome) * 100);
    } else if (paidIncome === 0 && paidExpense > 0) {
        savingsRate = -100; 
    }

    healthBadge.className = "badge"; 
    if (savingsRate >= 50) {
        healthBadge.innerText = "Elite Wealth Builder";
        healthBadge.classList.add("badge-good");
    } else if (savingsRate >= 20) {
        healthBadge.innerText = "Healthy Buffer Rate";
        healthBadge.classList.add("badge-warn");
    } else {
        healthBadge.innerText = "Low Reserves";
        healthBadge.classList.add("badge-danger");
    }

    return { savingsRate, netSavings };
}

/* ==========================================
    Global Interface Rendering Log Pipeline
========================================== */
function render() {
    list.innerHTML = "";
    let paidIncome = 0;
    let paidExpense = 0;
    let pendIncome = 0;

    transactions.forEach(item => {
        const isPaid = (item.status === "paid" || !item.hasOwnProperty('status'));
        if (item.type === "income") {
            if (isPaid) paidIncome += item.amount;
            else pendIncome += item.amount;
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
