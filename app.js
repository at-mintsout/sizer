const fileInput = document.getElementById('fileInput');
const settingsArea = document.getElementById('settingsArea');
const scaleFactor = document.getElementById('scaleFactor');
const scaleValue = document.getElementById('scaleValue');
const processBtn = document.getElementById('processBtn');
const downloadArea = document.getElementById('downloadArea');
const downloadLink = document.getElementById('downloadLink');

let selectedFile = null;

// Show/update UI when file is chosen
fileInput.addEventListener('change', (e) => {
    selectedFile = e.target.files[0];
    if (selectedFile) {
        settingsArea.style.display = 'block';
        downloadArea.style.display = 'none';
    }
});

// Update the percentage text next to slider
scaleFactor.addEventListener('input', (e) => {
    scaleValue.textContent = e.target.value + '%';
});

// Handle the resizing click
processBtn.addEventListener('click', async () => {
    if (!selectedFile) return;

    const quality = scaleFactor.value / 100;

    if (selectedFile.type.startsWith('image/')) {
        resizeImage(selectedFile, quality);
    } else if (selectedFile.type === 'application/pdf') {
        await resizePDF(selectedFile, quality);
    }
});

// Image Resizer Logic
function resizeImage(file, quality) {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            // Scale down dimensions based on quality choice
            canvas.width = img.width * quality;
            canvas.height = img.height * quality;

            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            // Export compressed image
            const resizedUrl = canvas.toDataURL('image/jpeg', quality);
            setupDownload(resizedUrl, `resized_${file.name.split('.')[0]}.jpg`);
        };
    };
}

// PDF Resizer Logic
async function resizePDF(file, quality) {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
    const pages = pdfDoc.getPages();

    pages.forEach(page => {
        const { width, height } = page.getSize();
        // Scale down the physical dimensions of the pages
        page.setSize(width * quality, height * height * quality / height);
        page.scale(quality, quality);
    });

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const pdfUrl = URL.createObjectURL(blob);
    
    setupDownload(pdfUrl, `resized_${file.name}`);
}

// Trigger download display
function setupDownload(url, filename) {
    downloadLink.href = url;
    downloadLink.download = filename;
    downloadArea.style.display = 'block';
}
