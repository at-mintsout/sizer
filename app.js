// DOM Selectors
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const configPanel = document.getElementById('configPanel');
const scaleSlider = document.getElementById('scaleSlider');
const sliderVal = document.getElementById('sliderVal');
const kbInput = document.getElementById('kbInput');
const processBtn = document.getElementById('processBtn');
const loadingOverlay = document.getElementById('loadingOverlay');
const progressBar = document.getElementById('progressBar');
const downloadPanel = document.getElementById('downloadPanel');
const downloadLink = document.getElementById('downloadLink');
const historyLogBody = document.getElementById('historyLogBody');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');

// Sizing radio tab switches
const resizeRadioTypes = document.querySelectorAll('input[name="resizeType"]');
const percentageGroup = document.getElementById('percentageGroup');
const kbGroup = document.getElementById('kbGroup');

let loadedFile = null;

// --- DYNAMIC INTERACTIVE BEHAVIORS ---

// Update slider visual text indicator
scaleSlider.addEventListener('input', (e) => {
    sliderVal.textContent = e.target.value + '%';
});

// Toggle between Manual Target KB input and Percentage metrics
resizeRadioTypes.forEach(radio => {
    radio.addEventListener('change', (e) => {
        if (e.target.value === 'percentage') {
            percentageGroup.classList.remove('hidden');
            kbGroup.classList.add('hidden');
        } else {
            percentageGroup.classList.add('hidden');
            kbGroup.classList.remove('hidden');
        }
    });
});

// Drag and drop event listeners
['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => { e.preventDefault(); dropZone.classList.add('dragover'); }, false);
});
['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => { e.preventDefault(); dropZone.classList.remove('dragover'); }, false);
});
dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    handleFileAssignment(dt.files[0]);
});
dropZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => handleFileAssignment(e.target.files[0]));

function handleFileAssignment(file) {
    if (!file) return;
    if (file.type.startsWith('image/') || file.type === 'application/pdf') {
        loadedFile = file;
        fileInfo.textContent = `Selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
        configPanel.style.display = 'block';
        downloadPanel.style.display = 'none';
    } else {
        alert("Unsupported standard structure file. Select images or raw PDF configurations.");
    }
}

// --- LOADING TIMEOUT ACTION PIPELINE ---
processBtn.addEventListener('click', () => {
    if (!loadedFile) return;

    // Transition elements out, initialize loading elements
    configPanel.style.display = 'none';
    downloadPanel.style.display = 'none';
    loadingOverlay.style.display = 'block';
    progressBar.style.width = '0%';

    let progress = 0;
    const increment = 100 / 40; // 4 seconds total checked at 100ms intervals
    
    const interval = setInterval(() => {
        progress += increment;
        progressBar.style.width = `${Math.min(progress, 100)}%`;
        
        if (progress >= 100) {
            clearInterval(interval);
            executeResizingLogic();
        }
    }, 100);
});

// --- CORE PROCESSING RESIZE ENGINE ---
async function executeResizingLogic() {
    const holdsQuality = document.getElementById('holdQuality').checked;
    const selectedMode = document.querySelector('input[name="resizeType"]:checked').value;
    
    let calculatedQuality = scaleSlider.value / 100;
    let configTargetText = `${scaleSlider.value}%`;

    // Strategy configuration scaling optimization values
    if (selectedMode === 'kb') {
        const targetKb = parseFloat(kbInput.value);
        configTargetText = `${targetKb} KB`;
        const currentKb = loadedFile.size / 1024;
        calculatedQuality = Math.min(Math.max((targetKb / currentKb), 0.15), 0.95);
    }

    if (loadedFile.type.startsWith('image/')) {
        processImageEngine(loadedFile, calculatedQuality, holdsQuality, configTargetText);
    } else if (loadedFile.type === 'application/pdf') {
        await processPdfEngine(loadedFile, calculatedQuality, holdsQuality, configTargetText);
    }
}

function processImageEngine(file, quality, highQualityHold, labelText) {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
        const img = new Image();
        img.src = e.target.result;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            // Quality holds determine whether we geometrically modify layout coordinates or simple sampling scale
            const dimensionMultiplier = highQualityHold ? 1 : quality;
            canvas.width = img.width * dimensionMultiplier;
            canvas.height = img.height * dimensionMultiplier;

            // Apply smoothing vectors if holding quality constraints
            if(highQualityHold) {
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
            }

            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const optimizedUrl = canvas.toDataURL('image/jpeg', quality);
            
            triggerSuccessOutput(optimizedUrl, `optimized_${file.name.split('.')[0]}.jpg`, file, labelText);
        };
    };
}

async function processPdfEngine(file, scale, highQualityHold, labelText) {
    const bytes = await file.arrayBuffer();
    const pdfDocument = await PDFLib.PDFDocument.load(bytes);
    const documentPages = pdfDocument.getPages();

    documentPages.forEach(page => {
        if (!highQualityHold) {
            const { width, height } = page.getSize();
            page.setSize(width * scale, height * scale);
            page.scale(scale, scale);
        }
        // If highQualityHold is true, we keep internal container parameters static, optimizing downstream profiles.
    });

    const modifiedBytes = await pdfDocument.save();
    const binaryDataBlob = new Blob([modifiedBytes], { type: "application/pdf" });
    const outputUrl = URL.createObjectURL(binaryDataBlob);

    triggerSuccessOutput(outputUrl, `optimized_${file.name}`, file, labelText);
}

function triggerSuccessOutput(url, filename, originalFile, configurationText) {
    loadingOverlay.style.display = 'none';
    downloadLink.href = url;
    downloadLink.download = filename;
    downloadPanel.style.display = 'block';

    // Append to Work Logs Workspace History Data structure array
    storeOperationToLogs(originalFile.name, originalFile.type, originalFile.size, configurationText);
}

// --- WORKSPACE LOGGER SYSTEM HISTORY ---
function storeOperationToLogs(name, type, byteSize, targetConfig) {
    const historicalEntries = JSON.parse(localStorage.getItem('shrinkvibe_logs') || '[]');
    const newRecord = {
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        filename: name,
        type: type.includes('pdf') ? 'PDF Document' : 'Image Asset',
        size: `${(byteSize / 1024).toFixed(1)} KB`,
        config: targetConfig
    };
    
    historicalEntries.unshift(newRecord); // Add newest item first
    localStorage.setItem('shrinkvibe_logs', JSON.stringify(historicalEntries));
    renderHistoryTable();
}

function renderHistoryTable() {
    const records = JSON.parse(localStorage.getItem('shrinkvibe_logs') || '[]');
    if (records.length === 0) {
        historyLogBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #a0aec0;">No actions recorded yet during this session.</td></tr>`;
        return;
    }

    historyLogBody.innerHTML = records.map(entry => `
        <tr>
            <td>${entry.time}</td>
            <td style="font-weight: 500;">${entry.filename}</td>
            <td><span class="type-pill">${entry.type}</span></td>
            <td>${entry.size}</td>
            <td style="color: #48CAE4;">${entry.config}</td>
        </tr>
    `).join('');
}

clearHistoryBtn.addEventListener('click', () => {
    localStorage.removeItem('shrinkvibe_logs');
    renderHistoryTable();
});

// --- IMPLIMENTING FOOTER TAB TABULATION AND ROUTING NAVIGATION ---
const links = document.querySelectorAll('.nav-menu a, .footer-tab');
links.forEach(link => {
    link.addEventListener('click', (e) => {
        const targetHref = link.getAttribute('href');
        
        if (targetHref.startsWith('#')) {
            // Check if user clicked an in-app system view block element
            const targetSection = document.getElementById(targetHref.replace('#', ''));
            if(targetSection && targetSection.classList.contains('content-section')) {
                // Hide other content-sections, show this particular one
                document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden-section'));
                targetSection.classList.remove('hidden-section');
            } else if (targetHref === '#tools') {
                // Show core tool view components, wipe explicit secondary cards down
                document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden-section'));
            }
            
            // Sync up footer highlights styling
            if(targetHref === '#historySection') {
                document.getElementById('tabHistory').classList.add('active-tab');
                document.getElementById('tabTools').classList.remove('active-tab');
            } else {
                document.getElementById('tabTools').classList.add('active-tab');
                document.getElementById('tabHistory').classList.remove('active-tab');
            }
        }
    });
});

// Initial boot initialization checks
document.addEventListener('DOMContentLoaded', () => {
    renderHistoryTable();
});
// --- PROGRESSIVE WEB APP (PWA) INSTALL ENGINE ---

let deferredPrompt;
const installAppBtn = document.getElementById('installAppBtn');

// Register the Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('Service Worker registered successfully.'))
            .catch(err => console.log('Service Worker registration failed:', err));
    });
}

// Capture the browser's install request
window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent default browser popup mini-bar from showing automatically
    e.preventDefault();
    // Stash the event so we can trigger it later
    deferredPrompt = e;
    
    // Unhide the "Install as App" button on the UI
    if (installAppBtn) {
        installAppBtn.style.display = 'inline-block';
    }
});

// Handle the custom app install button click
if (installAppBtn) {
    installAppBtn.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        
        // Show the native device install prompt
        deferredPrompt.prompt();
        
        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User installation choice outcome: ${outcome}`);
        
        // Clear the prompt variable; it can only be used once
        deferredPrompt = null;
        
        // Hide our custom action button again
        installAppBtn.style.display = 'none';
    });
}

// Hide button if app is already installed successfully
window.addEventListener('appinstalled', () => {
    console.log('App successfully installed into system applications registry.');
    if (installAppBtn) {
        installAppBtn.style.display = 'none';
    }
    deferredPrompt = null;
});
