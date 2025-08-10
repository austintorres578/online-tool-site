// =========================
// DOM refs
// =========================
const dropArea = document.getElementById('drop-area');
const fileInput = document.getElementById('fileElem');
const previewContainer = document.querySelector('.image-preview-con .image-previews');
const compressBtn = document.getElementById('compress-btn');
const compressionSlider = document.getElementById('compression-slider');
const compressionValue = document.getElementById('compression-value');
const addMoreIcon = document.getElementById('add-more-icon');
const redownloadBtn = document.querySelector('.completion-download-button');
const percentEl = document.querySelector('.loading-percentage');
const progressEl = document.querySelector('.loading-progress');
const progressStateEl = document.querySelector('.progress-state');

// =========================
let uploadedFiles = [];
let lastCompressedBlob = null;
let lastCompressedFilename = null;
let progressSource = null;

// =========================
// Allowed types (must match backend)
// =========================
const ALLOWED_EXTS  = new Set(['.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff', '.bmp', '.avif']);
const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/tiff', 'image/bmp', 'image/avif']);

// Optional: front-end size cap (adjust if desired; keep consistent in your UI copy)
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

function getExt(filename) {
  const m = filename.toLowerCase().match(/\.[^.]+$/);
  return m ? m[0] : '';
}

function isAllowedFile(file) {
  const ext  = getExt(file.name);
  const mime = (file.type || '').toLowerCase();
  const extOk  = ALLOWED_EXTS.has(ext);
  // Some browsers leave MIME blank; allow it if ext is valid
  const mimeOk = !mime || ALLOWED_MIMES.has(mime);
  return extOk && mimeOk;
}

function reasonForRejection(file) {
  if (!isAllowedFile(file)) {
    const ext  = getExt(file.name) || '(no ext)';
    const mime = (file.type || 'unknown').toLowerCase();
    return `Unsupported type (${ext} / ${mime}). Allowed: ${[...ALLOWED_EXTS].join(', ')}`;
  }
  if (file.size > MAX_SIZE_BYTES) {
    return `Larger than ${(MAX_SIZE_BYTES/1024/1024).toFixed(0)}MB`;
  }
  return null;
}

// =========================
// Progress helpers
// =========================
function renderPct(pct) {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  if (percentEl) percentEl.textContent = `${clamped}%`;
  if (progressEl) progressEl.style.width = `${clamped}%`;
}

// =========================
// UI bindings
// =========================
if (addMoreIcon) {
  addMoreIcon.addEventListener('click', () => fileInput.click());
}

['dragenter', 'dragover'].forEach(eventName => {
  dropArea?.addEventListener(eventName, (e) => {
    e.preventDefault();
    dropArea.classList.add('dragover');
  });
});

['dragleave', 'drop'].forEach(eventName => {
  dropArea?.addEventListener(eventName, () => {
    dropArea.classList.remove('dragover');
  });
});

dropArea?.addEventListener('drop', (e) => {
  e.preventDefault();
  const files = Array.from(e.dataTransfer.files);
  const totalImages = uploadedFiles.length + files.length;

  if (totalImages > 10) {
    alert('You can only upload up to 10 images.');
    return;
  }

  const rejected = files
    .map(f => ({ file: f, reason: reasonForRejection(f) }))
    .filter(x => x.reason);

  if (rejected.length > 0) {
    const reasons = rejected.map(x => `❌ ${x.file.name}: ${x.reason}`).join('\n');
    alert(`Some files were rejected:\n${reasons}`);
    return;
  }

  handleFiles(files);
});

fileInput?.addEventListener('change', () => {
  const files = Array.from(fileInput.files);
  const totalImages = uploadedFiles.length + files.length;

  if (totalImages > 10) {
    alert('You can only upload up to 10 images.');
    fileInput.value = '';
    return;
  }

  const rejected = files
    .map(f => ({ file: f, reason: reasonForRejection(f) }))
    .filter(x => x.reason);

  if (rejected.length > 0) {
    const reasons = rejected.map(x => `❌ ${x.file.name}: ${x.reason}`).join('\n');
    alert(`Some files were rejected:\n${reasons}`);
    fileInput.value = '';
    return;
  }

  handleFiles(files);
});

compressionSlider?.addEventListener('input', () => {
  compressionValue.textContent = `${compressionSlider.value}%`;
});

// =========================
// Previews
// =========================
function handleFiles(files) {
  const remainingSlots = 10 - uploadedFiles.length;
  const filesArray = Array.from(files);

  if (filesArray.length > remainingSlots) {
    alert(`You can only upload ${remainingSlots} more image${remainingSlots === 1 ? '' : 's'}.`);
    return;
  }

  filesArray.forEach(file => {
    const rejectReason = reasonForRejection(file);
    if (rejectReason) {
      alert(`❌ ${file.name}: ${rejectReason}`);
      return;
    }

    uploadedFiles.push(file);

    const reader = new FileReader();
    reader.onload = function (e) {
      const container = document.createElement('div');
      container.classList.add('image-preview-item');

      const buttonWrapper = document.createElement('div');
      buttonWrapper.className = 'image-preview-buttons';

      const sizeKB = (file.size / 1024).toFixed(1);
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      const sizeDisplay = document.createElement('span');
      sizeDisplay.textContent = file.size >= 1024 * 1024 ? `${sizeMB} MB` : `${sizeKB} KB`;

      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-button';
      removeBtn.textContent = 'X';
      removeBtn.addEventListener('click', removeUncompressedImage);

      buttonWrapper.appendChild(sizeDisplay);
      buttonWrapper.appendChild(removeBtn);

      const img = document.createElement('img');
      const isTiff = file.type === 'image/tiff' || file.name.toLowerCase().endsWith('.tif') || file.name.toLowerCase().endsWith('.tiff');

      img.src = isTiff ? '/images/tiff-placeholder.png' : e.target.result;
      if (isTiff) {
        img.style.boxShadow = 'none';
      }

      const caption = document.createElement('p');
      caption.textContent = file.name;

      container.setAttribute('data-filename', file.name);
      container.appendChild(buttonWrapper);
      container.appendChild(img);
      container.appendChild(caption);

      previewContainer.appendChild(container);
    };
    reader.readAsDataURL(file);

    document.querySelector('.image-compressor').style.display = 'none';
    document.querySelector('.image-preview-con').style.display = 'flex';
  });
}

function removeUncompressedImage(event) {
  const container = event.target.closest('.image-preview-item');
  const filename = container.getAttribute('data-filename');

  if (container) {
    container.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    container.style.opacity = '0';
    container.style.transform = 'scale(0.95)';
    setTimeout(() => container.remove(), 300);
  }

  const index = uploadedFiles.findIndex(f => f.name === filename);
  if (index !== -1) uploadedFiles.splice(index, 1);

  const remaining = document.querySelectorAll('.image-preview-item').length - 1;
  if (remaining <= 0) {
    document.querySelector('.image-compressor').style.display = 'flex';
    document.querySelector('.image-preview-con').style.display = 'none';
  }
}

// =========================
compressBtn?.addEventListener('click', compressImages);

// =========================
// Compression w/ progress
// =========================
function compressImages() {
  if (uploadedFiles.length === 0) {
    alert('No images to compress.');
    return;
  }

  document.querySelector('.loading-con').style.display = "flex";
  document.querySelector('.image-preview-con').style.display = "none";
  document.querySelector('.image-compressor-header').style.display = "none";
  document.querySelector('.image-compressor-copy').style.display = "none";
  if (progressStateEl) progressStateEl.textContent = "Uploading";
  renderPct(0);

  // Generate jobId & open SSE before upload
  const jobId = (crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now());
  startProgressStream(jobId);

  const formData = new FormData();
  uploadedFiles.forEach(file => formData.append('images', file));
  formData.append('quality', compressionSlider.value);
  formData.append('jobId', jobId);

  const xhr = new XMLHttpRequest();
  xhr.open('POST', 'https://online-tool-backend.onrender.com/compress', true);

  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) {
      const pct = (e.loaded / e.total) * 100;
      console.log(`Uploading: ${pct.toFixed(1)}%`);
      renderPct(pct);
      if (progressStateEl) progressStateEl.textContent = "Uploading";
    }
  };

  xhr.responseType = 'blob';
  xhr.onload = function () {
    try { if (progressSource) progressSource.close(); } catch {}
    progressSource = null;

    if (xhr.status < 200 || xhr.status >= 300) {
      console.error('Compression failed:', xhr.status);
      document.querySelector('.loading-con').style.display = "none";
      alert('Something went wrong while compressing the images.');
      return;
    }

    console.log('Upload complete, download starting...');
    const blob = xhr.response;
    const cd = xhr.getResponseHeader('Content-Disposition') || '';
    let filename = 'compressed';
    const match = cd.match(/filename="?([^"]+)"?/);
    if (match && match[1]) filename = match[1].trim();

    lastCompressedBlob = blob;
    lastCompressedFilename = filename;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    renderPct(100);
    document.querySelector('.loading-con').style.display = "none";
    document.querySelector('.completion-con').style.display = "flex";
  };

  xhr.onerror = function () {
    console.error('Something went wrong while compressing the images.');
    try { if (progressSource) progressSource.close(); } catch {}
    progressSource = null;
    document.querySelector('.loading-con').style.display = "none";
    alert('Something went wrong while compressing the images.');
  };

  xhr.send(formData);
}

// =========================
// Redownload last result
// =========================
redownloadBtn?.addEventListener('click', () => {
  if (!lastCompressedBlob || !lastCompressedFilename) {
    alert('No compressed images to download. Please compress images first.');
    return;
  }

  const url = window.URL.createObjectURL(lastCompressedBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = lastCompressedFilename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
});

// =========================
// SSE progress stream
// =========================
function startProgressStream(jobId) {
  if (progressSource) { try { progressSource.close(); } catch {} progressSource = null; }
  progressSource = new EventSource(`https://online-tool-backend.onrender.com/progress/${jobId}`);

  progressSource.onmessage = (evt) => {
    try {
      const { total, processed, mode } = JSON.parse(evt.data);
      const pct = total ? (processed / total) * 100 : 0;
      console.log(`Compression: ${Math.round(pct)}% [${mode}] (${processed}/${total})`);
      renderPct(pct);
      if (progressStateEl) progressStateEl.textContent = (mode === 'zip' ? 'Packaging' : 'Compressing');
    } catch {
      // ignore heartbeat/comments
    }
  };

  progressSource.addEventListener('end', () => {
    console.log('Compression: 100% [done]');
    renderPct(100);
    if (progressStateEl) progressStateEl.textContent = "Compressing";
    try { progressSource.close(); } catch {}
    progressSource = null;
  });

  progressSource.onerror = (err) => {
    console.warn('SSE error', err);
  };
}
