// API base URL - Get the current path to support reverse proxy with subpath
const API_BASE = window.location.origin + window.location.pathname.replace(/\/$/, '');

// Global state
let selectedFile = null;
let selectedFileExtension = ''; // Store detected file extension
let walletConnected = false;
let currentAddress = null;
let maxFileSize = 10485760; // Default 10MB, will be fetched from server
let swaggerBaseUrl = ''; // Swagger base URL from server config

// DOM elements
const connectBtn = document.getElementById('connectBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const uploadBtn = document.getElementById('uploadBtn');
const walletStatus = document.getElementById('walletStatus');
const walletAddress = document.getElementById('walletAddress');
const addressText = document.getElementById('addressText');
const walletAlert = document.getElementById('walletAlert');
const progress = document.getElementById('progress');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const logContainer = document.getElementById('logContainer');
const maxFileSizeText = document.getElementById('maxFileSizeText');

// Buzz related DOM elements
const buzzSection = document.getElementById('buzzSection');
const buzzContent = document.getElementById('buzzContent');
const buzzHost = document.getElementById('buzzHost');
const sendBuzzBtn = document.getElementById('sendBuzzBtn');

// Initialization
window.addEventListener('load', () => {
    console.log('🚀 Page loaded, starting initialization...');
    console.log('🌐 Current URL info:', {
        origin: window.location.origin,
        pathname: window.location.pathname,
        href: window.location.href,
        API_BASE: API_BASE
    });
    loadConfig(); // Load config
    initWalletCheck();
    initDragDrop();
    initEventListeners();
    updateUploadButton(); // Initialize upload button state
    updateBuzzButton(); // Initialize buzz button state
    
    // Test buzz section display
    console.log('🧪 Testing buzz section display...');
    console.log('🧪 buzzSection element:', buzzSection);
    if (buzzSection) {
        console.log('🧪 buzzSection found, testing display...');
        buzzSection.classList.remove('hidden');
        console.log('🧪 buzzSection classes after test:', buzzSection.className);
        // Hide it again for now
        buzzSection.classList.add('hidden');
    }
    
    addLog('Page initialization complete', 'info');
});

// Load configuration
async function loadConfig() {
    try {
        addLog('Loading service configuration...', 'info');
        const response = await fetch(`${API_BASE}/api/v1/config`);
        const result = await response.json();
        
        if (result.code === 0 && result.data) {
            maxFileSize = result.data.maxFileSize;
            swaggerBaseUrl = result.data.swaggerBaseUrl || '';
            
            const sizeText = formatFileSize(maxFileSize);
            maxFileSizeText.textContent = sizeText;
            addLog(`File size limit: ${sizeText}`, 'success');
            console.log('✅ Configuration loaded successfully:', result.data);
            
            // Update Swagger link if baseUrl is configured
            updateSwaggerLink();
        } else {
            throw new Error(result.message || 'Failed to load configuration');
        }
    } catch (error) {
        console.error('❌ Failed to load configuration:', error);
        maxFileSizeText.textContent = formatFileSize(maxFileSize) + ' (default)';
        addLog('Failed to load configuration, using default values', 'error');
    }
}

// Update Swagger documentation link
function updateSwaggerLink() {
    console.log('🔍 Updating Swagger link, swaggerBaseUrl:', swaggerBaseUrl);
    
    const swaggerLink = document.getElementById('swaggerLink');
    console.log('🔍 swaggerLink element:', swaggerLink);
    
    if (!swaggerLink) {
        console.warn('⚠️ swaggerLink element not found!');
        return;
    }
    
    if (swaggerBaseUrl) {
        // Build Swagger URL based on baseUrl
        // swaggerBaseUrl format examples:
        // - "localhost:7282" -> use relative path /swagger/index.html
        // - "file.metaid.io/metafile-uploader" -> https://file.metaid.io/metafile-uploader/swagger/index.html
        
        let swaggerUrl = 'swagger/index.html'; // default (relative path)
        
        if (swaggerBaseUrl.includes('/')) {
            // Contains path, likely a proxied URL
            const protocol = window.location.protocol;
            swaggerUrl = `${protocol}//${swaggerBaseUrl}/swagger/index.html`;
            console.log(`📝 URL with path detected, protocol: ${protocol}, result: ${swaggerUrl}`);
        } else if (!swaggerBaseUrl.includes('localhost') && !swaggerBaseUrl.includes('127.0.0.1')) {
            // External domain without path
            swaggerUrl = `https://${swaggerBaseUrl}/swagger/index.html`;
            console.log(`📝 External domain detected, result: ${swaggerUrl}`);
        } else {
            console.log(`📝 Local development, using relative path: ${swaggerUrl}`);
        }
        
        swaggerLink.href = swaggerUrl;
        console.log('📚 Swagger URL updated:', swaggerUrl);
    } else {
        console.log('⚠️ swaggerBaseUrl is empty, keeping default link');
    }
}

// Check Metalet wallet
function initWalletCheck() {
    if (typeof window.metaidwallet === 'undefined') {
        addLog('Metalet wallet extension not detected', 'error');
        walletAlert.classList.remove('hidden');
    } else {
        addLog('Metalet wallet extension installed', 'info');
        
        // Check available methods
        console.log('🔍 Metalet wallet available methods:', Object.keys(window.metaidwallet));
        
        // Check signing methods
        const signMethods = [];
        if (typeof window.metaidwallet.pay === 'function') {
            signMethods.push('pay (recommended)');
        }
        if (typeof window.metaidwallet.signTransactions === 'function') {
            signMethods.push('signTransactions');
        }
        if (typeof window.metaidwallet.signTransaction === 'function') {
            signMethods.push('signTransaction');
        }
        if (typeof window.metaidwallet.signRawTransaction === 'function') {
            signMethods.push('signRawTransaction');
        }
        if (window.metaidwallet.btc && typeof window.metaidwallet.btc.signTransaction === 'function') {
            signMethods.push('btc.signTransaction');
        }
        
        if (signMethods.length > 0) {
            console.log('✅ Supported signing methods:', signMethods);
            addLog(`Supported signing methods: ${signMethods.join(', ')}`, 'info');
        } else {
            console.warn('⚠️ No standard signing method detected');
        }
    }
}

// Initialize drag and drop upload
function initDragDrop() {
    console.log('📁 Initializing drag and drop upload...');
    console.log('dropZone:', dropZone);
    console.log('fileInput:', fileInput);
    
    // Click to select file
    dropZone.addEventListener('click', () => {
        console.log('🔘 Drop zone clicked');
        fileInput.click();
    });

    // File selection
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    });

    // Drag events
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        
        if (e.dataTransfer.files.length > 0) {
            handleFile(e.dataTransfer.files[0]);
        }
    });
}

// Initialize event listeners
function initEventListeners() {
    console.log('📌 Initializing event listeners...');
    console.log('connectBtn:', connectBtn);
    console.log('disconnectBtn:', disconnectBtn);
    console.log('uploadBtn:', uploadBtn);
    
    // Connect wallet button
    if (connectBtn) {
        connectBtn.addEventListener('click', () => {
            console.log('🔘 Connect wallet button clicked');
            connectWallet();
        });
    } else {
        console.error('❌ connectBtn element not found!');
    }
    
    // Disconnect wallet button
    if (disconnectBtn) {
        disconnectBtn.addEventListener('click', () => {
            console.log('🔘 Disconnect wallet button clicked');
            disconnectWallet();
        });
    } else {
        console.error('❌ disconnectBtn element not found!');
    }
    
    // Upload button
    if (uploadBtn) {
        uploadBtn.addEventListener('click', startUpload);
    } else {
        console.error('❌ uploadBtn element not found!');
    }
    
    // Refresh balance button
    const refreshBalanceBtn = document.getElementById('refreshBalanceBtn');
    if (refreshBalanceBtn) {
        refreshBalanceBtn.addEventListener('click', () => {
            console.log('🔄 Refresh balance button clicked');
            if (walletConnected) {
                fetchAndDisplayBalance();
            } else {
                showNotification('Please connect wallet first', 'warning');
            }
        });
    }
    
    // Send buzz button
    if (sendBuzzBtn) {
        sendBuzzBtn.addEventListener('click', () => {
            console.log('📝 Send buzz button clicked');
            sendBuzz();
        });
    }
    
    // Buzz content input listener (removed - no longer needed for button state)
    
    // ShowNow button for file host input
    const showNowBtn = document.getElementById('showNowBtn');
    if (showNowBtn) {
        showNowBtn.addEventListener('click', () => {
            console.log('📱 ShowNow button clicked');
            const fileHostInput = document.getElementById('fileHostInput');
            if (fileHostInput) {
                const showNowAddress = 'bc1p20k3x2c4mglfxr5wa5sgtgechwstpld80kru2cg4gmm4urvuaqqsvapxu0';
                fileHostInput.value = showNowAddress;
                addLog(`📱 ShowNow address filled: ${showNowAddress}`, 'info');
                showNotification('ShowNow address filled', 'success');
            }
        });
    }
    
    // ShowNow button for buzz host input
    const buzzShowNowBtn = document.getElementById('buzzShowNowBtn');
    if (buzzShowNowBtn) {
        buzzShowNowBtn.addEventListener('click', () => {
            console.log('📱 Buzz ShowNow button clicked');
            const buzzHostInput = document.getElementById('buzzHost');
            if (buzzHostInput) {
                const showNowAddress = 'bc1p20k3x2c4mglfxr5wa5sgtgechwstpld80kru2cg4gmm4urvuaqqsvapxu0';
                buzzHostInput.value = showNowAddress;
                addLog(`📱 Buzz ShowNow address filled: ${showNowAddress}`, 'info');
                showNotification('Buzz ShowNow address filled', 'success');
            }
        });
    }
}

// Handle file
function handleFile(file) {
    // Validate file size
    if (file.size > maxFileSize) {
        const maxSizeText = formatFileSize(maxFileSize);
        const fileSizeText = formatFileSize(file.size);
        showNotification(`File too large! File size: ${fileSizeText}, Max limit: ${maxSizeText}`, 'error');
        addLog(`File size exceeds limit: ${fileSizeText} > ${maxSizeText}`, 'error');
        return;
    }
    
    selectedFile = file;
    
    // Build contentType (file type + ;binary)
    let contentType = file.type || 'application/octet-stream';
    if (!contentType.includes(';binary')) {
        contentType = contentType + ';binary';
    }
    
    // Detect file extension and store it globally
    const detectedExtension = getFileExtension(file);
    selectedFileExtension = detectedExtension;
    
    // Display file information
    document.getElementById('fileName').textContent = file.name;
    document.getElementById('fileSize').textContent = formatFileSize(file.size);
    document.getElementById('fileType').textContent = file.type || 'Unknown';
    document.getElementById('fileExtension').textContent = detectedExtension || '(none)';
    document.getElementById('fileContentType').textContent = contentType;
    
    fileInfo.classList.add('show');
    dropZone.classList.add('has-file');
    
    // Auto-fill path
    const pathInput = document.getElementById('pathInput');
    if (pathInput.value === '/file') {
        pathInput.value = '/file';
    }
    
    // Enable upload button
    updateUploadButton();
    
    addLog(`File selected: ${file.name} (${formatFileSize(file.size)})`, 'info');
    addLog(`📄 ContentType: ${contentType}`, 'info');
    addLog(`📎 Detected Extension: ${detectedExtension || '(none)'}`, 'info');
    showNotification(`File selected: ${file.name}`, 'success');
}

// Connect wallet
async function connectWallet() {
    console.log('🔵 Starting to connect wallet...');
    console.log('window.metaidwallet:', window.metaidwallet);
    
    if (typeof window.metaidwallet === 'undefined') {
        showNotification('Please install Metalet wallet extension first!', 'error');
        addLog('❌ Metalet wallet not detected', 'error');
        window.open('https://www.metalet.space/', '_blank');
        return;
    }

    try {
        connectBtn.disabled = true;
        connectBtn.textContent = 'Connecting...';
        
        addLog('Requesting to connect Metalet wallet...', 'info');
        console.log('📡 Calling window.metaidwallet.connect()...');
        
        // Connect wallet
        const account = await window.metaidwallet.connect();
        
        console.log('✅ Wallet response:', account);
        
        // Compatible with different wallet API versions
        // New version may return address, old version returns mvcAddress
        const address = account.address || account.mvcAddress || account.btcAddress;
        
        if (account && address) {
            currentAddress = address;
            walletConnected = true;
            
            walletStatus.textContent = 'Connected';
            walletStatus.style.color = '#28a745';
            
            // Display address
            addressText.textContent = currentAddress;
            
            // Calculate and display MetaID
            const metaId = await calculateMetaID(currentAddress);
            const metaidText = document.getElementById('metaidText');
            if (metaidText) {
                metaidText.textContent = metaId;
            }
            
            walletAddress.classList.remove('hidden');
            walletAlert.classList.add('hidden');
            
            connectBtn.textContent = '✓ Connected';
            connectBtn.classList.remove('btn-primary');
            connectBtn.classList.add('btn-success');
            connectBtn.classList.add('hidden');
            
            // show disconnect button
            disconnectBtn.classList.remove('hidden');
            
            updateUploadButton();
            updateBuzzButton();
            
            addLog(`✅ Wallet connected successfully`, 'success');
            addLog(`📍 Address: ${currentAddress}`, 'info');
            addLog(`🔑 MetaID: ${metaId}`, 'info');
            showNotification('Wallet connected successfully!', 'success');
            
            // fetch and display balance
            await fetchAndDisplayBalance();
        } else {
            console.error('❌ wallet returned data format error:', account);
            throw new Error('wallet returned data format error,valid address field not found');
        }
    } catch (error) {
        console.error('❌ failed to connect wallet:', error);
        console.error('error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        
        // handle user cancellation
        if (error.message && (
            error.message.includes('User canceled') || 
            error.message.includes('user cancelled') ||
            error.message.includes('User rejected') ||
            error.message.includes('canceled')
        )) {
            addLog('⚠️ user cancelled connection', 'error');
            showNotification('wallet connection cancelled', 'warning');
        } else {
            addLog(`❌ failed to connect wallet: ${error.message}`, 'error');
            showNotification('failed to connect wallet: ' + error.message, 'error');
        }
        
        connectBtn.disabled = false;
        connectBtn.textContent = 'Connect Metalet Wallet';
    }
}

// Disconnect walletconnect
function disconnectWallet() {
    console.log('🔌 disconnect wallet');
    
    // reset status
    walletConnected = false;
    currentAddress = null;
    
    // update UI
    walletStatus.textContent = 'Not Connected';
    walletStatus.style.color = '#999';
    walletAddress.classList.add('hidden');
    
    // hide balance info
    const balanceInfo = document.getElementById('balanceInfo');
    if (balanceInfo) {
        balanceInfo.classList.add('hidden');
    }
    
    // show connect button, hide disconnect button
    connectBtn.textContent = 'Connect Metalet Wallet';
    connectBtn.classList.remove('btn-success', 'hidden');
    connectBtn.classList.add('btn-primary');
    connectBtn.disabled = false;
    
    disconnectBtn.classList.add('hidden');
    
    // Update upload button state
    updateUploadButton();
    updateBuzzButton();
    
    addLog('🔌 Wallet disconnected', 'info');
    showNotification('Wallet disconnected', 'info');
}

// Update upload button state
function updateUploadButton() {
    const canUpload = selectedFile && walletConnected;
    uploadBtn.disabled = !canUpload;
    
    // update button text hint
    if (!walletConnected && !selectedFile) {
        uploadBtn.textContent = '🚀 Please connect wallet firstand select file';
    } else if (!walletConnected) {
        uploadBtn.textContent = '🚀 Please connect wallet first';
    } else if (!selectedFile) {
        uploadBtn.textContent = '🚀 Please select file first';
    } else {
        uploadBtn.textContent = '🚀 Start Upload to Chain';
    }
    
    console.log('🔄 update upload button status:', {
        walletConnected,
        selectedFile: !!selectedFile,
        canUpload
    });
}

// fetch and display balance
async function fetchAndDisplayBalance() {
    try {
        addLog('Fetching wallet balance...', 'info');
        console.log('💰 call window.metaidwallet.getBalance()...');
        
        const balance = await window.metaidwallet.getBalance();
        console.log('✅ balance return result:', balance);
        
        // display balance info
        const balanceInfo = document.getElementById('balanceInfo');
        if (balanceInfo) {
            // compatible with different return formats
            let totalBalance = balance.total || balance.confirmed || balance.balance || 0;
            let confirmedBalance = balance.confirmed || balance.total || 0;
            let unconfirmedBalance = balance.unconfirmed || 0;
            
            document.getElementById('totalBalance').textContent = formatSatoshis(totalBalance);
            document.getElementById('confirmedBalance').textContent = formatSatoshis(confirmedBalance);
            document.getElementById('unconfirmedBalance').textContent = formatSatoshis(unconfirmedBalance);
            
            balanceInfo.classList.remove('hidden');
            
            addLog(`💰 Balance: ${formatSatoshis(totalBalance)} SPACE`, 'success');
            
            // check if balance is sufficient
            if (totalBalance < 1000) {
                showNotification('⚠️ balance insufficient.*satoshis, may not complete upload to chain', 'warning');
                addLog('⚠️ balance insufficient, recommend recharge', 'error');
            }
        }
    } catch (error) {
        console.error('❌ failed to get balance:', error);
        addLog(`⚠️ failed to get balance: ${error.message}`, 'error');
        // dont block flow, just warning
    }
}

// format satoshis to readable format
function formatSatoshis(satoshis) {
    const space = satoshis / 100000000;
    return `${space.toFixed(8)} SPACE (${satoshis.toLocaleString()} sats)`;
}

// calculate MetaID（address SHA256 hash）
async function calculateMetaID(address) {
    try {
        // convert address string to Uint8Array
        const encoder = new TextEncoder();
        const data = encoder.encode(address);
        
        // calculate SHA256
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        
        // convert to hex string
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        
        console.log(`🔑 MetaID calculate: SHA256("${address}") = ${hashHex}`);
        return hashHex;
    } catch (error) {
        console.error('❌ calculate MetaID failed:', error);
        return 'calculatefailed';
    }
}

// Start uploadflow
async function startUpload() {
    // validate wallet connection
    if (!walletConnected) {
        showNotification('⚠️ please connect Metalet Wallet', 'warning');
        addLog('❌ walletNot Connected', 'error');
        return;
    }
    
    // validate file selection
    if (!selectedFile) {
        showNotification('⚠️ please select file to upload to chain', 'warning');
        addLog('❌ no file selected', 'error');
        return;
    }
    
    console.log('✅ validation passed: wallet connected, file selected');
    addLog('Start Upload to Chainflow...', 'info');

    try {
        uploadBtn.disabled = true;
        uploadBtn.textContent = 'Uploading to chain...';
        progress.classList.add('show');
        
        showNotification('Start Upload to Chainflow...', 'info');
        
        // step 1: pre-upload
        updateProgress(10, 'step 1/4: build transaction...');
        const preUploadResult = await preUpload();
        
        // check if file is alreadyupload to chain successful
        if (preUploadResult.status === 'success') {
            updateProgress(100, 'file already exists!');
            addLog(`✅ this file has been uploaded to chain successfully!`, 'success');
            
            // show link
            showUploadSuccessLinks(preUploadResult.txId, preUploadResult.pinId);
            
            // show buzz section for existing file
            console.log('📝 File already exists, showing buzz section with pinId:', preUploadResult.pinId);
            showBuzzSection(preUploadResult.pinId);
            
            uploadBtn.disabled = false;
            uploadBtn.textContent = '🚀 Start Upload to Chain';
            progress.classList.remove('show');
            return;
        }
        
        // step 2: get UTXO andverify balance
        updateProgress(30, 'step 2/4: verify balance...');
        const utxoData = await prepareUTXO(preUploadResult);
        
        // step 3: sign transaction
        updateProgress(50, 'step 3/4: sign transaction...');
        showNotification('please confirm signature in wallet...', 'info');
        const signedTx = await signTransaction(preUploadResult.preTxRaw, utxoData);
        
        // step 4: commit upload to chain
        updateProgress(80, 'step 4/4: broadcast transaction...');
        const commitResult = await commitUpload(preUploadResult.fileId, signedTx);
        
        // completed
        updateProgress(100, 'upload to chain completed!');
        addLog(`✅ fileupload to chain successful! TxID: ${commitResult.txId}`, 'success');
        showNotification(`🎉 fileupload to chain successful!`, 'success');
        
        // show link
        showUploadSuccessLinks(commitResult.txId, commitResult.pinId);
        
        // show buzz section after successful upload
        console.log('📝 About to show buzz section with pinId:', commitResult.pinId);
        console.log('📝 commitResult:', commitResult);
        showBuzzSection(commitResult.pinId);
        
        // setTimeout(() => {
        //     resetForm();
        // }, 5000);
        
    } catch (error) {
        console.error('upload to chain failed:', error);
        addLog(`❌ upload to chain failed: ${error.message}`, 'error');
        
        // show different hints based on error type
        if (error.message && error.message.includes('user cancelled')) {
            showNotification('upload to chain operation cancelled', 'warning');
        } else {
            showNotification('upload to chain failed: ' + error.message, 'error');
        }
        
        uploadBtn.disabled = false;
        uploadBtn.textContent = '🚀 Start Upload to Chain';
        progress.classList.remove('show');
    }
}

// pre-upload
async function preUpload() {
    addLog('call PreUpload API...', 'info');
    
    // Build contentType (file type + ;binary)
    let contentType = selectedFile.type || 'application/octet-stream';
    if (!contentType.includes(';binary')) {
        contentType = contentType + ';binary';
    }
    
    // build outputs（use wallet address）
    const outputs = [{address: currentAddress, amount: 1}];
    
    addLog(`📄 ContentType: ${contentType}`, 'info');
    addLog(`💰 Outputs: ${currentAddress} (1 satoshi)`, 'info');
    const path = document.getElementById('pathInput').value;
    
    // Add host information to path if provided
    const fileHost = document.getElementById('fileHostInput').value.trim();
    let finalPath = path;
    if (fileHost) {
        finalPath = fileHost + ':' + path;
        addLog(`🏠 File Host: ${fileHost}`, 'info');
        addLog(`📁 Final Path: ${finalPath}`, 'info');
    }
    
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('path', finalPath);
    formData.append('operation', document.getElementById('operationSelect').value);
    formData.append('contentType', contentType);
    // formData.append('changeAddress', currentAddress);
    formData.append('feeRate', document.getElementById('feeRateInput').value);
    formData.append('outputs', JSON.stringify(outputs));
    formData.append('otherOutputs', '[]');
    formData.append('metaId', await calculateMetaID(currentAddress));
    formData.append('address', currentAddress);
    
    const response = await fetch(`${API_BASE}/api/v1/files/pre-upload`, {
        method: 'POST',
        body: formData
    });
    
    if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.code !== 0) {
        throw new Error(result.message);
    }
    
    addLog(`PreUpload success, FileID: ${result.data.fileId}, MD5: ${result.data.fileMd5.substring(0, 8)}...`, 'success');
    return result.data;
}

// prepare UTXO and verify balance
async function prepareUTXO(preUploadData) {
    addLog('get wallet balance...', 'info');
    
    // get balance
    const balance = await window.metaidwallet.getBalance();
    const totalBalance = balance.total || balance.confirmed || balance.balance || 0;
    
    addLog(`💰 current balance: ${totalBalance} satoshis`, 'info');
    addLog(`💸 estimated transaction fee: ${preUploadData.calTxFee} satoshis`, 'info');
    addLog(`📏 transaction size: ${preUploadData.calTxSize} bytes`, 'info');
    
    // verify balance：80% of balance must be >= transaction fee
    const requiredBalance = preUploadData.calTxFee;
    const availableBalance = Math.floor(totalBalance * 0.8);
    
    addLog(`✓ available balance (80%): ${availableBalance} satoshis`, 'info');
    
    if (availableBalance < requiredBalance) {
        const message = `insufficient balance! need ${requiredBalance} satoshis,but available balance（80%）only ${availableBalance} satoshis。please recharge at least ${Math.ceil(requiredBalance / 0.8)} satoshis。`;
        addLog(`❌ ${message}`, 'error');
        throw new Error(message);
    }
    
    addLog(`✅ balance validation passed`, 'success');
    
    return {
        balance: balance,
        changeAddress: currentAddress
    };
}

// sign transaction
async function signTransaction(preTxRaw, utxoData) {
    addLog('opening Metalet wallet for signing...', 'info');
    console.log('📝 transaction prepared for signing:', {
        preTxRaw: preTxRaw.substring(0, 100) + '...',
        preTxRawLength: preTxRaw.length,
        address: currentAddress
    });
    
    try {
        // check wallet methods
        console.log('🔍 check available wallet methods:', Object.keys(window.metaidwallet));
        
        // use pay method（TxComposer mode）
        if (typeof window.metaidwallet.pay === 'function') {
            console.log('📡 use pay method...');
            addLog('use pay method to sign and pay...', 'info');
            
            // get meta-contract library（reference MetaID SDK）
            // library exported as window.metaContract (note lowercase c)
            const metaContract = window.metaContract;
            
            console.log('🔍 check library loading:', {
                metaContract: !!metaContract,
                metaContractKeys: metaContract ? Object.keys(metaContract) : [],
                allWindowKeys: Object.keys(window).filter(k => k.toLowerCase().includes('meta') || k.toLowerCase().includes('mvc') || k.toLowerCase().includes('tx'))
            });
            
            if (!metaContract) {
                throw new Error('meta-contract library not loaded, please refresh page');
            }
            
            // get from metaContract mvc and TxComposer
            const mvc = metaContract.mvc;
            const TxComposer = metaContract.TxComposer;
            
            if (!mvc || !TxComposer) {
                throw new Error('meta-contract library missing mvc or TxComposer');
            }
            
            console.log('✅ meta-contract library loaded');
            console.log('📦 mvc:', mvc);
            console.log('📦 TxComposer:', TxComposer);
            
            // from hex create Transaction（reference MetaID SDK）
            addLog('parse transaction hex...', 'info');
            const tx = new mvc.Transaction(preTxRaw);
            console.log('📦 parse transaction success:', tx);
            
            // create TxComposer
            addLog('create TxComposer...', 'info');
            const txComposer = new TxComposer(tx);
            console.log('🔧 TxComposer createsuccess:', txComposer);
            
            // serialize TxComposer
            addLog('serialize TxComposer...', 'info');
            const txComposerSerialize = txComposer.serialize();
            // console.log('📝 TxComposer serialize result:', txComposerSerialize);
            
            // build pay params
            const payParams = {
                transactions: [
                    {
                        txComposer: txComposerSerialize,
                        message: 'Upload File to MetaID',
                    }
                ],
                feeb: Number(document.getElementById('feeRateInput').value),
            };
            
            console.log('📡 call pay,params:', payParams);
            
            const payResult = await window.metaidwallet.pay(payParams);
            console.log('✅ pay return result:', payResult);
            
            // handle various possible return formats
            if (payResult) {
                // format 1: payedTransactions array（serialized TxComposer）
                if (payResult.payedTransactions && payResult.payedTransactions.length > 0) {
                    addLog('✅ transaction signed and paid successfully (payedTransactions)', 'success');
                    
                    // deserialize first transaction
                    const payedTxComposerStr = payResult.payedTransactions[0];
                    console.log('📦 payedTransactions[0]:', payedTxComposerStr.substring(0, 100) + '...');
                    
                    // use TxComposer.deserialize() to parse
                    const payedTxComposer = TxComposer.deserialize(payedTxComposerStr);
                    console.log('🔧 deserialize TxComposer:', payedTxComposer);
                    
                    // get signed transaction hex
                    const signedHex = payedTxComposer.getRawHex();
                    console.log('📝 signed transaction hex:', signedHex.substring(0, 100) + '...');
                    
                    addLog(`📝 transaction signed`, 'success');
                    return signedHex;
                } else {
                    throw new Error('signature failed');
                }
            }
        } else {
            throw new Error('signature failed');
        }
    } catch (error) {
        console.error('❌ signature error details:', error);
        throw new Error(`signature failed: ${error.message}`);
    }
}

// commit upload
async function commitUpload(fileId, signedRawTx) {
    addLog('call CommitUpload API, broadcast transaction to blockchain...', 'info');
    
    const response = await fetch(`${API_BASE}/api/v1/files/commit-upload`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            fileId: fileId,
            signedRawTx: signedRawTx
        })
    });
    
    if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.code !== 0) {
        throw new Error(result.message);
    }
    
    addLog(`✅ CommitUpload success!`, 'success');
    addLog(`📝 TxID: ${result.data.txId}`, 'success');
    addLog(`📊 status: ${result.data.status}`, 'success');
    
    return result.data;
}

// Update progress
function updateProgress(percent, text) {
    progressFill.style.width = percent + '%';
    progressText.textContent = text;
    addLog(`📊 progress: ${percent}% ${text}`, 'info');
}

// Add log
function addLog(message, type = 'info') {
    const logItem = document.createElement('div');
    logItem.className = `log-item log-${type}`;
    logItem.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    logContainer.appendChild(logItem);
    logContainer.scrollTop = logContainer.scrollHeight;
}

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Show notificationpopup
function showNotification(message, type = 'info') {
    // create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    // set icon based on type
    let icon = '💡';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    if (type === 'warning') icon = '⚠️';
    
    notification.innerHTML = `
        <span class="notification-icon">${icon}</span>
        <span class="notification-message">${message}</span>
        <button class="notification-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    // add to page
    document.body.appendChild(notification);
    
    // 3seconds auto dismiss
    setTimeout(() => {
        notification.classList.add('notification-fade-out');
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 300);
    }, 3000);
    
    console.log(`📢 notification [${type}]: ${message}`);
}

// show buzz section after successful file upload
function showBuzzSection(filePinId) {
    console.log('📝 Showing buzz section for file pinId:', filePinId);
    console.log('📝 buzzSection element:', buzzSection);
    console.log('📝 buzzSection element exists:', !!buzzSection);
    
    // Store file transaction ID for buzz attachment
    window.uploadedFilePinId = filePinId;
    
    // Show buzz section
    if (buzzSection) {
        console.log('📝 buzzSection element found, removing hidden class');
        console.log('📝 buzzSection classes before removal:', buzzSection.className);
        buzzSection.classList.remove('hidden');
        console.log('📝 buzzSection classes after removal:', buzzSection.className);
        console.log('📝 buzzSection style.display:', buzzSection.style.display);
        addLog('📝 Buzz section displayed - you can now send a buzz with file attachment', 'info');
        showNotification('File uploaded successfully! You can now send a buzz with attachment', 'success');
        
        // Update buzz button state
        updateBuzzButton();
    } else {
        console.error('❌ buzzSection element not found!');
        addLog('❌ Cannot find buzz section element', 'error');
    }
}

// update buzz button state
function updateBuzzButton() {
    if (!sendBuzzBtn) return;
    
    const canSendBuzz = walletConnected;
    
    sendBuzzBtn.disabled = !canSendBuzz;
    
    if (!walletConnected) {
        sendBuzzBtn.textContent = '📝 Please connect wallet first';
    } else {
        sendBuzzBtn.textContent = '📝 Send Buzz';
    }
}

// send buzz function
async function sendBuzz() {
    console.log('📝 Starting to send buzz...');
    
    // Validate wallet connection
    if (!walletConnected) {
        showNotification('⚠️ Please connect wallet first', 'warning');
        addLog('❌ Wallet not connected', 'error');
        return;
    }
    
    // Validate content
    const content = buzzContent ? buzzContent.value.trim() : '';
    if (!content) {
        showNotification('⚠️ Please enter buzz content', 'warning');
        addLog('❌ No buzz content entered', 'error');
        return;
    }
    
    const host = buzzHost ? buzzHost.value.trim() : '';
    
    console.log('✅ Validation passed: wallet connected, content provided');
    addLog('Starting to send Buzz...', 'info');
    
    try {
        sendBuzzBtn.disabled = true;
        sendBuzzBtn.textContent = 'Sending...';
        
        showNotification('Starting to send Buzz...', 'info');
        
        // Build buzz body
        const buzzBody = {
            content: content,
            contentType: "application/json;utf-8"
        };
        
        // Add file attachment if available
        if (window.uploadedFilePinId) {
            // Use the stored file extension from when file was selected
            const attachmentUri = `metafile://${window.uploadedFilePinId}${selectedFileExtension}`;
            buzzBody.attachments = [attachmentUri];
            addLog(`📎 Adding file attachment: ${attachmentUri}`, 'info');
            console.log('📎 Attachment URI:', attachmentUri);
            console.log('📎 File extension used:', selectedFileExtension);
        }
        
        
        console.log('📝 Buzz body:', buzzBody);
        addLog(`📝 Buzz content: ${content}`, 'info');
        
        // Create buzz using MetaID SDK
        const buzzResult = await createBuzz(buzzBody, host);
        
        addLog(`✅ Buzz sent successfully! TxID: ${buzzResult.txid}`, 'success');
        showNotification(`🎉 Buzz sent successfully!`, 'success');
        
        // Show buzz success links
        showBuzzSuccessLinks(buzzResult.txid, buzzResult.pinId);
        
        // Reset buzz form
        // resetBuzzForm();
        
    } catch (error) {
        console.error('❌ Failed to send Buzz:', error);
        addLog(`❌ Failed to send Buzz: ${error.message}`, 'error');
        
        if (error.message && error.message.includes('user cancelled')) {
            showNotification('Buzz sending operation cancelled', 'warning');
        } else {
            showNotification('Failed to send Buzz: ' + error.message, 'error');
        }
        
        sendBuzzBtn.disabled = false;
        sendBuzzBtn.textContent = '📝 Send Buzz';
    }
}

// create buzz using MetaID SDK
async function createBuzz(buzzBody, host) {
    addLog('Calling MetaID SDK to create Buzz...', 'info');
    
    try {
        // Check if MetaID SDK is available
        if (!window.Metaid) {
            throw new Error('MetaID SDK not loaded, please refresh the page');
        }
        
        console.log('✅ MetaID SDK loaded');
        console.log('🔍 window.Metaid:', window.Metaid);
        console.log('🔍 window.Metaid methods:', window.Metaid ? Object.keys(window.Metaid) : 'null');
        addLog('✅ MetaID SDK loaded', 'info');
        
        // Try to use MetaID SDK's createPin method
        addLog('Using MetaID SDK to create Buzz...', 'info');
        
        // Check available MetaID SDK methods
        console.log('🔍 Checking MetaID SDK available methods...');
        const availableMethods = Object.keys(window.Metaid || {});
        console.log('🔍 Available MetaID methods:', availableMethods);
        
        // Try to use MetaID SDK's correct API
        if (window.Metaid && typeof window.Metaid === 'function') {
            console.log('🔍 MetaID is a function, trying to initialize...');
        }
        
        // Create MVC connector
        const { MetaletWalletForMvc, mvcConnect } = window.Metaid;
        
        if (!MetaletWalletForMvc || !mvcConnect) {
            throw new Error('MetaID SDK missing required methods');
        }
        
        addLog('Creating MVC wallet connection...', 'info');
        
        // Create wallet instance
        const wallet = await MetaletWalletForMvc.create();
        
        // Connect to MVC network
        const mvcConnector = await mvcConnect({ 
            wallet: wallet, 
            network: 'livenet'
        });
        
        console.log('🔍 mvcConnector:', mvcConnector);
        console.log('🔍 mvcConnector methods:', mvcConnector ? Object.keys(mvcConnector) : 'null');
        
        if (!mvcConnector) {
            throw new Error('Cannot create MVC connector');
        }
        
        // Check if createPin method exists
        if (typeof mvcConnector.createPin !== 'function') {
            throw new Error('mvcConnector does not have createPin method');
        }
        
        addLog('Using createPin method to create Buzz...', 'info');
        console.log('📝 Buzz data:', buzzBody);
        
        // Build createPin data
        const pinData = {
            body: JSON.stringify(buzzBody),
            contentType: 'application/json;utf-8',
            path: host ? host + ':/protocols/simplebuzz' : '/protocols/simplebuzz',
            operation: 'create'
        };
        
        const pinOptions = {
            network: 'livenet',
            feeRate: Number(document.getElementById('feeRateInput').value) || 1,
        };
        
        console.log('📡 Calling createPin, data:', pinData);
        console.log('📡 Calling createPin, options:', pinOptions);
        
        // Use createPin method to create buzz
        const result = await mvcConnector.createPin(pinData, pinOptions);
        
        console.log('✅ createPin result:', result);
        
        if (result && result.txid) {
            addLog(`✅ Buzz created successfully! TxID: ${result.txid}`, 'success');
            // Try to get pinId from result, if not available use txid
            const pinId = result.pinId || result.txid+'i0';
            if (result.pinId) {
                addLog(`📌 PinID: ${result.pinId}`, 'success');
            }
            return { txid: result.txid, pinId: pinId };
        } else {
            throw new Error('Buzz creation failed, no transaction ID returned');
        }
        
    } catch (error) {
        console.error('❌ Failed to create Buzz:', error);
        throw new Error(`Failed to create Buzz: ${error.message}`);
    }
}

// show buzz success links
function showBuzzSuccessLinks(txId, pinId) {
    // Build links HTML
    let linksHtml = '<div style="margin-top: 15px; padding: 15px; background: #e3f2fd; border-radius: 8px; border-left: 4px solid #1976d2;">';
    linksHtml += '<div style="font-weight: bold; margin-bottom: 10px; color: #1976d2;">🎉 Buzz sent successfully! View details:</div>';
    
    if (txId) {
        const txUrl = `https://www.mvcscan.com/tx/${txId}`;
        linksHtml += `
            <div style="margin: 8px 0;">
                <strong>📝 Buzz Transaction ID:</strong> 
                <a href="${txUrl}" target="_blank" style="color: #1976d2; text-decoration: none; word-break: break-all; font-family: monospace;">
                    ${txId}
                </a>
                <button onclick="window.open('${txUrl}', '_blank')" style="margin-left: 10px; padding: 4px 12px; background: #1976d2; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
                    View Transaction 🔗
                </button>
            </div>
        `;
        addLog(`🔗 Buzz transaction link: ${txUrl}`, 'success');
    }
    
    if (pinId) {
        // Show Buzz链接
        const showBuzzUrl = `https://www.show.now/buzz/${pinId}`;
        linksHtml += `
            <div style="margin: 8px 0;">
                <strong>📱 Show Buzz:</strong> 
                <a href="${showBuzzUrl}" target="_blank" style="color: #28a745; text-decoration: none; word-break: break-all; font-family: monospace;">
                    ${pinId}
                </a>
                <button onclick="window.open('${showBuzzUrl}', '_blank')" style="margin-left: 10px; padding: 4px 12px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
                    View Buzz 📱
                </button>
            </div>
        `;
        addLog(`🔗 Show Buzz link: ${showBuzzUrl}`, 'success');
        
        // MetaID Manager链接
        const metaidManagerUrl = `https://man.metaid.io/pin/${pinId}`;
        linksHtml += `
            <div style="margin: 8px 0;">
                <strong>🔧 Buzz PinID:</strong> 
                <a href="${metaidManagerUrl}" target="_blank" style="color: #6f42c1; text-decoration: none; word-break: break-all; font-family: monospace;">
                    ${pinId}
                </a>
                <button onclick="window.open('${metaidManagerUrl}', '_blank')" style="margin-left: 10px; padding: 4px 12px; background: #6f42c1; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
                    View Buzz Pin 🔧
                </button>
            </div>
        `;
        addLog(`🔗 Buzz PinID link: ${metaidManagerUrl}`, 'success');
    }
    
    linksHtml += '</div>';
    
    // Show link above log area
    const container = document.querySelector('.container');
    const logSection = document.querySelector('.log-section');
    
    // Remove old buzz link display (if exists)
    const oldBuzzLinks = document.getElementById('buzzSuccessLinks');
    if (oldBuzzLinks) {
        oldBuzzLinks.remove();
    }
    
    // Add new buzz link display
    const linksDiv = document.createElement('div');
    linksDiv.id = 'buzzSuccessLinks';
    linksDiv.innerHTML = linksHtml;
    container.insertBefore(linksDiv, logSection);
    
    // Show notification
    showNotification('Buzz sent successfully! Click to view details', 'success');
}

// Get file extension with improved detection
function getFileExtension(file) {
    if (!file || !file.name) {
        return '';
    }
    
    const fileName = file.name;
    const mimeType = file.type;
    console.log('🔍 file name:', fileName);
    console.log('🔍 mime type:', mimeType);
    console.log('🔍 file extension:', file.extension);
    
    // Method 1: Use MIME type to determine extension (most reliable)
    if (mimeType) {
        const mimeToExt = {
            'image/jpeg': '.jpg',
            'image/jpg': '.jpg',
            'image/png': '.png',
            'image/gif': '.gif',
            'image/webp': '.webp',
            'image/svg+xml': '.svg',
            'text/plain': '.txt',
            'text/html': '.html',
            'text/css': '.css',
            'text/javascript': '.js',
            'application/javascript': '.js',
            'application/json': '.json',
            'application/pdf': '.pdf',
            'application/zip': '.zip',
            'application/x-tar': '.tar',
            'application/gzip': '.gz',
            'application/x-7z-compressed': '.7z',
            'application/x-rar-compressed': '.rar',
            'video/mp4': '.mp4',
            'video/avi': '.avi',
            'video/mov': '.mov',
            'audio/mp3': '.mp3',
            'audio/wav': '.wav',
            'audio/ogg': '.ogg'
        };
        
        if (mimeToExt[mimeType]) {
            addLog(`🔍 Detected file type from MIME: ${mimeType} → ${mimeToExt[mimeType]}`, 'info');
            return mimeToExt[mimeType];
        }
    }
    
    // Method 2: Smart filename parsing for complex extensions
    const parts = fileName.split('.');
    if (parts.length >= 2) {
        // Handle common multi-part extensions
        const lastPart = parts[parts.length - 1].toLowerCase();
        const secondLastPart = parts[parts.length - 2].toLowerCase();
        
        // Common compressed file patterns
        if (lastPart === 'gz' && (secondLastPart === 'tar' || secondLastPart === 'tgz')) {
            return '.tar.gz';
        }
        if (lastPart === 'bz2' && secondLastPart === 'tar') {
            return '.tar.bz2';
        }
        if (lastPart === 'xz' && secondLastPart === 'tar') {
            return '.tar.xz';
        }
        
        // Handle versioned files (e.g., file.min.js, style.css.map)
        if (lastPart === 'map' && parts.length >= 3) {
            const thirdLastPart = parts[parts.length - 3].toLowerCase();
            if (thirdLastPart === 'css' || thirdLastPart === 'js') {
                return `.${thirdLastPart}.${secondLastPart}.${lastPart}`;
            }
        }
        
        // Handle minified files (e.g., script.min.js, style.min.css)
        if (secondLastPart === 'min' && (lastPart === 'js' || lastPart === 'css')) {
            return `.${secondLastPart}.${lastPart}`;
        }
        
        // Default: use the last extension
        return '.' + lastPart;
    }
    
    // Method 3: No extension found
    addLog(`⚠️ No file extension detected for: ${fileName}`, 'warning');
    return '';
}

// reset buzz form
function resetBuzzForm() {
    if (buzzContent) buzzContent.value = '';
    if (buzzHost) buzzHost.value = '';
    updateBuzzButton();
}

// show successful upload links
function showUploadSuccessLinks(txId, pinId) {
    // build links HTML
    let linksHtml = '<div style="margin-top: 15px; padding: 15px; background: #e8f5e9; border-radius: 8px; border-left: 4px solid #28a745;">';
    linksHtml += '<div style="font-weight: bold; margin-bottom: 10px; color: #28a745;">🎉 upload to chain successful!view details：</div>';
    
    if (txId) {
        const txUrl = `https://www.mvcscan.com/tx/${txId}`;
        linksHtml += `
            <div style="margin: 8px 0;">
                <strong>📝 Transaction ID:</strong> 
                <a href="${txUrl}" target="_blank" style="color: #667eea; text-decoration: none; word-break: break-all; font-family: monospace;">
                    ${txId}
                </a>
                <button onclick="window.open('${txUrl}', '_blank')" style="margin-left: 10px; padding: 4px 12px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
                    View Transaction 🔗
                </button>
            </div>
        `;
        addLog(`🔗 Transaction link: ${txUrl}`, 'success');
    }
    
    if (pinId) {
        const pinUrl = `https://man.metaid.io/pin/${pinId}`;
        linksHtml += `
            <div style="margin: 8px 0;">
                <strong>📌 PinID:</strong> 
                <a href="${pinUrl}" target="_blank" style="color: #667eea; text-decoration: none; word-break: break-all; font-family: monospace;">
                    ${pinId}
                </a>
                <button onclick="window.open('${pinUrl}', '_blank')" style="margin-left: 10px; padding: 4px 12px; background: #764ba2; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
                    View Pin 🔗
                </button>
            </div>
        `;
        addLog(`🔗 PinLink: ${pinUrl}`, 'success');
    }
    
    linksHtml += '</div>';
    
    // show link above log area
    const container = document.querySelector('.container');
    const logSection = document.querySelector('.log-section');
    
    // remove old link display（if exists）
    const oldLinks = document.getElementById('successLinks');
    if (oldLinks) {
        oldLinks.remove();
    }
    
    // add new link display
    const linksDiv = document.createElement('div');
    linksDiv.id = 'successLinks';
    linksDiv.innerHTML = linksHtml;
    container.insertBefore(linksDiv, logSection);
    
    // Show notification
    showNotification('file uploaded to chain!click to view details', 'success');
}

// reset form
function resetForm() {
    selectedFile = null;
    selectedFileExtension = '';
    fileInput.value = '';
    fileInfo.classList.remove('show');
    dropZone.classList.remove('has-file');
    uploadBtn.disabled = true;
    uploadBtn.textContent = '🚀 Start Upload to Chain';
    progress.classList.remove('show');
    updateProgress(0, '');
    
    // remove success links display
    const successLinks = document.getElementById('successLinks');
    if (successLinks) {
        successLinks.remove();
    }
}

// listen to wallet account change
if (typeof window.metaidwallet !== 'undefined') {
    window.metaidwallet.on('accountsChanged', async (account) => {
        console.log('📢 wallet account changed:', account);
        
        // compatible with different wallet API versions
        const address = account?.address || account?.mvcAddress || account?.btcAddress;
        
        if (account && address) {
            currentAddress = address;
            addressText.textContent = currentAddress;
            
            // re-calculate and display MetaID
            const metaId = await calculateMetaID(currentAddress);
            const metaidText = document.getElementById('metaidText');
            if (metaidText) {
                metaidText.textContent = metaId;
            }
            
            addLog(`account switched: ${currentAddress}`, 'info');
            addLog(`🔑 MetaID: ${metaId}`, 'info');
            showNotification(`account switched: ${currentAddress.substring(0, 10)}...`, 'info');
            
            // refresh balance
            await fetchAndDisplayBalance();
        } else {
            walletConnected = false;
            walletStatus.textContent = 'Not Connected';
            walletStatus.style.color = '#999';
            walletAddress.classList.add('hidden');
            
            // hide balance info
            const balanceInfo = document.getElementById('balanceInfo');
            if (balanceInfo) {
                balanceInfo.classList.add('hidden');
            }
            
            // show connect button, hide disconnect button
            connectBtn.textContent = 'Connect Metalet Wallet';
            connectBtn.classList.remove('btn-success', 'hidden');
            connectBtn.classList.add('btn-primary');
            connectBtn.disabled = false;
            
            disconnectBtn.classList.add('hidden');
            
            updateUploadButton();
            updateBuzzButton();
            addLog('Wallet disconnected', 'error');
            showNotification('Wallet disconnected', 'warning');
        }
    });
}

