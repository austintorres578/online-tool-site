// =========================
// DOM refs
// =========================
const dropArea          = document.getElementById('drop-area');
const fileInput         = document.getElementById('fileElem');
const previewContainer  = document.querySelector('.image-preview-con .image-previews');
const compressBtn       = document.getElementById('compress-btn');
const compressionSlider = document.getElementById('compression-slider');
const compressionValue  = document.getElementById('compression-value');
const addMoreIcon       = document.getElementById('add-more-icon');
const redownloadBtn     = document.querySelector('.completion-download-button');
const percentEl         = document.querySelector('.loading-percentage');
const progressEl        = document.querySelector('.loading-progress');
const progressStateEl   = document.querySelector('.progress-state');

// New: explicit refs so we can reliably show/hide the right panels
const compressorEl = document.querySelector('.image-compressor');       // intro panel
const previewCon   = document.querySelector('.image-preview-con');      // previews panel
const loadingCon   = document.querySelector('.preview-loading-con');    // small loader shown while building previews

let imagePercent = document.querySelector('.size-reduction-percent'); // optional badge

// =========================
// State
// =========================
let uploadedFiles = [];              // only VALID, decodable images are stored here
let lastCompressedBlob = null;
let lastCompressedFilename = null;
let progressSource = null;

// =========================
/** Allowed types (must match backend) */
const ALLOWED_EXTS  = new Set(['.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff', '.bmp', '.avif']);
const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/tiff', 'image/bmp', 'image/avif']);

// Optional: front-end size cap (adjust if desired; keep consistent in your UI copy)
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

// =========================
// Helpers
// =========================
function getExt(filename) {
  const m = (filename || '').toLowerCase().match(/\.[^.]+$/);
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

/** Insert soft break points in long filenames so they wrap nicely.
 *  - Keeps the extension intact
 *  - Adds zero‑width spaces after delimiters and every N chars as fallback
 */
function softBreakFilename(filename, chunk = 12) {
  const dot = filename.lastIndexOf('.');
  const base = dot > 0 ? filename.slice(0, dot) : filename;
  const ext  = dot > 0 ? filename.slice(dot)    : '';

  const ZWSP = '\u200B';
  const withDelims = base.replace(/([_\-.])/g, `$1${ZWSP}`);
  const withChunks = withDelims.replace(new RegExp(`(.{${chunk}})`, 'g'), `$1${ZWSP}`);

  return withChunks + ext; // don’t break the extension
}

/** Decode a file as an image in the browser to ensure it is not corrupted. */
function decodeImage(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload  = () => { URL.revokeObjectURL(url); resolve(true);  };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(false); };
    img.src = url;
  });
}

// =========================
// Progress helpers
// =========================
function renderPct(pct) {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  if (percentEl)  percentEl.textContent = `${clamped}%`;  // ensure we show the % symbol
  if (progressEl) progressEl.style.width = `${clamped}%`;
}

function setState(txt) {
  if (progressStateEl) progressStateEl.textContent = txt || '';
}

// =========================
// UI bindings
// =========================
addMoreIcon?.addEventListener('click', () => fileInput?.click());

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

dropArea?.addEventListener('drop', async (e) => {
  e.preventDefault();
  const files = Array.from(e.dataTransfer.files);
  await acceptFiles(files);
});

fileInput?.addEventListener('change', async () => {
  const files = Array.from(fileInput.files);
  await acceptFiles(files);
  fileInput.value = '';
});

compressionSlider?.addEventListener('input', () => {
  if (compressionValue) compressionValue.textContent = `${compressionSlider.value}%`;
});

// =========================
// Central intake for files from either drop or input
// =========================
// Central intake for files from either drop or input
async function acceptFiles(files) {
  // Show the small "processing" placeholder, but DO NOT hide the intro yet
  if (loadingCon) loadingCon.style.display = 'flex';
  if (previewCon) previewCon.style.display = 'none';

  // Enforce the 10‑image cap (based on already accepted + this batch)
  const totalAttempted = uploadedFiles.length + files.length;
  if (totalAttempted > 10) {
    alert('You can only upload up to 10 images.');
  }
  // Don’t process beyond the remaining slots
  const remainingSlots = Math.max(0, 10 - uploadedFiles.length);
  const batch = Array.from(files).slice(0, remainingSlots);

  let acceptedCount = 0;

  for (const file of batch) {
    const rejectReason = reasonForRejection(file);
    if (rejectReason) {
      console.warn(`Rejected ${file.name}: ${rejectReason}`);
      alert(`"${file.name}" was rejected: ${rejectReason}`);
      continue;
    }

    // Decode guard – skip broken files
    const ok = await decodeImage(file);
    if (!ok) {
      console.warn(`Skipped broken image: ${file.name}`);
      alert(`"${file.name}" is broken or corrupted and cannot be used.`);
      continue;
    }

    // Only valid & decodable files are stored and previewed
    uploadedFiles.push(file);
    acceptedCount++;
    await buildPreview(file);
  }

  // Hide the small loader
  if (loadingCon) loadingCon.style.display = 'none';

  if (acceptedCount > 0) {
    // We have at least one valid preview: hide intro, show previews
    if (compressorEl) compressorEl.style.display = 'none';
    if (previewCon) previewCon.style.display = 'flex';
  } else {
    // Everything failed or nothing new: keep the intro visible
    if (previewCon) previewCon.style.display = 'none';
    if (compressorEl) {
      compressorEl.style.display = 'flex';
      compressorEl.style.flexDirection = 'column';
    }
  }
}


// =========================
// Previews (with soft-wrapped captions)
// =========================
function buildPreview(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = function (e) {
      const container = document.createElement('div');
      container.classList.add('image-preview-item');
      container.style.minWidth = '0'; // help flex layouts prevent overflow

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
      if (isTiff) img.style.boxShadow = 'none';

      const caption = document.createElement('p');
      caption.className = 'image-caption';
      caption.style.whiteSpace   = 'normal';
      caption.style.wordBreak    = 'break-word';
      caption.style.overflowWrap = 'anywhere';
      caption.style.maxWidth     = '100%';
      caption.style.display      = 'block';
      caption.textContent = softBreakFilename(file.name, 12);
      caption.title = file.name;

      container.setAttribute('data-filename', file.name);
      container.appendChild(buttonWrapper);
      container.appendChild(img);
      container.appendChild(caption);

      previewContainer.appendChild(container);
      resolve();
    };
    reader.readAsDataURL(file);
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
    // No previews left: hide previews, hide tiny loader, show intro again
    if (previewCon)  previewCon.style.display  = 'none';
    if (loadingCon)  loadingCon.style.display  = 'none';
    if (compressorEl) {
      compressorEl.style.display = 'flex';
      compressorEl.style.flexDirection = 'column';
    }
  }
}

// =========================
// Start compression
// =========================
compressBtn?.addEventListener('click', compressImages);

function compressImages() {
  if (uploadedFiles.length === 0) {
    alert('No images to compress.');
    return;
  }

  // Initial upload size (sum of VALID images only)
  const initialSizeBytes = uploadedFiles.reduce((sum, file) => sum + file.size, 0);
  const initialSizeMB = (initialSizeBytes / (1024 * 1024)).toFixed(2);
  console.log(`Initial upload size: ${initialSizeMB} MB`);

  document.querySelector('.loading-con').style.display = "flex";
  if (previewCon) previewCon.style.display = "none";
  document.querySelector('.image-compressor-header')?.style.setProperty('display', 'none');
  document.querySelector('.image-compressor-copy')?.style.setProperty('display', 'none');
  setState("Uploading");
  renderPct(0);

  // Generate jobId & open SSE before upload
  const jobId = (crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now());
  startProgressStream(jobId);

  const formData = new FormData();
  uploadedFiles.forEach(file => formData.append('images', file));
  if (compressionSlider) formData.append('quality', compressionSlider.value);
  formData.append('jobId', jobId);

  const xhr = new XMLHttpRequest();
  xhr.open('POST', 'https://online-tool-backend.onrender.com/compress', true);

  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) {
      const pct = (e.loaded / e.total) * 100;
      console.log(`Uploading: ${pct.toFixed(1)}%`);
      renderPct(pct);
      setState("Uploading");
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

    // Compressed size + reduction logs
    const compressedSizeMB = (blob.size / (1024 * 1024)).toFixed(2);
    console.log(`Compressed size: ${compressedSizeMB} MB`);

    if (initialSizeBytes > 0) {
      const reductionPctNum = 100 - (blob.size / initialSizeBytes) * 100;
      const reductionPct = reductionPctNum.toFixed(2);
      console.log(`Size reduction: ${reductionPct}%`);

      if (imagePercent) {
        if (reductionPctNum > 0) {
          imagePercent.style.display = 'inline';
          imagePercent.textContent = `${Math.abs(reductionPct)}%`;
        } else {
          imagePercent.style.display = 'none';
        }
      }
    }

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
    setState('Done');
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
      setState(mode === 'zip' ? 'Packaging' : 'Compressing');
    } catch {
      // ignore heartbeat/comments
    }
  };

  progressSource.addEventListener('end', () => {
    console.log('Compression: 100% [done]');
    renderPct(100);
    setState('Compressing');
    try { progressSource.close(); } catch {}
    progressSource = null;
  });

  progressSource.onerror = () => {
    // optional warn
  };
}
