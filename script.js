// ========== ALL THE BRAIN OF THE TRADER ==========

(function() {
    // ----- List of Ethiopian stocks we trade -----
    const STOCKS = [
        { symbol: 'ETHTC', name: 'Ethio Telecom', basePrice: 180 },
        { symbol: 'AWASH', name: 'Awash Bank', basePrice: 220 },
        { symbol: 'DASHEN', name: 'Dashen Bank', basePrice: 260 },
        { symbol: 'CBE', name: 'Commercial Bank', basePrice: 310 },
        { symbol: 'BGI', name: 'BGI Ethiopia', basePrice: 95 }
        { symbol: 'BERHAN', name: 'Berhan Bank', basePrice: 145 },
        { symbol: 'ZEMEN', name: 'Zemen Bank', basePrice: 130 }
    ];

    // ----- Settings you can change -----
    const SMA_PERIOD = 20;               // how many past prices to average
    const BUY_THRESHOLD = 1.0;            // buy when price is below average
    const SELL_THRESHOLD = 1.02;           // sell when price is 2% above average
    const RISK_PER_TRADE = 0.25;            // use only 25% of cash per buy
    const MAX_HISTORY = 60;                 // keep last 60 prices per stock
    const UPDATE_INTERVAL_MS = 8000;        // update every 8 seconds
    const AUTO_SEND_THRESHOLD = 200;        // auto-send profit when it reaches 200 ETB

    // ----- Our money and stuff (state) -----
    let cash = 1000.0;                      // trading account in ETB
    let bankBalance = 0.0;                   // money sent to pretend bank
    let holdings = {};                        // shares owned per stock
    let transactions = [];                     // list of all buys/sells/profit transfers
    let profitTransfers = [];                   // list of transfers to bank
    let priceHistories = {};                    // price history for each stock
    let smaHistories = {};                      // moving averages for chart
    let lastPrices = {};                        // latest price for each stock
    let updateCount = 0;                        // how many times we've updated
    let lastProfitSent = 0;                      // how much profit already auto-sent

    // ----- Set up initial prices -----
    STOCKS.forEach(s => {
        holdings[s.symbol] = 0;
        let price = s.basePrice;
        priceHistories[s.symbol] = [];
        for (let i = 0; i < 30; i++) {
            price = generateNextPrice(price, s.basePrice);
            priceHistories[s.symbol].push(price);
        }
        lastPrices[s.symbol] = priceHistories[s.symbol][priceHistories[s.symbol].length - 1];
        smaHistories[s.symbol] = [];
    });

    // ----- Chart stuff -----
    let chart;
    let selectedStock = 'ETHTC';

    // ----- Get references to HTML elements -----
    const totalCashEl = document.getElementById('totalCash');
    const holdingsValueEl = document.getElementById('holdingsValue');
    const totalPortfolioEl = document.getElementById('totalPortfolio');
    const profitLossEl = document.getElementById('profitLoss');
    const stockGrid = document.getElementById('stockGrid');
    const logContainer = document.getElementById('logContainer');
    const updateCounter = document.getElementById('updateCounter');
    const bankBalanceSpan = document.getElementById('bankBalance');
    const sendProfitBtn = document.getElementById('sendProfitBtn');
    const withdrawAllBtn = document.getElementById('withdrawAllBtn');
    const autoSendToggle = document.getElementById('autoSendToggle');
    const profitHistoryDiv = document.getElementById('profitHistory');
    const notification = document.getElementById('notification');
    const notificationMsg = document.getElementById('notificationMessage');
    const chartStockSelector = document.getElementById('chartStockSelector');
    const bankSelect = document.getElementById('bankSelect');
    const accountNumber = document.getElementById('accountNumber');
    const accountHolder = document.getElementById('accountHolder');

    // ----- Helper functions -----

    // Makes a new price that moves up/down randomly
    function generateNextPrice(prevPrice, basePrice) {
        const drift = (basePrice - prevPrice) * 0.01;     // pull toward base
        const volatility = (Math.random() - 0.5) * 2.5;   // random jump
        let newPrice = prevPrice + drift + volatility;
        return Math.max(5, parseFloat(newPrice.toFixed(2))); // never below 5
    }

    // Calculate the average of the last 'period' prices
    function calculateSMA(prices, period) {
        if (prices.length < period) return null;
        const slice = prices.slice(-period);
        const sum = slice.reduce((a, b) => a + b, 0);
        return sum / period;
    }

    // Show a pop-up message
    function showNotification(msg, isError = false) {
        notificationMsg.textContent = msg;
        notification.classList.add('show');
        if (isError) notification.classList.add('error');
        else notification.classList.remove('error');
        setTimeout(() => notification.classList.remove('show'), 4000);
    }

    // ----- Bank functions (pretend) -----

    // Send money from trading account to bank
    function sendProfitToBank(amount) {
        if (amount <= 0) {
            showNotification('No profit to send!', true);
            return false;
        }
        const bank = bankSelect.options[bankSelect.selectedIndex].text;
        const acc = accountNumber.value.trim();
        const holder = accountHolder.value.trim();
        if (!acc || !holder) {
            showNotification('Please fill bank details', true);
            return false;
        }
        bankBalance += amount;
        cash -= amount;
        profitTransfers.push({
            amount,
            bank,
            account: acc.slice(-4),
            time: new Date().toLocaleTimeString()
        });
        transactions.push({
            stock: 'BANK',
            action: 'PROFIT',
            price: amount,
            shares: '',
            time: new Date().toLocaleTimeString(),
            details: `to ${bank}`
        });
        showNotification(`💰 ${amount.toFixed(2)} ETB sent to bank`);
        saveState();
        renderUI();
        renderProfitHistory();
        return true;
    }

    // Send all profit (cash above initial 1000) to bank
    function withdrawAllProfit() {
        const profit = cash - 1000;
        if (profit <= 0) {
            showNotification('No profit to withdraw', true);
            return;
        }
        sendProfitToBank(profit);
    }

    // Check if auto-send should send money
    function checkAutoSend() {
        if (!autoSendToggle.checked) return;
        const currentProfit = cash - 1000;
        if (currentProfit - lastProfitSent >= AUTO_SEND_THRESHOLD) {
            const amount = Math.floor((currentProfit - lastProfitSent) / AUTO_SEND_THRESHOLD) * AUTO_SEND_THRESHOLD;
            if (amount > 0) {
                sendProfitToBank(amount);
                lastProfitSent += amount;
            }
        }
    }

    // Update the little list of recent transfers
    function renderProfitHistory() {
        profitHistoryDiv.innerHTML = '';
        if (profitTransfers.length === 0) {
            profitHistoryDiv.innerHTML = '<div style="color:#94a3b8;">No transfers yet</div>';
            return;
        }
        profitTransfers.slice(-5).reverse().forEach(t => {
            const div = document.createElement('div');
            div.style.display = 'flex';
            div.style.justifyContent = 'space-between';
            div.style.padding = '0.25rem 0';
            div.style.fontSize = '0.85rem';
            div.innerHTML = `<span>${t.time}</span> <span style="color:#fbbf24;">${t.amount.toFixed(2)} ETB</span> <span>${t.bank}</span>`;
            profitHistoryDiv.appendChild(div);
        });
    }

    // ----- Save and load from browser storage -----
    function saveState() {
        const state = {
            cash, bankBalance, holdings, transactions, profitTransfers,
            priceHistories, smaHistories, lastPrices, updateCount, lastProfitSent
        };
        localStorage.setItem('multiStockTraderPro', JSON.stringify(state));
    }

    function loadState() {
        const saved = localStorage.getItem('multiStockTraderPro');
        if (saved) {
            try {
                const state = JSON.parse(saved);
                cash = state.cash ?? 1000;
                bankBalance = state.bankBalance ?? 0;
                holdings = state.holdings ?? {};
                transactions = state.transactions ?? [];
                profitTransfers = state.profitTransfers ?? [];
                priceHistories = state.priceHistories ?? {};
                smaHistories = state.smaHistories ?? {};
                lastPrices = state.lastPrices ?? {};
                updateCount = state.updateCount ?? 0;
                lastProfitSent = state.lastProfitSent ?? 0;

                // Make sure every stock has history
                STOCKS.forEach(s => {
                    if (!priceHistories[s.symbol] || priceHistories[s.symbol].length === 0) {
                        let price = s.basePrice;
                        priceHistories[s.symbol] = [];
                        for (let i = 0; i < 30; i++) {
                            price = generateNextPrice(price, s.basePrice);
                            priceHistories[s.symbol].push(price);
                        }
                        lastPrices[s.symbol] = priceHistories[s.symbol][priceHistories[s.symbol].length - 1];
                    }
                    if (holdings[s.symbol] === undefined) holdings[s.symbol] = 0;
                });
            } catch (e) {
                resetToDefaults();
            }
        } else {
            resetToDefaults();
        }
        renderUI();
        renderProfitHistory();
        updateChart();
    }

    function resetToDefaults() {
        cash = 1000.0;
        bankBalance = 0;
        holdings = {};
        transactions = [];
        profitTransfers = [];
        priceHistories = {};
        smaHistories = {};
        lastPrices = {};
        updateCount = 0;
        lastProfitSent = 0;
        STOCKS.forEach(s => {
            holdings[s.symbol] = 0;
            let price = s.basePrice;
            priceHistories[s.symbol] = [];
            for (let i = 0; i < 30; i++) {
                price = generateNextPrice(price, s.basePrice);
                priceHistories[s.symbol].push(price);
            }
            lastPrices[s.symbol] = priceHistories[s.symbol][priceHistories[s.symbol].length - 1];
            smaHistories[s.symbol] = [];
        });
    }

    // ----- The main trading engine (runs every few seconds) -----
    function tradingCycle() {
        updateCount++;
        updateCounter.textContent = `updates: ${updateCount}`;

        // 1. Update all stock prices
        STOCKS.forEach(s => {
            const hist = priceHistories[s.symbol];
            const last = hist.length > 0 ? hist[hist.length - 1] : s.basePrice;
            const newPrice = generateNextPrice(last, s.basePrice);
            hist.push(newPrice);
            if (hist.length > MAX_HISTORY) hist.shift();
            lastPrices[s.symbol] = newPrice;
        });

        // 2. Decide whether to buy or sell for each stock
        STOCKS.forEach(s => {
            const symbol = s.symbol;
            const price = lastPrices[symbol];
            const hist = priceHistories[symbol];
            const sma = calculateSMA(hist, SMA_PERIOD);
            if (sma === null) return;

            // store SMA for chart
            let smaHist = smaHistories[symbol];
            smaHist.push(sma);
            if (smaHist.length > MAX_HISTORY) smaHist.shift();

            let shares = holdings[symbol] || 0;

            // BUY condition: price below average
            if (price < sma * BUY_THRESHOLD && cash > price) {
                const maxCost = cash * RISK_PER_TRADE;
                const sharesToBuy = Math.floor(maxCost / price);
                if (sharesToBuy > 0) {
                    cash -= sharesToBuy * price;
                    holdings[symbol] += sharesToBuy;
                    transactions.push({
                        stock: symbol,
                        action: 'BUY',
                        price: price,
                        shares: sharesToBuy,
                        time: new Date().toLocaleTimeString()
                    });
                }
            }
            // SELL condition: price above average by threshold
            else if (shares > 0 && price > sma * SELL_THRESHOLD) {
                const revenue = shares * price;
                cash += revenue;
                transactions.push({
                    stock: symbol,
                    action: 'SELL',
                    price: price,
                    shares: shares,
                    time: new Date().toLocaleTimeString()
                });
                holdings[symbol] = 0;
            }
        });

        // 3. Check auto-send
        checkAutoSend();

        // 4. Keep log from growing too big
        if (transactions.length > 100) transactions = transactions.slice(-100);

        // 5. Save and update screen
        saveState();
        renderUI();
        updateChart();
    }

    // ----- Update everything on screen -----
    function renderUI() {
        // Calculate total value of shares
        let holdingsValue = 0;
        STOCKS.forEach(s => {
            const shares = holdings[s.symbol] || 0;
            holdingsValue += shares * (lastPrices[s.symbol] || 0);
        });
        const totalPortfolio = cash + holdingsValue;
        const profit = totalPortfolio - 1000;

        totalCashEl.textContent = cash.toFixed(2);
        holdingsValueEl.textContent = holdingsValue.toFixed(2);
        totalPortfolioEl.textContent = totalPortfolio.toFixed(2);
        profitLossEl.textContent = profit.toFixed(2);
        bankBalanceSpan.textContent = bankBalance.toFixed(2) + ' ETB';

        // Enable/disable bank buttons
        const hasProfit = cash > 1000;
        sendProfitBtn.disabled = !hasProfit;
        withdrawAllBtn.disabled = !hasProfit;

        // Create stock cards
        stockGrid.innerHTML = '';
        STOCKS.forEach(s => {
            const symbol = s.symbol;
            const price = lastPrices[symbol] || 0;
            const shares = holdings[symbol] || 0;
            const hist = priceHistories[symbol] || [];
            const sma = calculateSMA(hist, SMA_PERIOD) || price;
            const signal = price < sma * BUY_THRESHOLD ? 'BUY' : (price > sma * SELL_THRESHOLD && shares > 0 ? 'SELL' : 'HOLD');
            const signalClass = signal === 'BUY' ? 'buy-signal' : (signal === 'SELL' ? 'sell-signal' : 'neutral-signal');

            const card = document.createElement('div');
            card.className = 'stock-card';
            card.innerHTML = `
                <div class="stock-header">
                    <span class="stock-symbol">${symbol}</span>
                    <span class="stock-price">${price.toFixed(2)}</span>
                </div>
                <div class="stock-detail"><span>Shares</span><span>${shares}</span></div>
                <div class="stock-detail"><span>SMA(${SMA_PERIOD})</span><span>${sma.toFixed(2)}</span></div>
                <div class="stock-detail"><span>Signal</span><span><span class="indicator ${signalClass}"></span> ${signal}</span></div>
                <div class="stock-detail"><span>Position</span><span>${(shares * price).toFixed(2)} ETB</span></div>
            `;
            stockGrid.appendChild(card);
        });

        // Show transaction log (last 20, newest first)
        logContainer.innerHTML = `
            <div class="log-entry header">
                <span>Stock</span>
                <span>Action</span>
                <span>Price (ETB)</span>
                <span>Time</span>
            </div>
        `;
        transactions.slice(-20).reverse().forEach(tx => {
            const entry = document.createElement('div');
            entry.className = `log-entry ${tx.action === 'BUY' ? 'buy-log' : tx.action === 'SELL' ? 'sell-log' : 'profit-log'}`;
            entry.innerHTML = `
                <span>${tx.stock}</span>
                <span>${tx.action} ${tx.shares || ''}</span>
                <span>${tx.price.toFixed(2)}</span>
                <span>${tx.time}</span>
            `;
            logContainer.appendChild(entry);
        });
    }

    // ----- Chart functions -----
    function initChart() {
        const ctx = document.getElementById('priceChart').getContext('2d');
        chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: Array(MAX_HISTORY).fill(''),
                datasets: [
                    {
                        label: 'Price',
                        data: [],
                        borderColor: '#38bdf8',
                        backgroundColor: 'rgba(56,189,248,0.1)',
                        tension: 0.2,
                        pointRadius: 2
                    },
                    {
                        label: 'SMA',
                        data: [],
                        borderColor: '#fbbf24',
                        borderDash: [5,5],
                        pointRadius: 0,
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { labels: { color: '#94a3b8' } } },
                scales: {
                    x: { ticks: { display: false } },
                    y: { grid: { color: '#334155' }, ticks: { color: '#94a3b8' } }
                }
            }
        });
    }

    function updateChart() {
        if (!chart) return;
        const symbol = chartStockSelector.value;
        const prices = priceHistories[symbol] || [];
        const smas = smaHistories[symbol] || [];
        chart.data.datasets[0].data = prices;
        chart.data.datasets[1].data = smas;
        chart.update();
    }

    // ----- Event listeners for buttons and selects -----
    chartStockSelector.addEventListener('change', (e) => {
        selectedStock = e.target.value;
        updateChart();
    });

    sendProfitBtn.addEventListener('click', () => {
        const profit = cash - 1000;
        if (profit > 0) sendProfitToBank(profit);
    });

    withdrawAllBtn.addEventListener('click', withdrawAllProfit);

    [bankSelect, accountNumber, accountHolder].forEach(el => {
        el.addEventListener('change', saveState);
    });

    // ----- Start everything when page loads -----
    window.addEventListener('load', () => {
        initChart();
        loadState();
        tradingCycle(); // run immediately
        setInterval(tradingCycle, UPDATE_INTERVAL_MS);
    });
})();
