// Global variables
let currentWalletProvider = null;
let currentWalletAddresses = null;
let currentBalances = {};
let currentTransactionPage = 1;
let transactionHistory = [];

// Wallet provider configurations
const WALLET_PROVIDERS = {
    xverse: {
        name: 'Xverse',
        icon: 'fas fa-wallet',
        description: 'Multi-chain Bitcoin & Stacks wallet',
        detectMethod: () => window.XverseProviders?.BitcoinProvider || window.BitcoinProvider,
        capabilities: ['bitcoin', 'stacks', 'ordinals', 'runes']
    },
    leather: {
        name: 'Leather',
        icon: 'fas fa-shield-alt',
        description: 'Bitcoin & Stacks wallet',
        detectMethod: () => window.LeatherProvider || window.StacksProvider,
        capabilities: ['bitcoin', 'stacks']
    },
    unisat: {
        name: 'Unisat',
        icon: 'fas fa-coins',
        description: 'Bitcoin wallet with Ordinals support',
        detectMethod: () => window.unisat,
        capabilities: ['bitcoin', 'ordinals']
    }
};

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing application...');
    initializeApp();
    setupEventListeners();
});

function initializeApp() {
    console.log('Initializing Bitcoin & Stacks Wallet Template...');
    
    // Initialize UI
    updateConnectionStatus(false);
    setupTabNavigation();
    
    // Check for existing connections
    checkExistingConnections();
    
    console.log('Application initialized successfully');
}

function setupEventListeners() {
    // Connect button
    document.getElementById('connectBtn').addEventListener('click', openProviderModal);
    
    // Disconnect button
    document.getElementById('disconnectBtn').addEventListener('click', disconnectWallet);
    
    // Modal controls
    document.getElementById('closeModal').addEventListener('click', closeProviderModal);
    document.getElementById('providerModal').addEventListener('click', function(e) {
        if (e.target === this) closeProviderModal();
    });
    
    // Transaction type filter
    document.getElementById('transactionType').addEventListener('change', function() {
        currentTransactionPage = 1;
        refreshTransactionHistory();
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeProviderModal();
            hideError();
        }
    });
}

function setupTabNavigation() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const tabId = this.dataset.tab;
            
            // Remove active class from all tabs
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Add active class to clicked tab
            this.classList.add('active');
            document.getElementById(`${tabId}-tab`).classList.add('active');
            
            // Load data for the selected tab
            loadTabData(tabId);
        });
    });
}

async function checkExistingConnections() {
    try {
        // Check for existing connections by looking for wallet providers
        console.log('Checking for existing wallet connections...');
        
        // For now, we'll skip existing connection checks
        // In a real implementation, you would check localStorage or wallet state
        console.log('No existing connections found');
    } catch (error) {
        console.log('No existing wallet connection found:', error);
    }
}

function openProviderModal() {
    detectWalletProviders();
    document.getElementById('providerModal').classList.remove('hidden');
}

function closeProviderModal() {
    document.getElementById('providerModal').classList.add('hidden');
}

function detectWalletProviders() {
    const providerGrid = document.getElementById('providerGrid');
    providerGrid.innerHTML = '';
    
    Object.entries(WALLET_PROVIDERS).forEach(([key, provider]) => {
        const isDetected = provider.detectMethod();
        
        const providerElement = document.createElement('div');
        providerElement.className = `provider-btn ${isDetected ? 'detected' : ''}`;
        providerElement.innerHTML = `
            <div class="provider-icon">
                <i class="${provider.icon}"></i>
            </div>
            <div class="provider-info">
                <h4>${provider.name}</h4>
                <p>${provider.description}</p>
                <div class="provider-status ${isDetected ? 'detected' : 'not-detected'}">
                    ${isDetected ? 'Detected' : 'Not Available'}
                </div>
            </div>
        `;
        
        if (isDetected) {
            providerElement.addEventListener('click', () => connectToProvider(key));
        } else {
            providerElement.style.opacity = '0.5';
            providerElement.style.cursor = 'not-allowed';
        }
        
        providerGrid.appendChild(providerElement);
    });
}

async function connectToProvider(providerKey) {
    showLoading();
    
    try {
        const provider = WALLET_PROVIDERS[providerKey];
        console.log('Connecting to provider:', provider.name);
        
        let addresses = [];
        
        // Connect to different wallet providers directly
        if (providerKey === 'xverse') {
            addresses = await connectToXverse();
        } else if (providerKey === 'leather') {
            addresses = await connectToLeather();
        } else if (providerKey === 'unisat') {
            addresses = await connectToUnisat();
        } else {
            throw new Error(`Unsupported wallet provider: ${provider.name}`);
        }
        
        if (addresses.length > 0) {
            currentWalletProvider = providerKey;
            handleWalletConnection(addresses, providerKey);
            closeProviderModal();
            showToast('Wallet connected successfully!', 'success');
        } else {
            throw new Error('No addresses received from wallet');
        }
    } catch (error) {
        console.error('Wallet connection error:', error);
        showError(`Failed to connect to wallet: ${error.message}`);
    } finally {
        hideLoading();
    }
}

// Direct wallet connection functions
async function connectToXverse() {
    if (!window.XverseProviders?.BitcoinProvider) {
        throw new Error('Xverse wallet is not installed');
    }
    
    try {
        const bitcoin = window.XverseProviders.BitcoinProvider;
        const result = await bitcoin.request('getAccounts', {
            purposes: ['payment', 'ordinals', 'stacks'],
            message: 'Connect to Xverse wallet'
        });
        
        return result.result || [];
    } catch (error) {
        throw new Error(`Xverse connection failed: ${error.message}`);
    }
}

async function connectToLeather() {
    if (!window.LeatherProvider) {
        throw new Error('Leather wallet is not installed');
    }
    
    try {
        console.log('Connecting to Leather wallet...');
        
        // Leather wallet uses the @stacks/connect pattern
        const response = await window.LeatherProvider.request('getAddresses', null);
        console.log('Leather getAddresses response:', response);
        
        if (response && response.result && response.result.addresses) {
            const addresses = response.result.addresses;
            console.log('Leather addresses:', addresses);
            
            // Convert Leather address format to our expected format
            const formattedAddresses = addresses.map(addr => {
                if (addr.symbol === 'BTC' && addr.type === 'p2wpkh') {
                    return { address: addr.address, purpose: 'payment', publicKey: addr.publicKey };
                } else if (addr.symbol === 'BTC' && addr.type === 'p2tr') {
                    return { address: addr.address, purpose: 'ordinals', publicKey: addr.publicKey };
                } else if (addr.symbol === 'STX') {
                    return { address: addr.address, purpose: 'stacks', publicKey: addr.publicKey };
                }
                return { address: addr.address, purpose: 'payment', publicKey: addr.publicKey };
            });
            
            return formattedAddresses;
        }
        
        throw new Error(`Failed to get addresses. Response: ${JSON.stringify(response)}`);
    } catch (error) {
        console.error('Leather connection error details:', error);
        throw new Error(`Leather connection failed: ${error.message || 'Unknown error'}`);
    }
}

async function connectToUnisat() {
    if (!window.unisat) {
        throw new Error('Unisat wallet is not installed');
    }
    
    try {
        const accounts = await window.unisat.requestAccounts();
        return accounts.map(address => ({ address, purpose: 'payment' }));
    } catch (error) {
        throw new Error(`Unisat connection failed: ${error.message}`);
    }
}

function handleWalletConnection(addresses, providerKey) {
    currentWalletAddresses = addresses;
    currentWalletProvider = providerKey;
    
    // Update UI
    updateConnectionStatus(true);
    displayWalletInfo(addresses, providerKey);
    
    // Load initial data
    loadTabData('bitcoin');
}

function updateConnectionStatus(connected) {
    const statusIndicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('statusText');
    const connectBtn = document.getElementById('connectBtn');
    const disconnectBtn = document.getElementById('disconnectBtn');
    const walletInfo = document.getElementById('walletInfo');
    
    if (connected) {
        statusIndicator.className = 'status-indicator connected';
        statusText.textContent = 'Connected';
        connectBtn.classList.add('hidden');
        disconnectBtn.classList.remove('hidden');
        walletInfo.classList.remove('hidden');
    } else {
        statusIndicator.className = 'status-indicator disconnected';
        statusText.textContent = 'Not Connected';
        connectBtn.classList.remove('hidden');
        disconnectBtn.classList.add('hidden');
        walletInfo.classList.add('hidden');
    }
}

function displayWalletInfo(addresses, providerKey) {
    const provider = WALLET_PROVIDERS[providerKey];
    
    // Update provider name
    document.getElementById('walletProvider').textContent = provider.name;
    
    // Update addresses
    const paymentAddr = addresses.find(addr => addr.purpose === 'payment');
    const ordinalsAddr = addresses.find(addr => addr.purpose === 'ordinals');
    const stacksAddr = addresses.find(addr => addr.purpose === 'stacks');
    
    document.getElementById('paymentAddress').textContent = paymentAddr?.address || 'Not available';
    document.getElementById('ordinalsAddress').textContent = ordinalsAddr?.address || 'Not available';
    document.getElementById('stacksAddress').textContent = stacksAddr?.address || 'Not available';
}

async function loadTabData(tabId) {
    if (!currentWalletProvider) return;
    
    switch (tabId) {
        case 'bitcoin':
            await refreshBitcoinBalance();
            break;
        case 'stacks':
            await refreshStacksBalance();
            break;
        case 'ordinals':
            await refreshOrdinals();
            break;
        case 'runes':
            await refreshRunes();
            break;
    }
}

async function refreshBitcoinBalance() {
    if (!currentWalletProvider) return;
    
    try {
        console.log('Fetching Bitcoin balance...');
        
        let balance = null;
        
        if (currentWalletProvider === 'xverse') {
            balance = await getXverseBitcoinBalance();
        } else if (currentWalletProvider === 'leather') {
            balance = await getLeatherBitcoinBalance();
        } else if (currentWalletProvider === 'unisat') {
            balance = await getUnisatBitcoinBalance();
        }
        
        if (balance) {
            const confirmedBTC = (parseInt(balance.confirmed) / 100000000).toFixed(8);
            const unconfirmedBTC = (parseInt(balance.unconfirmed) / 100000000).toFixed(8);
            const totalBTC = (parseInt(balance.total || (parseInt(balance.confirmed) + parseInt(balance.unconfirmed))) / 100000000).toFixed(8);
            
            document.getElementById('confirmedBalance').textContent = confirmedBTC;
            document.getElementById('unconfirmedBalance').textContent = unconfirmedBTC;
            document.getElementById('totalBalance').textContent = totalBTC;
            
            currentBalances.bitcoin = balance;
        } else {
            throw new Error('Failed to fetch balance from wallet provider');
        }
    } catch (error) {
        console.error('Bitcoin balance error:', error);
        showError(`Failed to fetch Bitcoin balance: ${error.message}`);
        
        // Show error state
        document.getElementById('confirmedBalance').textContent = 'Error';
        document.getElementById('unconfirmedBalance').textContent = 'Error';
        document.getElementById('totalBalance').textContent = 'Error';
    }
}

// Balance fetching functions for different providers
async function getXverseBitcoinBalance() {
    try {
        const bitcoin = window.XverseProviders.BitcoinProvider;
        const response = await bitcoin.request('getBalance', undefined);
        return response.result;
    } catch (error) {
        throw new Error(`Xverse balance error: ${error.message}`);
    }
}

async function getLeatherBitcoinBalance() {
    try {
        // Get Bitcoin address from connected addresses
        const btcAddress = currentWalletAddresses.find(addr => addr.purpose === 'payment')?.address;
        if (!btcAddress) {
            throw new Error('No Bitcoin address found');
        }
        
        // Fetch balance from Blockstream API
        const response = await fetch(`https://blockstream.info/api/address/${btcAddress}`);
        if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
        }
        
        const data = await response.json();
        
        return {
            confirmed: data.chain_stats.funded_txo_sum.toString(),
            unconfirmed: data.mempool_stats.funded_txo_sum.toString(),
            total: (data.chain_stats.funded_txo_sum + data.mempool_stats.funded_txo_sum).toString()
        };
    } catch (error) {
        throw new Error(`Leather balance error: ${error.message}`);
    }
}

async function getUnisatBitcoinBalance() {
    try {
        const balance = await window.unisat.getBalance();
        return {
            confirmed: balance.confirmed.toString(),
            unconfirmed: balance.unconfirmed.toString(),
            total: balance.total.toString()
        };
    } catch (error) {
        throw new Error(`Unisat balance error: ${error.message}`);
    }
}

async function refreshStacksBalance() {
    if (!currentWalletProvider) return;
    
    try {
        console.log('Fetching Stacks balance...');
        
        let balance = null;
        
        if (currentWalletProvider === 'xverse') {
            balance = await getXverseStacksBalance();
        } else if (currentWalletProvider === 'leather') {
            balance = await getLeatherStacksBalance();
        } else {
            throw new Error('Stacks not supported by this wallet provider');
        }
        
        if (balance) {
            const stxBalance = (parseInt(balance.available) / 1000000).toFixed(6);
            const lockedBalance = (parseInt(balance.locked || 0) / 1000000).toFixed(6);
            
            document.getElementById('stxBalance').textContent = stxBalance;
            document.getElementById('lockedStxBalance').textContent = lockedBalance;
            
            currentBalances.stacks = balance;
        } else {
            throw new Error('Failed to fetch Stacks balance');
        }
    } catch (error) {
        console.error('Stacks balance error:', error);
        showError(`Failed to fetch Stacks balance: ${error.message}`);
        
        document.getElementById('stxBalance').textContent = 'Error';
        document.getElementById('lockedStxBalance').textContent = 'Error';
    }
}

async function getXverseStacksBalance() {
    try {
        // Get Stacks address from connected addresses
        const stxAddress = currentWalletAddresses.find(addr => addr.purpose === 'stacks')?.address;
        if (!stxAddress) {
            throw new Error('No Stacks address found');
        }
        
        // Fetch balance from Stacks API since Xverse doesn't have direct balance method
        const response = await fetch(`https://api.hiro.so/extended/v1/address/${stxAddress}/balances`);
        if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
        }
        
        const data = await response.json();
        
        return {
            available: data.stx.balance || '0',
            locked: data.stx.locked || '0'
        };
    } catch (error) {
        throw new Error(`Xverse Stacks error: ${error.message}`);
    }
}

async function getLeatherStacksBalance() {
    try {
        // Get Stacks address from connected addresses
        const stxAddress = currentWalletAddresses.find(addr => addr.purpose === 'stacks')?.address;
        if (!stxAddress) {
            throw new Error('No Stacks address found');
        }
        
        // Fetch balance from Stacks API
        const response = await fetch(`https://api.hiro.so/extended/v1/address/${stxAddress}/balances`);
        if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
        }
        
        const data = await response.json();
        
        return {
            available: data.stx.balance || '0',
            locked: data.stx.locked || '0'
        };
    } catch (error) {
        throw new Error(`Leather Stacks error: ${error.message}`);
    }
}

async function refreshOrdinals() {
    if (!currentWalletProvider) return;
    
    try {
        console.log('Fetching Ordinals...');
        
        let ordinals = null;
        
        if (currentWalletProvider === 'xverse') {
            ordinals = await getXverseOrdinals();
        } else if (currentWalletProvider === 'unisat') {
            ordinals = await getUnisatOrdinals();
        } else {
            throw new Error('Ordinals not supported by this wallet provider');
        }
        
        const ordinalsGrid = document.getElementById('ordinalsGrid');
        
        if (!ordinals || ordinals.length === 0) {
            ordinalsGrid.innerHTML = `
                <div class="no-data">
                    <i class="fas fa-gem"></i>
                    <p>No ordinals found</p>
                </div>
            `;
            return;
        }
        
        ordinalsGrid.innerHTML = ordinals.map(ordinal => `
            <div class="ordinal-item">
                <img src="${ordinal.content_type === 'image/png' || ordinal.content_type === 'image/jpeg' ? ordinal.content_url : '/api/placeholder/150/150'}" alt="Ordinal ${ordinal.id}" />
                <div class="ordinal-info">
                    <h4>Ordinal #${ordinal.id}</h4>
                    <p><strong>Type:</strong> ${ordinal.content_type}</p>
                    <p><strong>Size:</strong> ${ordinal.content_length} bytes</p>
                </div>
            </div>
        `).join('');
        
        currentBalances.ordinals = ordinals;
    } catch (error) {
        console.error('Ordinals error:', error);
        const ordinalsGrid = document.getElementById('ordinalsGrid');
        ordinalsGrid.innerHTML = `
            <div class="no-data">
                <i class="fas fa-gem"></i>
                <p>Error loading ordinals: ${error.message}</p>
            </div>
        `;
    }
}

async function getXverseOrdinals() {
    try {
        const bitcoin = window.XverseProviders.BitcoinProvider;
        const response = await bitcoin.request('ord_getInscriptions', undefined);
        return response.result;
    } catch (error) {
        throw new Error(`Xverse ordinals error: ${error.message}`);
    }
}

async function getUnisatOrdinals() {
    try {
        const inscriptions = await window.unisat.getInscriptions();
        return inscriptions.list || [];
    } catch (error) {
        throw new Error(`Unisat ordinals error: ${error.message}`);
    }
}

async function refreshRunes() {
    if (!currentWalletProvider) return;
    
    try {
        console.log('Fetching Runes balance...');
        
        let runes = null;
        
        if (currentWalletProvider === 'xverse') {
            runes = await getXverseRunesBalance();
        } else {
            // Other providers may not support runes
            throw new Error('Runes not supported by this wallet provider');
        }
        
        const runesGrid = document.getElementById('runesGrid');
        
        if (!runes || runes.length === 0) {
            runesGrid.innerHTML = `
                <div class="no-data">
                    <i class="fas fa-scroll"></i>
                    <p>No runes found</p>
                </div>
            `;
            return;
        }
        
        runesGrid.innerHTML = runes.map(rune => `
            <div class="rune-item">
                <h4>${rune.name || 'Unknown Rune'}</h4>
                <p><strong>Balance:</strong> ${rune.balance || '0'}</p>
                <p><strong>Symbol:</strong> ${rune.symbol || 'N/A'}</p>
                <p><strong>Decimals:</strong> ${rune.decimals || '0'}</p>
            </div>
        `).join('');
        
        currentBalances.runes = runes;
    } catch (error) {
        console.error('Runes error:', error);
        const runesGrid = document.getElementById('runesGrid');
        runesGrid.innerHTML = `
            <div class="no-data">
                <i class="fas fa-scroll"></i>
                <p>Error loading runes: ${error.message}</p>
            </div>
        `;
    }
}

async function getXverseRunesBalance() {
    try {
        const bitcoin = window.XverseProviders.BitcoinProvider;
        const response = await bitcoin.request('runes_getBalance', null);
        const runes = response.result;
        
        // Ensure we return an array
        if (Array.isArray(runes)) {
            return runes;
        } else if (runes && typeof runes === 'object') {
            // If it's an object, convert to array
            return Object.keys(runes).map(key => ({
                name: key,
                balance: runes[key].balance || '0',
                symbol: runes[key].symbol || key,
                decimals: runes[key].decimals || 0
            }));
        } else {
            return [];
        }
    } catch (error) {
        throw new Error(`Xverse runes error: ${error.message}`);
    }
}

async function refreshTransactionHistory() {
    if (!currentWalletProvider) return;
    
    try {
        console.log('Fetching transaction history...');
        const transactionType = document.getElementById('transactionType').value;
        const tableBody = document.getElementById('transactionTableBody');
        
        let transactions = null;
        
        if (currentWalletProvider === 'xverse') {
            transactions = await getXverseTransactionHistory(transactionType);
        } else if (currentWalletProvider === 'leather') {
            transactions = await getLeatherTransactionHistory(transactionType);
        } else if (currentWalletProvider === 'unisat') {
            transactions = await getUnisatTransactionHistory(transactionType);
        } else {
            throw new Error('Transaction history not supported by this wallet provider');
        }
        
        if (!transactions || transactions.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="no-data">
                        <i class="fas fa-history"></i>
                        <p>No transactions found</p>
                    </td>
                </tr>
            `;
            return;
        }
        
        tableBody.innerHTML = transactions.map(tx => `
            <tr>
                <td>${truncateAddress(tx.txid, 8, 8)}</td>
                <td>${tx.type || 'Transfer'}</td>
                <td>${formatSatoshis(tx.amount)}</td>
                <td>${tx.status || 'Confirmed'}</td>
                <td>${formatDate(tx.timestamp)}</td>
                <td>
                    <a href="https://mempool.space/tx/${tx.txid}" target="_blank" rel="noopener noreferrer">
                        <i class="fas fa-external-link-alt"></i>
                    </a>
                </td>
            </tr>
        `).join('');
        
        transactionHistory = transactions;
    } catch (error) {
        console.error('Transaction history error:', error);
        const tableBody = document.getElementById('transactionTableBody');
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="no-data">
                    <i class="fas fa-history"></i>
                    <p>Error loading transactions: ${error.message}</p>
                </td>
            </tr>
        `;
    }
}

async function getXverseTransactionHistory(type) {
    try {
        // Get appropriate address based on transaction type
        let address;
        if (type === 'stacks') {
            address = currentWalletAddresses.find(addr => addr.purpose === 'stacks')?.address;
        } else {
            address = currentWalletAddresses.find(addr => addr.purpose === 'payment')?.address;
        }
        
        if (!address) {
            throw new Error('No address found for transaction type');
        }
        
        let transactions = [];
        
        if (type === 'stacks') {
            // Fetch Stacks transactions
            const response = await fetch(`https://api.hiro.so/extended/v1/address/${address}/transactions`);
            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }
            
            const data = await response.json();
            transactions = data.results.slice(0, 10).map(tx => ({
                txid: tx.tx_id,
                type: tx.tx_type,
                amount: tx.fee_rate || 0,
                status: tx.tx_status,
                timestamp: new Date(tx.burn_block_time_iso).getTime()
            }));
        } else {
            // Fetch Bitcoin transactions
            const response = await fetch(`https://blockstream.info/api/address/${address}/txs`);
            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }
            
            const data = await response.json();
            transactions = data.slice(0, 10).map(tx => ({
                txid: tx.txid,
                type: 'bitcoin',
                amount: tx.fee || 0,
                status: tx.status.confirmed ? 'confirmed' : 'pending',
                timestamp: tx.status.block_time * 1000
            }));
        }
        
        return transactions;
    } catch (error) {
        throw new Error(`Xverse transaction history error: ${error.message}`);
    }
}

async function getLeatherTransactionHistory(type) {
    try {
        // Get appropriate address based on transaction type
        let address;
        if (type === 'stacks') {
            address = currentWalletAddresses.find(addr => addr.purpose === 'stacks')?.address;
        } else {
            address = currentWalletAddresses.find(addr => addr.purpose === 'payment')?.address;
        }
        
        if (!address) {
            throw new Error('No address found for transaction type');
        }
        
        let transactions = [];
        
        if (type === 'stacks') {
            // Fetch Stacks transactions
            const response = await fetch(`https://api.hiro.so/extended/v1/address/${address}/transactions`);
            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }
            
            const data = await response.json();
            transactions = data.results.slice(0, 10).map(tx => ({
                txid: tx.tx_id,
                type: tx.tx_type,
                amount: tx.fee_rate || 0,
                status: tx.tx_status,
                timestamp: new Date(tx.burn_block_time_iso).getTime()
            }));
        } else {
            // Fetch Bitcoin transactions
            const response = await fetch(`https://blockstream.info/api/address/${address}/txs`);
            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }
            
            const data = await response.json();
            transactions = data.slice(0, 10).map(tx => ({
                txid: tx.txid,
                type: 'bitcoin',
                amount: tx.fee || 0,
                status: tx.status.confirmed ? 'confirmed' : 'pending',
                timestamp: tx.status.block_time * 1000
            }));
        }
        
        return transactions;
    } catch (error) {
        throw new Error(`Leather transaction history error: ${error.message}`);
    }
}

async function getUnisatTransactionHistory(type) {
    try {
        const transactions = await window.unisat.getBitcoinUtxos();
        return transactions.map(utxo => ({
            txid: utxo.txId,
            type: 'UTXO',
            amount: utxo.satoshis,
            status: 'Confirmed',
            timestamp: Date.now()
        }));
    } catch (error) {
        throw new Error(`Unisat transaction history error: ${error.message}`);
    }
}

function disconnectWallet() {
    // Reset global variables
    currentWalletProvider = null;
    currentWalletAddresses = null;
    currentBalances = {};
    currentTransactionPage = 1;
    transactionHistory = [];
    
    // Update UI
    updateConnectionStatus(false);
    
    // Clear wallet info
    document.getElementById('walletProvider').textContent = '-';
    document.getElementById('paymentAddress').textContent = '-';
    document.getElementById('ordinalsAddress').textContent = '-';
    document.getElementById('stacksAddress').textContent = '-';
    
    // Clear balances
    document.getElementById('confirmedBalance').textContent = '-';
    document.getElementById('unconfirmedBalance').textContent = '-';
    document.getElementById('totalBalance').textContent = '-';
    document.getElementById('stxBalance').textContent = '-';
    document.getElementById('lockedStxBalance').textContent = '-';
    
    // Clear grids
    document.getElementById('ordinalsGrid').innerHTML = `
        <div class="no-data">
            <i class="fas fa-gem"></i>
            <p>No ordinals data available</p>
        </div>
    `;
    
    document.getElementById('runesGrid').innerHTML = `
        <div class="no-data">
            <i class="fas fa-scroll"></i>
            <p>No runes data available</p>
        </div>
    `;
    
    // Clear transaction history
    document.getElementById('transactionTableBody').innerHTML = `
        <tr>
            <td colspan="6" class="no-data">
                <i class="fas fa-history"></i>
                <p>No transaction history available</p>
            </td>
        </tr>
    `;
    
    showToast('Wallet disconnected successfully', 'success');
}

// Utility functions
function copyToClipboard(elementId) {
    const element = document.getElementById(elementId);
    const text = element.textContent;
    
    if (text === '-' || text === 'Not available') {
        showToast('No address to copy', 'error');
        return;
    }
    
    navigator.clipboard.writeText(text).then(() => {
        showToast('Address copied to clipboard', 'success');
    }).catch(() => {
        showToast('Failed to copy address', 'error');
    });
}

function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? 'fas fa-check' : 
                type === 'error' ? 'fas fa-exclamation-triangle' : 
                'fas fa-info-circle';
    
    toast.innerHTML = `
        <i class="${icon}"></i>
        <span>${message}</span>
    `;
    
    toastContainer.appendChild(toast);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        toast.remove();
    }, 5000);
}

function showError(message) {
    const errorContainer = document.getElementById('errorContainer');
    const errorText = document.getElementById('errorText');
    
    errorText.textContent = message;
    errorContainer.classList.remove('hidden');
    
    // Auto hide after 10 seconds
    setTimeout(() => {
        hideError();
    }, 10000);
}

function hideError() {
    document.getElementById('errorContainer').classList.add('hidden');
}

function showLoading() {
    document.getElementById('loadingOverlay').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.add('hidden');
}

// Format utilities
function formatSatoshis(satoshis) {
    return (parseInt(satoshis) / 100000000).toFixed(8);
}

function formatDate(timestamp) {
    return new Date(timestamp * 1000).toLocaleDateString();
}

function truncateAddress(address, start = 6, end = 4) {
    if (!address || address.length <= start + end) return address;
    return `${address.substring(0, start)}...${address.substring(address.length - end)}`;
}

// Error handling for unhandled promises
window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection:', event.reason);
    showError(`Unexpected error: ${event.reason?.message || 'Unknown error'}`);
});

// Export functions for global access
window.refreshBitcoinBalance = refreshBitcoinBalance;
window.refreshStacksBalance = refreshStacksBalance;
window.refreshOrdinals = refreshOrdinals;
window.refreshRunes = refreshRunes;
window.refreshTransactionHistory = refreshTransactionHistory;
window.copyToClipboard = copyToClipboard;
window.hideError = hideError;
