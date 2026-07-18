/* ==========================================================================
   GLOBAL STATE & INITIALIZATION
   ========================================================================== */
let financialChart = null;
let transactions = [];

// Initialize application on DOM load
document.addEventListener("DOMContentLoaded", () => {
    loadTransactionsFromStorage();
    setupEventListeners();
    renderApp();
});

/* ==========================================================================
   EVENT LISTENERS
   ========================================================================== */
function setupEventListeners() {
    const transactionForm = document.getElementById("transactionForm");
    const themeToggleBtn = document.getElementById("themeToggleBtn");

    if (transactionForm) {
        transactionForm.addEventListener("submit", handleAddTransaction);
    }

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener("click", toggleTheme);
    }
}

/* ==========================================================================
   CORE DATA WORKFLOWS (CRUD)
   ========================================================================== */
function handleAddTransaction(event) {
    event.preventDefault();

    const textInput = document.getElementById("text");
    const amountInput = document.getElementById("amount");
    const categoryInput = document.getElementById("category");

    if (!textInput.value.trim() || !amountInput.value.trim()) {
        alert("Please add a description and amount.");
        return;
    }

    const transaction = {
        id: generateID(),
        text: textInput.value.trim(),
        amount: parseFloat(amountInput.value),
        category: categoryInput ? categoryInput.value : "Miscellaneous",
        date: new Date().toLocaleDateString()
    };

    transactions.push(transaction);
    updateLocalStorage();
    renderApp();

    // Reset Form Fields
    textInput.value = "";
    amountInput.value = "";
}

function deleteTransaction(id) {
    transactions = transactions.filter(t => t.id !== id);
    updateLocalStorage();
    renderApp();
}

function generateID() {
    return Math.floor(Math.random() * 100000000);
}

/* ==========================================================================
   LOCAL STORAGE MANAGERS
   ========================================================================== */
function updateLocalStorage() {
    localStorage.setItem("transactions", JSON.stringify(transactions));
}

function loadTransactionsFromStorage() {
    const localStorageTransactions = JSON.parse(localStorage.getItem("transactions"));
    transactions = localStorageTransactions !== null ? localStorageTransactions : [];
}

/* ==========================================================================
   CALCULATION ENGINE & ANALYTICS CHARTS
   ========================================================================== */
function updateAnalyticsChart(categoryDataMap) {
    const canvas = document.getElementById("analyticsChart");
    if (!canvas) return;

    const labels = Object.keys(categoryDataMap);
    const dataValues = Object.values(categoryDataMap);

    // 1. Clear chart if no expense data exists
    if (labels.length === 0) {
        if (financialChart) {
            financialChart.destroy();
            financialChart = null;
        }
        return;
    }

    const isDarkMode = document.body.dataset.theme === 'dark';

    // 2. CRITICAL FIX: Explicitly destroy old instance before painting the new canvas matrix
    if (financialChart) {
        financialChart.destroy();
    }

    // 3. Mount fresh instance
    const ctx = canvas.getContext("2d");
    financialChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                label: 'Expenses (₹)',
                data: dataValues,
                backgroundColor: ['#d9534f', '#4285F4', '#5cb85c', '#f0ad4e', '#5bc0de', '#9b59b6'],
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
                        color: isDarkMode ? '#fff' : '#000',
                        font: { size: 12 }
                    }
                }
            }
        }
    });
}

/* ==========================================================================
   UI RENDERING & DOM INJECTION
   ========================================================================== */
function renderApp() {
    const list = document.getElementById("list");
    const balanceDisplay = document.getElementById("balance");
    const moneyPlusDisplay = document.getElementById("money-plus");
    const moneyMinusDisplay = document.getElementById("money-minus");

    if (!list) return;
    list.innerHTML = "";

    let totalBalance = 0;
    let totalIncome = 0;
    let totalExpenses = 0;
    const categoryExpensesMap = {};

    transactions.forEach(transaction => {
        const sign = transaction.amount < 0 ? "-" : "+";
        const item = document.createElement("li");

        // Style list item based on transaction polarity
        item.classList.add(transaction.amount < 0 ? "minus" : "plus");
        
        item.innerHTML = `
            ${transaction.text} <span>${sign}₹${Math.abs(transaction.amount).toFixed(2)}</span>
            <small style="display:block; font-size:10px; color:#888;">${transaction.category} | ${transaction.date}</small>
            <button class="delete-btn" onclick="deleteTransaction(${transaction.id})">x</button>
        `;

        list.appendChild(item);

        // Aggregate core mathematical sums
        totalBalance += transaction.amount;
        if (transaction.amount > 0) {
            totalIncome += transaction.amount;
        } else {
            const absoluteExpense = Math.abs(transaction.amount);
            totalExpenses += absoluteExpense;

            // Track category breakdowns for the chart
            if (categoryExpensesMap[transaction.category]) {
                categoryExpensesMap[transaction.category] += absoluteExpense;
            } else {
                categoryExpensesMap[transaction.category] = absoluteExpense;
            }
        }
    });

    // Write calculations out to the display elements
    if (balanceDisplay) balanceDisplay.innerText = `₹${totalBalance.toFixed(2)}`;
    if (moneyPlusDisplay) moneyPlusDisplay.innerText = `+₹${totalIncome.toFixed(2)}`;
    if (moneyMinusDisplay) moneyMinusDisplay.innerText = `-₹${totalExpenses.toFixed(2)}`;

    // Redraw chart engine with calculated dataset mapping
    updateAnalyticsChart(categoryExpensesMap);
}

/* ==========================================================================
   UI UTILITIES (THEMING)
   ========================================================================== */
function toggleTheme() {
    const currentTheme = document.body.dataset.theme;
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.body.dataset.theme = newTheme;
    
    // Rerender app to adapt Chart text labels immediately to the new theme palette
    renderApp();
}
