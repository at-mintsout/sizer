// Register Service Worker at top level immediately
let deferredPrompt = null;
const installAppBtn = document.getElementById('installAppBtn');

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Using explicit relative path to ensure root access across subdomains
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker running smoothly on scope: ', reg.scope))
            .catch(err => console.log('Service Worker installation blocked: ', err));
    });
}

// Track application installation eligibility variables
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    // Show download button once device flags compatibility
    if (installAppBtn) {
        installAppBtn.style.display = 'inline-block';
    }
});

// App core DOM interface references
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

const resizeRadioTypes = document.querySelectorAll('input[name="resizeType"]');
const percentageGroup = document.getElementById('percentageGroup');
const kbGroup = document.getElementById('kbGroup');

let loadedFile = null;

// Adjust configuration values dynamically on slider modification
scaleSlider.addEventListener('input', (e) => {
    sliderVal.textContent = e.target.value + '%';
});

// Structural layout dynamic switcher panels
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

// Drag & drop pipeline handlers
['dragenter', 'dragover'].forEach(name => {
    dropZone.addEventListener(name, (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
});
['dragleave', 'drop'].forEach(name => {
    dropZone.addEventListener(name, (e) => { e.preventDefault(); dropZone.classList.remove('dragover'); });
});
dropZone.addEventListener('drop', (e) => {
    handleFileAssignment(e.dataTransfer.files[0]);
});
dropZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => handleFileAssignment(e.target.files[0]));

function handleFileAssignment(file) {
    if (!file) return;
    if (file.type.startsWith('image/') || file.type === 'application/pdf') {
        loadedFile = file;
        fileInfo.textContent = `Target Loaded: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
        configPanel.style.display = 'block';
        downloadPanel.style.display = 'none';
    } else {
        alert("Invalid file signature detected. Submit images or standard PDFs.");
    }
}

// 4-Second Progress Counter Simulation Loop
processBtn.addEventListener('click', () => {
    if (!loadedFile) return;

    configPanel.style.display = 'none';
    downloadPanel.style.display = 'none';
    loadingOverlay.style.display = 'block';
    progressBar.style.width = '0%';

    let runtimeProgress = 0;
    const speedInterval = setInterval(() => {
        runtimeProgress += 2.5; // Smooth increments up to 100 over 4 seconds
        progressBar.style.width = `${runtimeProgress}%`;
        
        if (runtimeProgress >= 100) {
            clearInterval(speedInterval);
            executeResizingLogic();
        }
    }, 100);
});

// File processing transformation engine calculations
async function executeResizingLogic() {
    const holdsQuality = document.getElementById('holdQuality').checked;
    const selectedMode = document.querySelector('input[name="resizeType"]:checked').value;
    
    let calculatedQuality = scaleSlider.value / 100;
    let configTargetText = `${scaleSlider.value}%`;

    if (selectedMode === 'kb') {
        const targetValueKb = parseFloat(kbInput.value);
        configTargetText = `${targetValueKb} KB`;
        const currentSizeKb = loadedFile.size / 1024;
        calculatedQuality = Math.min(Math.max((targetValueKb / currentSizeKb), 0.1), 0.95);
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

            const dimensionMultiplier = highQualityHold ? 1 : quality;
            canvas.width = img.width * dimensionMultiplier;
            canvas.height = img.height * dimensionMultiplier;

            if(highQualityHold) {
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
            }

            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const optimizedUrl = canvas.toDataURL('image/jpeg', highQualityHold ? 0.85 : quality);
            
            triggerSuccessOutput(optimizedUrl, `resized_${file.name.split('.')[0]}.jpg`, file, labelText);
        };
    };
}

async function processPdfEngine(file, scale, highQualityHold, labelText) {
    try {
        const bytes = await file.arrayBuffer();
        const pdfDocument = await PDFLib.PDFDocument.load(bytes);
        const documentPages = pdfDocument.getPages();

        documentPages.forEach(page => {
            if (!highQualityHold) {
                const { width, height } = page.getSize();
                page.setSize(width * scale, height * scale);
                page.scale(scale, scale);
            }
        });

        const modifiedBytes = await pdfDocument.save();
        const binaryDataBlob = new Blob([modifiedBytes], { type: "application/pdf" });
        const outputUrl = URL.createObjectURL(binaryDataBlob);

        triggerSuccessOutput(outputUrl, `resized_${file.name}`, file, labelText);
    } catch(err) {
        alert("Error parsing document internal object streams.");
        loadingOverlay.style.display = 'none';
    }
}

function triggerSuccessOutput(url, filename, originalFile, configurationText) {
    loadingOverlay.style.display = 'none';
    downloadLink.href = url;
    downloadLink.download = filename;
    downloadPanel.style.display = 'block';

    // Show app download toggle button if device supports PWA triggers
    if (deferredPrompt && installAppBtn) {
        installAppBtn.style.display = 'inline-block';
    }

    storeOperationToLogs(originalFile.name, originalFile.type, originalFile.size, configurationText);
}

// Local Session Workspace Data Track Loggers
function storeOperationToLogs(name, type, byteSize, targetConfig) {
    const historicalEntries = JSON.parse(localStorage.getItem('shrinkvibe_logs') || '[]');
    const newRecord = {
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        filename: name,
        type: type.includes('pdf') ? 'PDF File' : 'Image Graphic',
        size: `${(byteSize / 1024).toFixed(1)} KB`,
        config: targetConfig
    };
    
    historicalEntries.unshift(newRecord);
    localStorage.setItem('shrinkvibe_logs', JSON.stringify(historicalEntries));
    renderHistoryTable();
}

function renderHistoryTable() {
    const records = JSON.parse(localStorage.getItem('shrinkvibe_logs') || '[]');
    if (records.length === 0) {
        historyLogBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #a0aec0;">No session actions recorded.</td></tr>`;
        return;
    }

    historyLogBody.innerHTML = records.map(entry => `
        <tr>
            <td>${entry.time}</td>
            <td style="font-weight: 600;">${entry.filename}</td>
            <td>${entry.type}</td>
            <td>${entry.size}</td>
            <td style="color: #48CAE4;">${entry.config}</td>
        </tr>
    `).join('');
}

clearHistoryBtn.addEventListener('click', () => {
    localStorage.removeItem('shrinkvibe_logs');
    renderHistoryTable();
});

// App Layout Tab Route Router Logic
const links = document.querySelectorAll('.nav-menu a, .footer-tab');
links.forEach(link => {
    link.addEventListener('click', () => {
        const targetHref = link.getAttribute('href');
        if (targetHref.startsWith('#')) {
            const section = document.getElementById(targetHref.replace('#', ''));
            if(section && section.classList.contains('content-section')) {
                document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden-section'));
                section.classList.remove('hidden-section');
            } else if (targetHref === '#tools') {
                document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden-section'));
            }
            
            // Toggle highlight sync
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

// PWA installation button execution click listener
if (installAppBtn) {
    installAppBtn.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User execution choice status: ${outcome}`);
        deferredPrompt = null;
        installAppBtn.style.display = 'none';
    });
}

window.addEventListener('appinstalled', () => {
    if (installAppBtn) installAppBtn.style.display = 'none';
    deferredPrompt = null;
});

document.addEventListener('DOMContentLoaded', renderHistoryTable);
