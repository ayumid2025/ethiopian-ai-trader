// script.js

// ==================== STATE ====================
let cash = 1000.00;                // cash in ETB
let holdings = [];                 // array of positions: { symbol, qty, buyPrice }
let priceHistory = [];              // last N prices for SMA calculation
let currentPrice = 50;              // starting price (simulated)
let intervalId = null;              // ID of the setInterval timer
let isRunning = false;              // whether bot is active

// Constants
const STOCK = "SIM";                // stock ticker symbol
const SMA_PERIOD = 20;               // number of periods for moving average
const PROFIT_TARGET = 1.05;          // sell when price reaches 105% of buy price
const UPDATE_INTERVAL = 60000;        // 1 minute in milliseconds

// DOM element references
const cashEl = document.getElementById('cash');
const portfolioValEl = document.getElementById('portfolioValue');
const totalEquityEl = document.getElementById('totalEquity');
const priceEl = document.getElementById('price');
const smaEl = document.getElementById('sma');
const signalEl = document.getElementById('signal');
const holdingsBody = document.getElementById('holdingsBody');
const logContainer = document.getElementById('logContainer');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const resetBtn = document.getElementById('resetBtn');

// ==================== LOCAL STORAGE ====================
// Load saved state on page load
function loadState() {
    const saved = localStorage.getItem('aiTraderState');
    if (saved) {
        try {
            const state = JSON.parse(saved);
            cash = state.cash || 1000;
            holdings = state.holdings || [];
            priceHistory = state.priceHistory || [];
            currentPrice = state.currentPrice || 50;
        } catch (e) {
            console.error('Failed to load state', e);
        }
    }
    updateUI();
}

// Save current state to localStorage
function saveState() {
    const state = {
        cash,
        holdings,
        priceHistory,
        currentPrice
    };
    localStorage.setItem('aiTraderState', JSON.stringify(state));
}

// ==================== UI UPDATES ====================
function updateUI() {
    // Cash
    cashEl.textContent = cash.toFixed(2);

    // Portfolio value (shares * current price)
    let portfolioValue = 0;
    holdings.forEach(h => portfolioValue += h.qty * currentPrice);
    portfolioValEl.textContent = portfolioValue.toFixed(2);

    // Total equity
    const total = cash + portfolioValue;
    totalEquityEl.textContent = total.toFixed(2);

    // Price and SMA
    priceEl.textContent = currentPrice.toFixed(2);
    const sma = computeSMA();
    smaEl.textContent = sma.toFixed(2);

    // Simple signal based on last condition
    signalEl.textContent = currentPrice < sma ? 'BUY SIGNAL' : 'HOLD';
    signalEl.style.color = currentPrice < sma ? '#10b981' : '#f59e0b';

    // Holdings table
    let html = '';
    if (holdings.length === 0) {
        html = '<tr><td colspan="5" style="text-align:center;">No holdings</td></tr>';
    } else {
        holdings.forEach(h => {
            const currentVal = h.qty * currentPrice;
            const profitPercent = ((currentPrice - h.buyPrice) / h.buyPrice * 100).toFixed(2);
            const color = profitPercent >= 0 ? 'green' : 'red';
            html += `<tr>
                <td>${h.symbol}</td>
                <td>${h.qty}</td>
                <td>${h.buyPrice.toFixed(2)}</td>
                <td>${currentVal.toFixed(2)}</td>
                <td style="color: ${color};">${profitPercent}%</td>
            </tr>`;
        });
    }
    holdingsBody.innerHTML = html;
}

// ==================== TECHNICAL INDICATORS ====================
// Compute simple moving average based on last SMA_PERIOD prices
function computeSMA() {
    if (priceHistory.length < SMA_PERIOD) {
        // Not enough data – return current price as fallback
        return currentPrice;
    }
    const recent = priceHistory.slice(-SMA_PERIOD);
    const sum = recent.reduce((a, b) => a + b, 0);
    return sum / SMA_PERIOD;
}
