const fileInput = document.getElementById("fileInput");
const cameraInput = document.getElementById("cameraInput");
const chooseImageBtn = document.getElementById("chooseImageBtn");
const cameraBtn = document.getElementById("cameraBtn");
const scanBtn = document.getElementById("scanBtn");
const resetScanBtn = document.getElementById("resetScanBtn");

const imagePreview = document.getElementById("imagePreview");
const uploadBox = document.getElementById("uploadBox");
const scanEmpty = document.getElementById("scanEmpty");
const scanProgress = document.getElementById("scanProgress");
const scanStatus = document.getElementById("scanStatus");
const progressBar = document.getElementById("progressBar");
const scanResults = document.getElementById("scanResults");
const uploadMessage = document.getElementById("uploadMessage");

let selectedImage = null;
let previewUrl = null;
let scanTimer = null;

function showError(message) {
    if (uploadMessage) {
        uploadMessage.textContent = message;
        uploadMessage.hidden = false;
    }
}

function clearError() {
    if (uploadMessage) {
        uploadMessage.textContent = "";
        uploadMessage.hidden = true;
    }
}

function stopScanTimer() {
    if (scanTimer !== null) {
        clearTimeout(scanTimer);
        scanTimer = null;
    }
}

function resetScan() {
    stopScanTimer();
    selectedImage = null;

    if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        previewUrl = null;
    }

    if (imagePreview) {
        imagePreview.onload = null;
        imagePreview.onerror = null;
        imagePreview.removeAttribute("src");
        imagePreview.style.display = "none";
    }

    if (fileInput) fileInput.value = "";
    if (cameraInput) cameraInput.value = "";
    if (scanEmpty) scanEmpty.hidden = false;
    if (scanProgress) scanProgress.hidden = true;

    if (scanResults) {
        scanResults.hidden = true;
        scanResults.innerHTML = "";
    }

    if (scanStatus) scanStatus.textContent = "Ready to scan";
    if (progressBar) progressBar.style.width = "0%";
    if (scanBtn) scanBtn.disabled = true;
    if (uploadBox) uploadBox.classList.remove("dragover");

    clearError();
}

function acceptImage(file) {
    resetScan();
    if (!file) return;

    if (!file.type.startsWith("image/")) {
        showError("Please choose a valid image file.");
        return;
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
        showError("Please choose an image smaller than 10 MB.");
        return;
    }

    selectedImage = file;
    previewUrl = URL.createObjectURL(file);

    if (imagePreview) {
        imagePreview.onload = () => { imagePreview.style.display = "block"; };
        imagePreview.onerror = () => {
            resetScan();
            showError("This image could not be opened. Please try another.");
        };
        imagePreview.src = previewUrl;
        imagePreview.alt = "Selected crop image preview";
    }

    if (scanEmpty) scanEmpty.hidden = true;
    if (scanBtn) scanBtn.disabled = false;
    clearError();
    if (scanStatus) scanStatus.textContent = "Image ready";
}

if (chooseImageBtn && fileInput) {
    chooseImageBtn.addEventListener("click", () => { fileInput.click(); });
}

if (cameraBtn && cameraInput) {
    cameraBtn.addEventListener("click", () => { cameraInput.click(); });
}

if (fileInput) {
    fileInput.addEventListener("change", (event) => { acceptImage(event.target.files[0]); });
}

if (cameraInput) {
    cameraInput.addEventListener("change", (event) => { acceptImage(event.target.files[0]); });
}

if (uploadBox) {
    uploadBox.addEventListener("dragover", (event) => {
        event.preventDefault();
        uploadBox.classList.add("dragover");
    });

    uploadBox.addEventListener("dragleave", () => {
        uploadBox.classList.remove("dragover");
    });

    uploadBox.addEventListener("drop", (event) => {
        event.preventDefault();
        uploadBox.classList.remove("dragover");
        const file = event.dataTransfer.files[0];
        acceptImage(file);
    });
}

function showDemoResults() {
    if (scanResults) {
        scanResults.innerHTML = `
      <div class="result-card">
        <h4>🌿 Image received</h4>
        <p>Your crop image was uploaded successfully in this browser.</p>
        <span class="result-tag">Image loaded</span>
      </div>
      <div class="result-card">
        <h4>🛰️ Environmental data</h4>
        <p>
          Satellite and weather data have not been connected yet.
          This prototype cannot determine actual crop health from this image.
        </p>
        <span class="result-tag">Backend required</span>
        <span class="result-tag">NASA data pending</span>
      </div>
      <div class="result-card result-warning">
        <h4>⚠️ Demonstration only</h4>
        <p>
          No disease diagnosis or real crop-risk assessment was performed.
          Connect the team's analysis service to display verified results.
        </p>
      </div>
    `;
        scanResults.hidden = false;
    }

    if (scanProgress) scanProgress.hidden = true;
    if (scanEmpty) scanEmpty.hidden = true;
    if (scanBtn) {
        scanBtn.disabled = false;
        scanBtn.textContent = "Demo complete";
    }
    if (scanStatus) scanStatus.textContent = "Demo finished — no AI diagnosis performed";
}

function runDemoScan() {
    if (!selectedImage) {
        showError("Choose a crop image before starting.");
        return;
    }

    stopScanTimer();
    clearError();

    if (scanBtn) {
        scanBtn.disabled = true;
        scanBtn.textContent = "Processing...";
    }

    if (scanEmpty) scanEmpty.hidden = true;
    if (scanResults) {
        scanResults.hidden = true;
        scanResults.innerHTML = "";
    }
    if (scanProgress) scanProgress.hidden = false;
    if (scanStatus) scanStatus.textContent = "Preparing image...";
    if (progressBar) progressBar.style.width = "20%";

    scanTimer = setTimeout(() => {
        if (scanStatus) scanStatus.textContent = "Demo workflow running...";
        if (progressBar) progressBar.style.width = "65%";
        scanTimer = setTimeout(() => {
            if (progressBar) progressBar.style.width = "100%";
            showDemoResults();
            scanTimer = null;
        }, 700);
    }, 700);
}

if (scanBtn) {
    scanBtn.disabled = true;
    scanBtn.addEventListener("click", runDemoScan);
}

if (resetScanBtn) {
    resetScanBtn.addEventListener("click", resetScan);
}

resetScan();