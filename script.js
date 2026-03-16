(function() {
    // ========== STOCK LIST (with sectors for future analysis) ==========
    const STOCKS = [
        { symbol: 'ETHTC', name: 'Ethio Telecom', basePrice: 180, sector: 'Telecom' },
        { symbol: 'AWASH', name: 'Awash Bank', basePrice: 220, sector: 'Banking' },
        { symbol: 'DASHEN', name: 'Dashen Bank', basePrice: 260, sector: 'Banking' },
        { symbol: 'CBE', name: 'Commercial Bank', basePrice: 310, sector: 'Banking' },
        { symbol: 'BGI', name: 'BGI Ethiopia', basePrice: 95, sector: 'Manufacturing' },
        { symbol: 'BERHAN', name: 'Berhan Bank', basePrice: 145, sector: 'Banking' },
        { symbol: 'ZEMEN', name: 'Zemen Bank', basePrice: 130, sector: 'Banking' }
    ];

    // ========== SETTINGS ==========
    const SMA_PERIOD = 20;
    const BUY_THRESHOLD = 1.0;
    const SELL_THRESHOLD = 1.02;
    const RISK_PER_TRADE = 0.25;
    const MAX_HISTORY = 60;
    const UPDATE_INTERVAL_MS = 8000;
    const AUTO_SEND_THRESHOLD = 200;

    // ========== REAL DATA INTEGRATION FLAG ==========
    let USE_REAL_DATA = false; // Set to true when you have Ts'ega API access

    // ========== STATE ==========
    let cash = 1000.0;                // trading account in ETB
    let bankBalance = 0.0;             // money sent to bank
    let holdings = {};                  // shares owned per stock
    let avgBuyPrices = {};               // average price paid for each stock
    let transactions = [];               // list of all events
    let profitTransfers = [];             // list of bank transfers
    let priceHistories = {};              // price history per stock
    let smaHistories = {};                // moving averages for chart
    let lastPrices = {};                  // latest price per stock
    let updateCount = 0;                  // number of updates
    let lastProfitSent = 0;                // auto-send tracking

    // Additional data for advanced analysis (placeholders for future use)
    let volumes = {};                      // trading volumes if available
    let rsiValues = {};                    // RSI per stock
    let indicators = {};                   // store all indicators

    // ========== CHART ==========
    let chart;
    let selectedStock = 'ETHTC';

    // ========== DOM ELEMENTS ==========
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
    const refreshBtn = document.getElementById('refreshBtn');
    const autoSendToggle = document.getElementById('autoSendToggle');
    const profitHistoryDiv = document.getElementById('profitHistory');
    const notification = document.getElementById('notification');
    const notificationMsg = document.getElementById('notificationMessage');
    const chartStockSelector = document.getElementById('chartStockSelector');
    const bankSelect = document.getElementById('bankSelect');
    const accountNumber = document.getElementById('accountNumber');
    const accountHolder = document.getElementById('accountHolder');
    const themeToggle = document.getElementById('themeToggle');
    const dataSourceSpan = document.getElementById('dataSource');
    const toggleDataSourceBtn = document.getElementById('toggleDataSource');

    // ========== INITIALISE PRICE HISTORIES (Simulated) ==========
    STOCKS.forEach(s => {
        holdings[s.symbol] = 0;
        avgBuyPrices[s.symbol] = 0;
        volumes[s.symbol] = [];
        let price = s.basePrice;
        priceHistories[s.symbol] = [];
        for (let i = 0; i < 30; i++) {
            price = generateNextPrice(price, s.basePrice);
            priceHistories[s.symbol].push(price);
        }
        lastPrices[s.symbol] = priceHistories[s.symbol][priceHistories[s.symbol].length - 1];
        smaHistories[s.symbol] = [];
    });

    // ========== HELPER FUNCTIONS ==========
    function generateNextPrice(prevPrice, basePrice) {
        const drift = (basePrice - prevPrice) * 0.01;
        const volatility = (Math.random() - 0.5) * 2.5;
        let newPrice = prevPrice + drift + volatility;
        return Math.max(5, parseFloat(newPrice.toFixed(2)));
    }

    function calculateSMA(prices, period) {
        if (prices.length < period) return null;
        const slice = prices.slice(-period);
        const sum = slice.reduce((a, b) => a + b, 0);
        return sum / period;
    }

    // Advanced indicators (placeholders for when real data arrives)
    function calculateRSI(prices, period = 14) {
        // RSI calculation would go here
        return 50; // placeholder
    }

    function showNotification(msg, isError = false) {
        notificationMsg.textContent = msg;
        notification.classList.add('show');
        if (isError) notification.classList.add('error');
        else notification.classList.remove('error');
        setTimeout(() => notification.classList.remove('show'), 4000);
    }

    // ========== REAL DATA FETCHING (Ts'ega Integration) ==========
    async function fetchRealMarketData() {
        // This is a placeholder for actual API call to Ts'ega portal
        // When you get API access, replace with real endpoint and authentication
        try {
            // Example: const response = await fetch('https://csdtsega.nbe.gov.et/api/market-data', {
            //     headers: { 'Authorization': 'Bearer YOUR_API_KEY' }
            // });
            // const data = await response.json();

            // For now, we simulate a delay and throw an error to fall back to mock
            await new Promise(resolve => setTimeout(resolve, 1000));
            throw new Error('Real data not configured'); // Remove this line when you have real API

            // Once you have real data, update each stock's price:
            // STOCKS.forEach(stock => {
            //     const realPrice = data.prices.find(p => p.symbol === stock.symbol);
            //     if (realPrice) {
            //         priceHistories[stock.symbol].push(realPrice.price);
            //         if (priceHistories[stock.symbol].length > MAX_HISTORY) {
            //             priceHistories[stock.symbol].shift();
            //         }
            //         lastPrices[stock.symbol] = realPrice.price;
            //         // Also capture volume if available
            //         if (realPrice.volume) {
            //             volumes[stock.symbol].push(realPrice.volume);
            //         }
            //     }
            // });
        } catch (error) {
            console.error('Real data fetch failed:', error);
            throw error; // Propagate to caller
        }
    }

    // Fallback mock price generation
    function generateMockPrices() {
        STOCKS.forEach(s => {
            const hist = priceHistories[s.symbol];
            const last = hist.length > 0 ? hist[hist.length - 1] : s.basePrice;
            const newPrice = generateNextPrice(last, s.basePrice);
            hist.push(newPrice);
            if (hist.length > MAX_HISTORY) hist.shift();
            lastPrices[s.symbol] = newPrice;
        });
    }

    // ========== BANK FUNCTIONS ==========
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

    function withdrawAllProfit() {
        const profit = cash - 1000;
        if (profit <= 0) {
            showNotification('No profit to withdraw', true);
            return;
        }
        sendProfitToBank(profit);
    }

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

    // ========== SAVE / LOAD ==========
    function saveState() {
        const state = {
            cash, bankBalance, holdings, avgBuyPrices, transactions, profitTransfers,
            priceHistories, smaHistories, lastPrices, updateCount, lastProfitSent
        };
        localStorage.setItem('esxReadyTrader', JSON.stringify(state));
    }

    function loadState() {
        const saved = localStorage.getItem('esxReadyTrader');
        if (saved) {
            try {
                const state = JSON.parse(saved);
                cash = state.cash ?? 1000;
                bankBalance = state.bankBalance ?? 0;
                holdings = state.holdings ?? {};
                avgBuyPrices = state.avgBuyPrices ?? {};
                transactions = state.transactions ?? [];
                profitTransfers = state.profitTransfers ?? [];
                priceHistories = state.priceHistories ?? {};
                smaHistories = state.smaHistories ?? {};
                lastPrices = state.lastPrices ?? {};
                updateCount = state.updateCount ?? 0;
                lastProfitSent = state.lastProfitSent ?? 0;

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
                    if (avgBuyPrices[s.symbol] === undefined) avgBuyPrices[s.symbol] = 0;
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
        avgBuyPrices = {};
        transactions = [];
        profitTransfers = [];
        priceHistories = {};
        smaHistories = {};
        lastPrices = {};
        updateCount = 0;
        lastProfitSent = 0;
        STOCKS.forEach(s => {
            holdings[s.symbol] = 0;
            avgBuyPrices[s.symbol] = 0;
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

    // ========== TRADING ENGINE (uses either real or mock data) ==========
    async function tradingCycle() {
        updateCount++;
        updateCounter.textContent = `updates: ${updateCount}`;

        try {
            if (USE_REAL_DATA) {
                // Attempt to fetch real market data
                await fetchRealMarketData();
                dataSourceSpan.textContent = 'ESX (Real)';
                dataSourceSpan.style.color = '#4ade80';
            } else {
                // Use simulated prices
                generateMockPrices();
                dataSourceSpan.textContent = 'Simulated';
                dataSourceSpan.style.color = '#94a3b8';
            }
        } catch (error) {
            // Fallback to simulation if real data fails
            console.warn('Falling back to simulated data');
            generateMockPrices();
            dataSourceSpan.textContent = 'Simulated (Fallback)';
            dataSourceSpan.style.color = '#f87171';
        }

        // Update SMAs for all stocks
        STOCKS.forEach(s => {
            const symbol = s.symbol;
            const hist = priceHistories[symbol];
            const sma = calculateSMA(hist, SMA_PERIOD);
            if (sma !== null) {
                let smaHist = smaHistories[symbol];
                smaHist.push(sma);
                if (smaHist.length > MAX_HISTORY) smaHist.shift();
            }
        });

        // Make trading decisions based on latest prices
        makeTradingDecisions();

        checkAutoSend();
        if (transactions.length > 100) transactions = transactions.slice(-100);
        saveState();
        renderUI();
        updateChart();
    }

    function makeTradingDecisions() {
        STOCKS.forEach(s => {
            const symbol = s.symbol;
            const price = lastPrices[symbol];
            const hist = priceHistories[symbol];
            const sma = calculateSMA(hist, SMA_PERIOD);
            if (sma === null) return;

            let shares = holdings[symbol] || 0;

            // BUY condition
            if (price < sma * BUY_THRESHOLD && cash > price) {
                const maxCost = cash * RISK_PER_TRADE;
                const sharesToBuy = Math.floor(maxCost / price);
                if (sharesToBuy > 0) {
                    cash -= sharesToBuy * price;
                    holdings[symbol] += sharesToBuy;
                    // Update average buy price
                    if (holdings[symbol] > 0) {
                        const oldTotal = (avgBuyPrices[symbol] || 0) * (holdings[symbol] - sharesToBuy);
                        const newTotal = sharesToBuy * price;
                        avgBuyPrices[symbol] = (oldTotal + newTotal) / holdings[symbol];
                    } else {
                        avgBuyPrices[symbol] = price;
                    }
                    transactions.push({
                        stock: symbol,
                        action: 'BUY',
                        price: price,
                        shares: sharesToBuy,
                        time: new Date().toLocaleTimeString()
                    });
                }
            }
            // SELL condition
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
                avgBuyPrices[symbol] = 0;
            }
        });
    }

    // ========== RENDER UI ==========
    function renderUI() {
        // Calculate totals
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

        const hasProfit = cash > 1000;
        sendProfitBtn.disabled = !hasProfit;
        withdrawAllBtn.disabled = !hasProfit;

        // Stock cards
        stockGrid.innerHTML = '';
        STOCKS.forEach(s => {
            const symbol = s.symbol;
            const price = lastPrices[symbol] || 0;
            const shares = holdings[symbol] || 0;
            const avgPrice = avgBuyPrices[symbol] || 0;
            const stockProfit = avgPrice > 0 ? (price - avgPrice) * shares : 0;
            const profitColor = stockProfit >= 0 ? '#4ade80' : '#f87171';
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
                <div class="stock-detail"><span>P/L</span><span style="color:${profitColor};">${stockProfit.toFixed(2)} ETB</span></div>
            `;
            stockGrid.appendChild(card);
        });

        // Transaction log
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

    // ========== CHART FUNCTIONS ==========
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

    // ========== EVENT LISTENERS ==========
    chartStockSelector.addEventListener('change', (e) => {
        selectedStock = e.target.value;
        updateChart();
    });

    sendProfitBtn.addEventListener('click', () => {
        const profit = cash - 1000;
        if (profit > 0) sendProfitToBank(profit);
    });

    withdrawAllBtn.addEventListener('click', withdrawAllProfit);

    refreshBtn.addEventListener('click', () => {
        tradingCycle();
        showNotification('Refreshed prices');
    });

    [bankSelect, accountNumber, accountHolder].forEach(el => {
        el.addEventListener('change', saveState);
    });

    // Theme toggle
    themeToggle.addEventListener('change', (e) => {
        if (e.target.checked) {
            document.body.classList.add('light-mode');
        } else {
            document.body.classList.remove('light-mode');
        }
    });

    // Toggle data source (real/simulated)
    toggleDataSourceBtn.addEventListener('click', () => {
        USE_REAL_DATA = !USE_REAL_DATA;
        toggleDataSourceBtn.textContent = USE_REAL_DATA ? 'Switch to Simulated' : 'Switch to Real (ESX)';
        showNotification(`Switched to ${USE_REAL_DATA ? 'real' : 'simulated'} data mode`);
        // Force an immediate update to reflect new data source
        tradingCycle();
    });

    // ========== START EVERYTHING ==========
    window.addEventListener('load', () => {
        initChart();
        loadState();
        tradingCycle(); // run immediately
        setInterval(tradingCycle, UPDATE_INTERVAL_MS);
    });
})();
