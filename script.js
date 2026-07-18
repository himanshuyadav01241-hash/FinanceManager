const $ = id => document.getElementById(id);

// Document Elements References
const title = $("title");
const amount = $("amount");
const type = $("type");
const category = $("category");
const status = $("status");
const addBtn = $("addBtn");
const list = $("transactionList");
const search = $("search");
const filterCategory = $("filterCategory");

const balance = $("balance");
const income = $("income");
const expense = $("expense");
const saving = $("saving");
const healthBadge = $("healthBadge");

const pendingIncome = $("pendingIncome");
const pendingExpense = $("pendingExpense");

const theme = $("theme");
const newCategory = $("newCategory");
const addCategory = $("addCategory");
const categoryList = $("categoryList");

// Application Data Stores
let transactions = JSON.parse(localStorage.getItem("transactions")) || [];
let categories = JSON.parse(localStorage.getItem("categories")) || ["Food", "Transport", "Shopping", "Bills", "Entertainment", "General"];

// Theme Processor
const savedTheme = localStorage.getItem("theme");
if(savedTheme){
    document.body.dataset.theme = savedTheme;
    theme.value = savedTheme;
}
theme.onchange = () => {
    document.body.dataset.theme = theme.value;
    localStorage.setItem("theme", theme.value);
};

// Application Global State Persist
function save(){
    localStorage.setItem("transactions", JSON.stringify(transactions));
    localStorage.setItem("categories", JSON.stringify(categories));
    render();
}

// Category Configuration Matrix
function loadCategories(){
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

addCategory.onclick = () => {
    const value = newCategory.value.trim();
    if(value === "") return;
    if(categories.map(c => c.toLowerCase()).includes(value.toLowerCase())){
        alert("Ecosystem already contains this category.");
        return;
    }
    categories.push(value);
    newCategory.value = "";
    save();
    loadCategories();
};

function renameCategory(i) {
    const oldName = categories[i];
    const name = prompt("Modify Category Designation Label:", oldName);
    if (!name || name.trim() === "") return;
    
    const targetName = name.trim();
    categories[i] = targetName;
    
    transactions.forEach(t => {
        if(t.category === oldName) t.category = targetName;
    });

    save();
    loadCategories();
}

function removeCategory(i) {
    const targetCat = categories[i];
    if (confirm(`Are you sure you want to delete "${targetCat}"? Associated transactions will drop back into a "General" category label.`)) {
        transactions.forEach(t => {
            if (t.category === targetCat) {
                t.category = "General"; 
            }
        });
        categories.splice(i, 1);
        if(!categories.includes("General")){
            categories.push("General");
        }
        save();
        loadCategories();
    }
}

window.renameCategory = renameCategory;
window.removeCategory = removeCategory;

loadCategories();

/* ==========================================
   Ledger Action Core Engine Interfaces
========================================== */

addBtn.addEventListener("click", addTransaction);

function addTransaction(){
    const t = title.value.trim();
    const a = Number(amount.value);
    const ty = type.value;
    const c = category.value || "General";
    const st = status.value;

    if(t === "" || isNaN(a) || a <= 0){
        alert("Verification check failed. Enter positive analytical values.");
        return;
    }

    transactions.push({
        id: Date.now(),
        title: t,
        amount: a,
        type: ty,
        category: c,
        status: st, // paid or pending
        date: new Date().toLocaleDateString('en-IN')
    });

    title.value = "";
    amount.value = "";
    save();
}

function deleteTransaction(id){
    transactions = transactions.filter(item => item.id !== id);
    save();
}
window.deleteTransaction = deleteTransaction;

function editTransaction(id){
    const item = transactions.find(x => x.id === id);
    if(!item) return;

    const t = prompt("Modify Description Designation:", item.title);
    if(t === null) return;

    const a = prompt("Modify Financial Metric Value Amount (₹):", item.amount);
    if(a === null || isNaN(Number(a)) || Number(a) <= 0) return;

    item.title = t.trim();
    item.amount = Number(a);
    save();
}
window.editTransaction = editTransaction;

// Toggle payment status seamlessly inline
function toggleStatus(id) {
    const item = transactions.find(x => x.id === id);
    if(!item) return;
    item.status = item.status === "paid" ? "pending" : "paid";
    save();
}
window.toggleStatus = toggleStatus;

search.addEventListener("input", render);
filterCategory.addEventListener("change", render);

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
    if(savingsRate >= 50) {
        healthBadge.innerText = "Elite Wealth Builder";
        healthBadge.classList.add("badge-good");
    } else if(savingsRate >= 20) {
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
function render(){
    list.innerHTML = "";
    let paidIncome = 0;
    let paidExpense = 0;
    let pendIncome = 0;
    let pendExpense = 0;

    const searchKeyword = search.value.toLowerCase();
    const targetCategoryFilter = filterCategory.value;

    // Calculate Paid vs Pending pipelines
    transactions.forEach(item => {
        const isPaid = (item.status === "paid" || !item.hasOwnProperty('status')); // legacy protection fallback
        if(item.type === "income") {
            if(isPaid) paidIncome += item.amount;
            else pendIncome += item.amount;
        } else {
            if(isPaid) paidExpense += item.amount;
            else pendExpense += item.amount;
        }
    });

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

    // Write Out Metrics
    balance.innerText = "₹" + netSavings.toLocaleString('en-IN');
    income.innerText = "₹" + paidIncome.toLocaleString('en-IN');
    expense.innerText = "₹" + paidExpense.toLocaleString('en-IN');
    saving.innerText = `${netSavings < 0 ? '-' : ''}₹${Math.abs(netSavings).toLocaleString('en-IN')} (${savingsRate}%)`;
    
    pendingIncome.innerText = "₹" + pendIncome.toLocaleString('en-IN');
    pendingExpense.innerText = "₹" + pendExpense.toLocaleString('en-IN');
}

render();