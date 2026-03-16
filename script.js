// script.js – Autonomous Stock Trader (no buttons)

(function() {
    // ==================== STATE ====================
    let cash = 1000.00;
    let holdings = [];                 // { symbol, qty, buyPrice }
    let priceHistory = [];               // last N prices for SMA
    let currentPrice = 50;                // simulated start price
    let equityHistory = [];                // for equity curve
    let timeoutId = null;
    let isRunning = true;                 // auto-run on load

    // DOM elements
    const cashEl = document.getElementById('cash');
    const portfolioValEl = document.getElementById('portfolioValue');
    const totalEquityEl = document.getElementById('totalEquity');
    const priceEl = document.getElementById('price');
    const smaEl = document.getElementById('sma');
    const signalEl = document.getElementById('signal');
    const holdingsBody = document.getElementById('holdingsBody');
    const logContainer = document.getElementById('logContainer');

    // Settings inputs
    const smaPeriodInput = document.getElementById('smaPeriod');
    const profitTargetInput = document.getElementById('profitTarget');
    const buyAmountInput = document.getElementById('buyAmount');
    const updateIntervalInput = document.getElementById('updateInterval');

    // Charts
    let priceChart, equityChart;
    const priceLabels = [];
    const priceDataset = [];
    const smaDataset = [];
    const equityLabels = [];
    const equityDataset = [];

    // ==================== INIT CHARTS ====================
    function initCharts() {
        const ctx1 = document.getElementById('priceChart').getContext('2d');
        priceChart = new Chart(ctx1, {
            type: 'line',
            data: {
                labels: priceLabels,
                datasets: [
                    { label: 'Price', data: priceDataset, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', tension: 0.1 },
                    { label: 'SMA', data: smaDataset, borderColor: '#f59e0b', backgroundColor: 'transparent', borderDash: [5,5], tension: 0.1 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                scales: { x: { display: true }, y: { beginAtZero: false } }
            }
        });

        const ctx2 = document.getElementById('equityChart').getContext('2d');
        equityChart = new Chart(ctx2, {
            type: 'line',
            data: {
                labels: equityLabels,
                datasets: [
                    { label: 'Total Equity', data: equityDataset, borderColor: '#667eea', backgroundColor: 'rgba(102,126,234,0.1)', tension: 0.1 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                scales: { x: { display: true }, y: { beginAtZero: false } }
            }
        });
    }

    // ==================== LOCAL STORAGE ====================
    function loadState() {
        const saved = localStorage.getItem('aiTraderProState');
        if (saved) {
            try {
                const state = JSON.parse(saved);
                cash = state.cash || 1000;
                holdings = state.holdings || [];
                priceHistory = state.priceHistory || [];
                currentPrice = state.currentPrice || 50;
                equityHistory = state.equityHistory || [];
            } catch (e) {
                console.warn('Failed to load state', e);
            }
        }
        updateUI();
        restoreChartsFromHistory();
    }

    function saveState() {
        const state = { cash, holdings, priceHistory, currentPrice, equityHistory };
        localStorage.setItem('aiTraderProState', JSON.stringify(state));
    }

    function restoreChartsFromHistory() {
        const period = parseInt(smaPeriodInput.value) || 20;
        priceLabels.length = 0;
        priceDataset.length = 0;
        smaDataset.length = 0;
        for (let i = 0; i < priceHistory.length; i++) {
            priceLabels.push(i.toString());
            priceDataset.push(priceHistory[i]);
            const start = Math.max(0, i - period + 1);
            const slice = priceHistory.slice(start, i+1);
            const sma = slice.reduce((a,b)=>a+b,0) / slice.length;
            smaDataset.push(sma);
        }
        equityLabels.length = 0;
        equityDataset.length = 0;
        equityHistory.forEach((val, idx) => {
            equityLabels.push(idx.toString());
            equityDataset.push(val);
        });
        if (priceChart) priceChart.update();
        if (equityChart) equityChart.update();
    }

    // ==================== UI UPDATES ====================
    function updateUI() {
        cashEl.textContent = cash.toFixed(2);
        let portfolioValue = holdings.reduce((sum, h) => sum + h.qty * currentPrice, 0);
        portfolioValEl.textContent = portfolioValue.toFixed(2);
        const total = cash + portfolioValue;
        totalEquityEl.textContent = total.toFixed(2);

        priceEl.textContent = currentPrice.toFixed(2);
        const sma = computeSMA(parseInt(smaPeriodInput.value) || 20);
        smaEl.textContent = sma.toFixed(2);
        signalEl.textContent = currentPrice < sma ? 'BUY SIGNAL' : 'HOLD';
        signalEl.style.color = currentPrice < sma ? '#10b981' : '#f59e0b';

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
    function computeSMA(period) {
        if (priceHistory.length < period) return currentPrice;
        const recent = priceHistory.slice(-period);
        return recent.reduce((a, b) => a + b, 0) / period;
    }

    // ==================== PRICE SIMULATION ====================
    function generateNewPrice() {
        const change = (Math.random() * 3) - 1.5;
        let newPrice = currentPrice + change;
        if (newPrice < 1) newPrice = 1;
        if (newPrice > 200) newPrice = 200;
        return newPrice;
    }

    // ==================== LOGGING ====================
    function log(message, type = 'info') {
        const entry = document.createElement('div');
        const timestamp = new Date().toLocaleTimeString();
        entry.textContent = `[${timestamp}] ${message}`;
        switch (type) {
            case 'buy': entry.style.color = '#10b981'; break;
            case 'sell': entry.style.color = '#3b82f6'; break;
            case 'profit': entry.style.color = '#a855f7'; break;
            default: entry.style.color = 'var(--text-light)';
        }
        logContainer.prepend(entry);
        while (logContainer.children.length > 50) {
            logContainer.removeChild(logContainer.lastChild);
        }
        console.log(`[${timestamp}] ${message}`);
    }

    // ==================== SOUND ALERTS ====================
    function beep(type) {
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            oscillator.frequency.setValueAtTime(type === 'buy' ? 800 : 600, audioCtx.currentTime);
            gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.1);
        } catch (e) {
            // Ignore autoplay restrictions
        }
    }

    // ==================== UPDATE CHARTS ====================
    function updateCharts() {
        const now = new Date().toLocaleTimeString();
        priceLabels.push(now);
        priceDataset.push(currentPrice);
        const period = parseInt(smaPeriodInput.value) || 20;
        const sma = computeSMA(period);
        smaDataset.push(sma);
        if (priceLabels.length > 30) {
            priceLabels.shift();
            priceDataset.shift();
            smaDataset.shift();
        }
        priceChart.update();

        const total = cash + holdings.reduce((sum, h) => sum + h.qty * currentPrice, 0);
        equityLabels.push(now);
        equityDataset.push(total);
        equityHistory.push(total);
        if (equityLabels.length > 30) {
            equityLabels.shift();
            equityDataset.shift();
            if (equityHistory.length > 30) equityHistory.shift();
        }
        equityChart.update();
    }

    // ==================== TRADING LOGIC ====================
    async function checkAndTrade() {
        // Simulate price update
        currentPrice = generateNewPrice();

        priceHistory.push(currentPrice);
        if (priceHistory.length > 100) priceHistory.shift();

        const period = parseInt(smaPeriodInput.value) || 20;
        const profitTarget = (parseFloat(profitTargetInput.value) / 100) + 1 || 1.05;
        const buyAmount = parseFloat(buyAmountInput.value) || 0;

        const sma = computeSMA(period);

        // SELL
        for (let i = holdings.length - 1; i >= 0; i--) {
            const h = holdings[i];
            if (currentPrice >= h.buyPrice * profitTarget) {
                const proceeds = h.qty * currentPrice;
                cash += proceeds;
                const profit = proceeds - (h.qty * h.buyPrice);
                log(`💰 SOLD ${h.qty} ${h.symbol} at ${currentPrice.toFixed(2)} ETB | Profit: ${profit.toFixed(2)} ETB`, 'sell');
                beep('sell');
                holdings.splice(i, 1);
                if (Notification.permission === 'granted') {
                    new Notification('AI Trader Sold', { body: `${h.qty} ${h.symbol} at ${currentPrice.toFixed(2)} ETB | Profit: ${profit.toFixed(2)} ETB` });
                }
            }
        }

        // BUY
        if (currentPrice < sma && cash >= currentPrice) {
            let sharesToBuy;
            if (buyAmount > 0) {
                sharesToBuy = Math.min(Math.floor(buyAmount / currentPrice), Math.floor(cash / currentPrice));
            } else {
                sharesToBuy = Math.floor(cash / currentPrice);
            }
            if (sharesToBuy > 0) {
                const cost = sharesToBuy * currentPrice;
                cash -= cost;
                holdings.push({ symbol: 'SIM', qty: sharesToBuy, buyPrice: currentPrice });
                log(`✅ BOUGHT ${sharesToBuy} SIM at ${currentPrice.toFixed(2)} ETB`, 'buy');
                beep('buy');
                if (Notification.permission === 'granted') {
                    new Notification('AI Trader Bought', { body: `${sharesToBuy} SIM at ${currentPrice.toFixed(2)} ETB` });
                }
            }
        }

        updateUI();
        updateCharts();
        saveState();
    }

    // ==================== AUTONOMOUS LOOP ====================
    async function runBotCycle() {
        if (!isRunning) return;
        await checkAndTrade();
        const intervalSec = parseInt(updateIntervalInput.value) * 1000 || 60000;
        timeoutId = setTimeout(runBotCycle, intervalSec);
    }

    // Start automatically
    function startBot() {
        if (!isRunning) {
            isRunning = true;
            runBotCycle();
        }
    }

    // ==================== THEME TOGGLE ====================
    const lightBtn = document.getElementById('light-mode');
    const darkBtn = document.getElementById('dark-mode');
    const root = document.documentElement;

    function setTheme(theme) {
        root.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        if (theme === 'dark') {
            darkBtn.classList.add('active');
            lightBtn.classList.remove('active');
        } else {
            lightBtn.classList.add('active');
            darkBtn.classList.remove('active');
        }
    }

    lightBtn.addEventListener('click', () => setTheme('light'));
    darkBtn.addEventListener('click', () => setTheme('dark'));

    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);

    // ==================== INIT ====================
    window.addEventListener('load', () => {
        initCharts();
        loadState();
        restoreChartsFromHistory();
        // Request notification permission (optional)
        if (Notification.permission === 'default') {
            Notification.requestPermission();
        }
        // Start the bot automatically
        startBot();
    });

    // Optional: If you ever need to stop (e.g., on page unload), you can clear timeout
    window.addEventListener('beforeunload', () => {
        if (timeoutId) clearTimeout(timeoutId);
    });
})();
