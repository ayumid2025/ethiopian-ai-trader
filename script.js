// State
let cash = 1000.00;
let holdings = [];            // { symbol, qty, buyPrice }
let priceHistory = [];        // last 20 prices for SMA
let currentPrice = 50;        // starting price
let intervalId = null;
let isRunning = false;

// Constants
const STOCK = "SIM";
const SMA_PERIOD = 20;
const PROFIT_TARGET = 1.05;   // 5% profit target
const UPDATE_INTERVAL = 60000; // 1 minute

// DOM elements
const cashEl = document.getElementById('cash');
const portfolioValEl = document.getElementById('portfolioValue');
const totalEquityEl = document.getElementById('totalEquity');
const priceEl = document.getElementById('price');
const smaEl = document.getElementById('sma');
const signalEl = document.getElementById('signal');
const holdingsBody = document.getElementById('holdingsBody');
const logContainer = document.getElementById('logContainer');

// Load from localStorage if exists
function loadState() {
    const saved = localStorage.getItem('aiTraderState');
    if (saved) {
        const state = JSON.parse(saved);
        cash = state.cash;
        holdings = state.holdings;
        priceHistory = state.priceHistory;
        currentPrice = state.currentPrice;
    }
    updateUI();
}
loadState();

// Save to localStorage
function saveState() {
    localStorage.setItem('aiTraderState', JSON.stringify({
        cash, holdings, priceHistory, currentPrice
    }));
}

// Log message
function log(message, type = 'info') {
    const entry = document.createElement('div');
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    if (type === 'buy') entry.style.color = 'green';
    else if (type === 'sell') entry.style.color = 'blue';
    else if (type === 'profit') entry.style.color = 'purple';
    logContainer.prepend(entry); // latest on top
    if (logContainer.children.length > 50) logContainer.removeChild(logContainer.lastChild);
}

// Update UI with current values
function updateUI() {
    cashEl.textContent = cash.toFixed(2);
    
    let portfolioValue = 0;
    holdings.forEach(h => portfolioValue += h.qty * currentPrice);
    portfolioValEl.textContent = portfolioValue.toFixed(2);
    
    const total = cash + portfolioValue;
    totalEquityEl.textContent = total.toFixed(2);
    
    priceEl.textContent = currentPrice.toFixed(2);
    const sma = computeSMA();
    smaEl.textContent = sma.toFixed(2);
    
    // Signal based on last two prices (optional)
    signalEl.textContent = currentPrice < sma ? 'BUY SIGNAL' : 'HOLD';
    
    // Holdings table
    let html = '';
    holdings.forEach(h => {
        const currentVal = h.qty * currentPrice;
        const profitPercent = ((currentPrice - h.buyPrice) / h.buyPrice * 100).toFixed(2);
        html += `<tr>
            <td>${h.symbol}</td>
            <td>${h.qty}</td>
            <td>${h.buyPrice.toFixed(2)}</td>
            <td>${currentVal.toFixed(2)}</td>
            <td style="color: ${profitPercent >= 0 ? 'green' : 'red'}">${profitPercent}%</td>
        </tr>`;
    });
    holdingsBody.innerHTML = html || '<tr><td colspan="5">No holdings</td></tr>';
}

// Simple Moving Average
function computeSMA() {
    if (priceHistory.length < SMA_PERIOD) return currentPrice; // not enough data
    const sum = priceHistory.slice(-SMA_PERIOD).reduce((a, b) => a + b, 0);
    return sum / SMA_PERIOD;
}
